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
    deck_sequence_order: int | None = None


class FeedResponse(BaseModel):
    cards: list[CardOut]
    count: int


class DeckOut(BaseModel):
    id: UUID
    title: str
    sequence_order: int
    topic_tag: str | None = None
    approved_card_count: int


class BookOut(BaseModel):
    book_id: str
    # There is no books table / books.title column — the schema only has
    # decks.book_id (a bare TEXT, no FK). This is the lowest-sequence_order
    # deck's title, used as a readable stand-in for a proper book title.
    title: str
    decks: list[DeckOut]
    approved_card_count: int


class BooksResponse(BaseModel):
    books: list[BookOut]


class BookmarkRequest(BaseModel):
    user_id: UUID = Field(..., description="Jinvani users.id (not auth_id).")
    card_id: UUID = Field(..., description="Card to bookmark or un-bookmark.")


class BookmarkResponse(BaseModel):
    action: str   # "added" | "removed"
    user_id: UUID
    card_id: UUID
