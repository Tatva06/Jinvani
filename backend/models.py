from __future__ import annotations
from typing import Any
from uuid import UUID
from pydantic import BaseModel, Field


class CardOut(BaseModel):
    id: UUID
    deck_id: UUID
    sequence_order: int
    card_type: str
    citation_reference: str | None = None
    source_page_number: int | None = None
    status: str
    content: dict[str, Any]
    original_verse: dict[str, Any] | None = None
    deck_title: str | None = None
    decks: dict[str, Any] | None = None
    # Populated for the book-detail/book-reading endpoints (and, going
    # forward, the main feed too) so the client can navigate to a card's
    # book without parsing citation_reference strings.
    book_id: str | None = None
    # ─── Book attribution (migration 004_book_attribution.sql) ───────────
    # All None until that migration is applied AND the card's deck has a
    # matching books row — see attribution.py. Never required; the
    # attribution footer/"Read Complete Original" action must render
    # sensibly with any/all of these absent.
    book_title: str | None = None
    author_name: str | None = None
    source_url: str | None = None
    is_public_domain: bool | None = None
    rights_note: str | None = None
    deck_sequence_order: int | None = None


class FeedResponse(BaseModel):
    cards: list[CardOut]
    count: int
    # Type 4 — "Today's Special": one pinned card the main feed can show
    # first. Only ever populated for the first, unfiltered page (see
    # feed.py) — a separate field rather than cards[0], so pagination math
    # in the client (dedupe, nextOffset, hasMore) never has to know this
    # exists. None when there's nothing to feature.
    featured: CardOut | None = None


class DeckOut(BaseModel):
    id: UUID
    title: str
    sequence_order: int
    topic_tag: str | None = None
    approved_card_count: int
    # Distinct card_type values among this deck's approved cards — lets the
    # client tell a verbatim deck, a narrative ("story") deck, and a
    # regular concept/verse deck apart without a second round-trip.
    card_types: list[str] = []
    # Word-count-derived, computed fresh per request — never stored. See
    # attribution.estimate_read_minutes.
    estimated_read_minutes: int = 0


class BookOut(BaseModel):
    book_id: str
    # As of migration 003 there WAS no books table; as of 004 there is
    # one (hand-created in the Supabase dashboard, now linked via
    # decks.book_id_ref) but it may still have no matching row for this
    # book_id, or the migration may not be applied yet. Falls back to the
    # lowest-sequence_order deck's title as a readable stand-in either way.
    title: str
    decks: list[DeckOut]
    approved_card_count: int
    # Union of every deck's card_types — lets Book Detail decide, e.g.,
    # whether "Start Reading" should launch verbatim continuous-reading
    # mode instead of the normal all-approved-cards book order.
    card_types: list[str] = []
    estimated_read_minutes: int = 0
    # ─── Book attribution (migration 004_book_attribution.sql) — see
    # CardOut's identical fields for the null-until-applied contract. ───
    author_name: str | None = None
    source_url: str | None = None
    is_public_domain: bool | None = None
    rights_note: str | None = None


class BooksResponse(BaseModel):
    books: list[BookOut]


class StoryOut(BaseModel):
    """Type 5 — one narrative deck ('story'). A story is just a deck whose
    approved cards are card_type='narrative'; there's no separate stories
    table, same non-table-per-concept convention as BookOut."""
    deck_id: UUID
    book_id: str
    title: str
    card_count: int
    estimated_read_minutes: int = 0


class StoryDetailOut(StoryOut):
    # First card in the story, for the "decide to read or skip" preview
    # screen (title/count/takeaway) — full CardOut so the client can pick
    # the right language, same as any other card.
    preview_card: CardOut | None = None


class StoriesResponse(BaseModel):
    stories: list[StoryOut]


class BookmarkRequest(BaseModel):
    user_id: UUID = Field(..., description="Jinvani users.id (not auth_id).")
    card_id: UUID = Field(..., description="Card to bookmark or un-bookmark.")


class BookmarkResponse(BaseModel):
    action: str   # "added" | "removed"
    user_id: UUID
    card_id: UUID
