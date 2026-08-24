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
) -> FeedResponse:
    from main import state

    try:
        response = (
            await state.supabase
            .table("cards")
            .select("*")
            .eq("status", "approved")
            .order("deck_id", desc=False)
            .order("sequence_order", desc=False)
            .limit(limit)
            .offset(offset)
            .execute()
        )
    except Exception as exc:
        logger.exception("Supabase query failed for /feed")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Feed fetch failed.") from exc

    cards = [CardOut(**row) for row in (response.data or [])]
    logger.info("Feed served %d cards (limit=%d, offset=%d)", len(cards), limit, offset)
    return FeedResponse(cards=cards, count=len(cards))
