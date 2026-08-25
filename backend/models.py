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


class FeedResponse(BaseModel):
    cards: list[CardOut]
    count: int


class BookmarkRequest(BaseModel):
    user_id: UUID = Field(..., description="Jinvani users.id (not auth_id).")
    card_id: UUID = Field(..., description="Card to bookmark or un-bookmark.")


class BookmarkResponse(BaseModel):
    action: str   # "added" | "removed"
    user_id: UUID
    card_id: UUID
