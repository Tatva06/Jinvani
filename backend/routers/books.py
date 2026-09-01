"""GET /api/v1/books, /api/v1/books/{book_id}, /api/v1/books/{book_id}/cards,
/api/v1/stories, /api/v1/stories/{deck_id} — public, no auth required.

A "book" is nothing more than the distinct set of decks.book_id values —
there is no books table (schema.sql only has decks.book_id, a bare TEXT
with no FK) and no books.title column. Every book here is grouped and
labeled entirely in Python from decks + cards, the same query-builder
style as feed.py/search.py — no raw SQL.

A "story" (Type 5 / narrative) is likewise just one deck whose approved
cards are card_type='narrative' — no separate stories table either, same
convention. Reuses the same decks+cards fetch as books, grouped
differently: by individual deck rather than by book_id, and filtered to
narrative content.

Only books/decks/stories with at least one status="approved" card are
ever surfaced, consistent with /feed and /search.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from fastapi import APIRouter, HTTPException, Query, Request, status
from attribution import (
    CARDS_WITH_BOOK_SELECT,
    CARDS_BASE_SELECT,
    DECKS_WITH_BOOK_SELECT,
    DECKS_BASE_SELECT,
    attach_book_fields,
    book_fields_from_embed,
    estimate_read_minutes,
    select_with_book_fallback,
)
from models import (
    BookOut,
    BooksResponse,
    CardOut,
    DeckOut,
    FeedResponse,
    StoriesResponse,
    StoryDetailOut,
    StoryOut,
)

logger = logging.getLogger("jinvani.books")
router = APIRouter()

NARRATIVE_CARD_TYPE = "narrative"


async def _fetch_decks_and_approved_cards(supabase) -> tuple[list[dict], list[dict]]:
    decks = await select_with_book_fallback(
        lambda: supabase.table("decks").select(DECKS_WITH_BOOK_SELECT).execute(),
        lambda: supabase.table("decks").select(DECKS_BASE_SELECT).execute(),
    )

    # `content` is needed here (not just deck_id/card_type) so book/deck
    # read-time estimates can be computed below — see estimate_read_minutes.
    cards = (
        await supabase.table("cards")
        .select("deck_id, card_type, content")
        .eq("status", "approved")
        .execute()
    ).data or []

    return decks, cards


def _summarize_cards_by_deck(
    cards: list[dict],
) -> tuple[dict[str, int], dict[str, set[str]], dict[str, list[dict]]]:
    approved_by_deck: dict[str, int] = defaultdict(int)
    card_types_by_deck: dict[str, set[str]] = defaultdict(set)
    contents_by_deck: dict[str, list[dict]] = defaultdict(list)
    for c in cards:
        approved_by_deck[c["deck_id"]] += 1
        card_types_by_deck[c["deck_id"]].add(c["card_type"])
        contents_by_deck[c["deck_id"]].append(c["content"])
    return approved_by_deck, card_types_by_deck, contents_by_deck


def _group_into_books(
    decks: list[dict],
    approved_by_deck: dict[str, int],
    card_types_by_deck: dict[str, set[str]],
    contents_by_deck: dict[str, list[dict]],
    lang: str = "en",
) -> list[BookOut]:
    by_book: dict[str, list[dict]] = defaultdict(list)
    for d in decks:
        by_book[d["book_id"]].append(d)

    books: list[BookOut] = []
    for book_id, deck_rows in by_book.items():
        deck_rows_sorted = sorted(deck_rows, key=lambda d: d["sequence_order"])
        deck_outs = [
            DeckOut(
                id=d["id"],
                title=d["title"],
                sequence_order=d["sequence_order"],
                topic_tag=d.get("topic_tag"),
                approved_card_count=approved_by_deck.get(d["id"], 0),
                card_types=sorted(card_types_by_deck.get(d["id"], set())),
                estimated_read_minutes=estimate_read_minutes(
                    contents_by_deck.get(d["id"], []), lang
                ),
            )
            for d in deck_rows_sorted
        ]
        total = sum(d.approved_card_count for d in deck_outs)
        if total == 0:
            # No approved cards anywhere in this book — hide it entirely,
            # same policy as /feed and /search's status="approved" filter.
            continue
        # No books.title exists — use the lowest-sequence_order deck's
        # title as a readable stand-in.
        title = deck_outs[0].title
        book_card_types = sorted({ct for d in deck_outs for ct in d.card_types})
        book_minutes = sum(d.estimated_read_minutes for d in deck_outs)
        # All decks in a book share the same book_id_ref, so the first
        # deck's embedded `books` (if any) speaks for the whole book.
        book_fields = book_fields_from_embed(deck_rows_sorted[0].get("books"))
        books.append(BookOut(
            book_id=book_id, title=title, decks=deck_outs,
            approved_card_count=total, card_types=book_card_types,
            estimated_read_minutes=book_minutes,
            author_name=book_fields["author_name"],
            source_url=book_fields["source_url"],
            is_public_domain=book_fields["is_public_domain"],
            rights_note=book_fields["rights_note"],
        ))

    return books


@router.get("/books", response_model=BooksResponse, summary="List all books with approved cards")
async def list_books(
    request: Request,
    lang: str = Query(default="en", description="Language for the estimated-read-time word count (en/hi/gu)."),
) -> BooksResponse:
    from main import state

    try:
        decks, cards = await _fetch_decks_and_approved_cards(state.supabase)
    except Exception as exc:
        logger.exception("Supabase query failed for /books")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Books fetch failed.") from exc

    approved_by_deck, card_types_by_deck, contents_by_deck = _summarize_cards_by_deck(cards)
    books = _group_into_books(decks, approved_by_deck, card_types_by_deck, contents_by_deck, lang)
    books.sort(key=lambda b: b.title.lower())

    logger.info("Books served %d books", len(books))
    return BooksResponse(books=books)


@router.get("/books/{book_id}", response_model=BookOut, summary="Get one book's decks/chapters")
async def get_book(
    request: Request,
    book_id: str,
    lang: str = Query(default="en", description="Language for the estimated-read-time word count (en/hi/gu)."),
) -> BookOut:
    from main import state

    try:
        decks, cards = await _fetch_decks_and_approved_cards(state.supabase)
    except Exception as exc:
        logger.exception("Supabase query failed for /books/%s", book_id)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Book fetch failed.") from exc

    decks_for_book = [d for d in decks if d["book_id"] == book_id]
    if not decks_for_book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found.")

    approved_by_deck, card_types_by_deck, contents_by_deck = _summarize_cards_by_deck(cards)
    books = _group_into_books(decks_for_book, approved_by_deck, card_types_by_deck, contents_by_deck, lang)
    if not books:
        # Decks exist for this book_id, but none have any approved cards.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found.")

    return books[0]


@router.get(
    "/books/{book_id}/cards",
    response_model=FeedResponse,
    summary="Get a book's cards in real reading order (deck.sequence_order, then card.sequence_order)",
)
async def get_book_cards(
    request: Request,
    book_id: str,
    deck_id: str | None = Query(default=None, description="Optional — scope to a single deck/chapter instead of the whole book."),
    card_type: str | None = Query(
        default=None,
        description="Optional — scope to one card_type (e.g. 'verbatim' for continuous verbatim reading, "
                     "'narrative' for a story). Omit to get all approved cards regardless of type, as before.",
    ),
) -> FeedResponse:
    from main import state

    try:
        deck_rows = (
            await state.supabase.table("decks")
            .select("id, sequence_order, title, topic_tag, book_id")
            .eq("book_id", book_id)
            .execute()
        ).data or []
        if not deck_rows:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found.")

        if deck_id:
            deck_rows = [d for d in deck_rows if d["id"] == deck_id]
            if not deck_rows:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found in this book.")

        deck_order: dict[str, int] = {d["id"]: d["sequence_order"] for d in deck_rows}
        deck_info_by_id: dict[str, dict] = {d["id"]: d for d in deck_rows}
        deck_ids = list(deck_order.keys())

        def build_cards_query(select: str):
            q = (
                state.supabase.table("cards")
                .select(select)
                .eq("status", "approved")
                .in_("deck_id", deck_ids)
            )
            if card_type:
                q = q.eq("card_type", card_type)
            return q.execute()

        card_rows = await select_with_book_fallback(
            lambda: build_cards_query(CARDS_WITH_BOOK_SELECT),
            lambda: build_cards_query(CARDS_BASE_SELECT),
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Supabase query failed for /books/%s/cards", book_id)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Book cards fetch failed.") from exc

    # Real book order — sorted here in Python rather than relying on
    # PostgREST to order parent rows by an embedded resource's column
    # (inconsistent/version-dependent), same approach as merging
    # search.py's two queries.
    card_rows.sort(key=lambda c: (deck_order[c["deck_id"]], c["sequence_order"]))

    cards = []
    for row in card_rows:
        # book_id_ref-embedded fields (if present) live under row["decks"],
        # which the *_WITH_BOOK_SELECT query embeds directly on the card
        # row (unlike deck_info_by_id below, which is this endpoint's own
        # separate top-level deck fetch for ordering).
        attach_book_fields(row)
        deck_info = deck_info_by_id.get(row["deck_id"])
        if deck_info:
            row["deck_title"] = deck_info.get("title")
            row["book_id"] = deck_info.get("book_id")
            row["deck_sequence_order"] = deck_info.get("sequence_order")
        cards.append(CardOut(**row))

    logger.info(
        "Book cards served %d cards (book_id=%s, deck_id=%s, card_type=%s)",
        len(cards), book_id, deck_id, card_type,
    )
    return FeedResponse(cards=cards, count=len(cards))


@router.get("/stories", response_model=StoriesResponse, summary="List narrative decks ('stories') with approved cards")
async def list_stories(
    request: Request,
    lang: str = Query(default="en", description="Language for the estimated-read-time word count (en/hi/gu)."),
) -> StoriesResponse:
    from main import state

    try:
        decks, cards = await _fetch_decks_and_approved_cards(state.supabase)
    except Exception as exc:
        logger.exception("Supabase query failed for /stories")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Stories fetch failed.") from exc

    approved_by_deck, card_types_by_deck, contents_by_deck = _summarize_cards_by_deck(cards)
    deck_by_id = {d["id"]: d for d in decks}

    stories = [
        StoryOut(
            deck_id=deck_id,
            book_id=deck_by_id[deck_id]["book_id"],
            title=deck_by_id[deck_id]["title"],
            card_count=approved_by_deck[deck_id],
            estimated_read_minutes=estimate_read_minutes(contents_by_deck.get(deck_id, []), lang),
        )
        for deck_id, types in card_types_by_deck.items()
        # A deck counts as a "story" if it has any narrative cards at all —
        # in practice a deck is dedicated to one ingestion mode, so this is
        # effectively "the whole deck", but this doesn't assume that.
        if NARRATIVE_CARD_TYPE in types and deck_id in deck_by_id
    ]
    stories.sort(key=lambda s: s.title.lower())

    logger.info("Stories served %d stories", len(stories))
    return StoriesResponse(stories=stories)


@router.get("/stories/{deck_id}", response_model=StoryDetailOut, summary="Get one story's preview (title, card count, first card)")
async def get_story(
    request: Request,
    deck_id: str,
    lang: str = Query(default="en", description="Language for the estimated-read-time word count (en/hi/gu)."),
) -> StoryDetailOut:
    from main import state

    try:
        deck_rows = (
            await state.supabase.table("decks")
            .select("id, book_id, sequence_order, title")
            .eq("id", deck_id)
            .limit(1)
            .execute()
        ).data or []
        if not deck_rows:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Story not found.")
        deck_row = deck_rows[0]

        card_rows = await select_with_book_fallback(
            lambda: state.supabase.table("cards").select(CARDS_WITH_BOOK_SELECT)
                .eq("deck_id", deck_id).eq("status", "approved")
                .eq("card_type", NARRATIVE_CARD_TYPE).order("sequence_order", desc=False).execute(),
            lambda: state.supabase.table("cards").select(CARDS_BASE_SELECT)
                .eq("deck_id", deck_id).eq("status", "approved")
                .eq("card_type", NARRATIVE_CARD_TYPE).order("sequence_order", desc=False).execute(),
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Supabase query failed for /stories/%s", deck_id)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Story fetch failed.") from exc

    if not card_rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Story has no approved narrative cards.")

    first_row = attach_book_fields(dict(card_rows[0]))
    first_row["deck_title"] = deck_row.get("title")
    first_row["book_id"] = deck_row.get("book_id")
    first_row["deck_sequence_order"] = deck_row.get("sequence_order")

    return StoryDetailOut(
        deck_id=deck_row["id"],
        book_id=deck_row["book_id"],
        title=deck_row["title"],
        card_count=len(card_rows),
        estimated_read_minutes=estimate_read_minutes([c["content"] for c in card_rows], lang),
        preview_card=CardOut(**first_row),
    )
