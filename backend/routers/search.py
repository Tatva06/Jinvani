"""GET /api/v1/search — public, no auth required.

ILIKE-level substring search over card content (title/body in the
requested language, falling back to en) and deck titles. No new search
infrastructure — two simple queries merged in Python. Only ever
searches status="approved" cards, same as /feed.
"""

from __future__ import annotations

import logging
from fastapi import APIRouter, HTTPException, Query, Request, status
from attribution import (
    CARDS_WITH_BOOK_SELECT,
    CARDS_BASE_SELECT,
    attach_book_fields,
    select_with_book_fallback,
)
from models import CardOut, FeedResponse

logger = logging.getLogger("jinvani.search")
router = APIRouter()

VALID_LANGS = {"en", "hi", "gu"}


@router.get("/search", response_model=FeedResponse, summary="Search cards by content or deck title")
async def search_cards(
    request: Request,
    q: str = Query(..., min_length=1, description="Search substring."),
    lang: str = Query(default="en", description="Language to search card content in (en/hi/gu)."),
    limit: int = Query(default=20, ge=1, le=100, description="Max results (max 100)."),
) -> FeedResponse:
    from main import state

    search_lang = lang if lang in VALID_LANGS else "en"
    like_pattern = f"%{q}%"

    try:
        def build_content_query(select: str):
            return (
                state.supabase
                .table("cards")
                .select(select)
                .eq("status", "approved")
                .or_(
                    f"content->{search_lang}->>title.ilike.{like_pattern},"
                    f"content->{search_lang}->>body.ilike.{like_pattern}"
                )
                .limit(limit)
                .execute()
            )

        content_matches = await select_with_book_fallback(
            lambda: build_content_query(CARDS_WITH_BOOK_SELECT),
            lambda: build_content_query(CARDS_BASE_SELECT),
        )

        deck_rows = (
            await state.supabase.table("decks").select("id").ilike("title", like_pattern).execute()
        ).data or []
        matching_deck_ids = [d["id"] for d in deck_rows]

        deck_matches = []
        if matching_deck_ids:
            def build_deck_query(select: str):
                return (
                    state.supabase
                    .table("cards")
                    .select(select)
                    .eq("status", "approved")
                    .in_("deck_id", matching_deck_ids)
                    .limit(limit)
                    .execute()
                )

            deck_matches = await select_with_book_fallback(
                lambda: build_deck_query(CARDS_WITH_BOOK_SELECT),
                lambda: build_deck_query(CARDS_BASE_SELECT),
            )
    except Exception as exc:
        logger.exception("Supabase query failed for /search")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Search failed.") from exc

    seen: set[str] = set()
    merged = []
    for row in content_matches + deck_matches:
        row_id = row["id"]
        if row_id in seen:
            continue
        seen.add(row_id)
        merged.append(row)
    merged = merged[:limit]

    cards = []
    for row in merged:
        attach_book_fields(row)
        deck_info = row.get("decks")
        if deck_info and isinstance(deck_info, dict):
            row["deck_title"] = deck_info.get("title")
            row["book_id"] = deck_info.get("book_id")
            row["deck_sequence_order"] = deck_info.get("sequence_order")
        cards.append(CardOut(**row))

    logger.info("Search served %d cards (q=%r, lang=%s)", len(cards), q, search_lang)
    return FeedResponse(cards=cards, count=len(cards))
