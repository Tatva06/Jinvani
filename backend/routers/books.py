"""GET /api/v1/books, /api/v1/books/{book_id}, /api/v1/books/{book_id}/cards
— public, no auth required.

A "book" is nothing more than the distinct set of decks.book_id values —
there is no books table (schema.sql only has decks.book_id, a bare TEXT
with no FK) and no books.title column. Every book here is grouped and
labeled entirely in Python from decks + cards, the same query-builder
style as feed.py/search.py — no raw SQL.

Only books/decks with at least one status="approved" card are ever
surfaced, consistent with /feed and /search.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from fastapi import APIRouter, HTTPException, Query, Request, status
from models import BookOut, BooksResponse, CardOut, DeckOut, FeedResponse

logger = logging.getLogger("jinvani.books")
router = APIRouter()


async def _fetch_decks_and_approved_counts(supabase) -> tuple[list[dict], dict[str, int]]:
    decks = (
        await supabase.table("decks")
        .select("id, book_id, sequence_order, title, topic_tag")
        .execute()
    ).data or []

    cards = (
        await supabase.table("cards")
        .select("deck_id")
        .eq("status", "approved")
        .execute()
    ).data or []

    approved_by_deck: dict[str, int] = defaultdict(int)
    for c in cards:
        approved_by_deck[c["deck_id"]] += 1

    return decks, approved_by_deck


def _group_into_books(decks: list[dict], approved_by_deck: dict[str, int]) -> list[BookOut]:
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
        books.append(BookOut(book_id=book_id, title=title, decks=deck_outs, approved_card_count=total))

    return books


@router.get("/books", response_model=BooksResponse, summary="List all books with approved cards")
async def list_books(request: Request) -> BooksResponse:
    from main import state

    try:
        decks, approved_by_deck = await _fetch_decks_and_approved_counts(state.supabase)
    except Exception as exc:
        logger.exception("Supabase query failed for /books")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Books fetch failed.") from exc

    books = _group_into_books(decks, approved_by_deck)
    books.sort(key=lambda b: b.title.lower())

    logger.info("Books served %d books", len(books))
    return BooksResponse(books=books)


@router.get("/books/{book_id}", response_model=BookOut, summary="Get one book's decks/chapters")
async def get_book(request: Request, book_id: str) -> BookOut:
    from main import state

    try:
        decks, approved_by_deck = await _fetch_decks_and_approved_counts(state.supabase)
    except Exception as exc:
        logger.exception("Supabase query failed for /books/%s", book_id)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Book fetch failed.") from exc

    decks_for_book = [d for d in decks if d["book_id"] == book_id]
    if not decks_for_book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found.")

    books = _group_into_books(decks_for_book, approved_by_deck)
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

        card_rows = (
            await state.supabase.table("cards")
            .select("*")
            .eq("status", "approved")
            .in_("deck_id", deck_ids)
            .execute()
        ).data or []
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
        deck_info = deck_info_by_id.get(row["deck_id"])
        if deck_info:
            row["deck_title"] = deck_info.get("title")
            row["book_id"] = deck_info.get("book_id")
            row["deck_sequence_order"] = deck_info.get("sequence_order")
        cards.append(CardOut(**row))

    logger.info("Book cards served %d cards (book_id=%s, deck_id=%s)", len(cards), book_id, deck_id)
    return FeedResponse(cards=cards, count=len(cards))
