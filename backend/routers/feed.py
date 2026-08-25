"""GET /api/v1/feed — public, no auth required."""

from __future__ import annotations

import logging
from fastapi import APIRouter, HTTPException, Query, Request, status
from models import CardOut, FeedResponse

logger = logging.getLogger("jinvani.feed")
router = APIRouter()


@router.get("/feed", response_model=FeedResponse, summary="Get the public card feed")
async def get_feed(
    request: Request,
    limit: int = Query(default=10, ge=1, le=100, description="Cards per page (max 100)."),
    offset: int = Query(default=0, ge=0, description="Pagination offset."),
    topic: str | None = Query(default=None, description="Filter by deck topic_tag."),
) -> FeedResponse:
    from main import state

    try:
        if topic:
            query = (
                state.supabase
                .table("cards")
                .select("*, decks!inner(title, topic_tag)")
                .eq("status", "approved")
                .eq("decks.topic_tag", topic)
                .order("deck_id", desc=False)
                .order("sequence_order", desc=False)
                .limit(limit)
                .offset(offset)
            )
        else:
            query = (
                state.supabase
                .table("cards")
                .select("*, decks(title, topic_tag)")
                .eq("status", "approved")
                .order("deck_id", desc=False)
                .order("sequence_order", desc=False)
                .limit(limit)
                .offset(offset)
            )
        response = await query.execute()
    except Exception as exc:
        logger.exception("Supabase query failed for /feed")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Feed fetch failed.") from exc

    cards = []
    for row in (response.data or []):
        deck_info = row.get("decks")
        if deck_info and isinstance(deck_info, dict):
            row["deck_title"] = deck_info.get("title")
        cards.append(CardOut(**row))

    logger.info("Feed served %d cards (limit=%d, offset=%d, topic=%s)", len(cards), limit, offset, topic)
    return FeedResponse(cards=cards, count=len(cards))

