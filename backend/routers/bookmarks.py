"""POST /api/v1/bookmarks — idempotent toggle bookmark."""

from __future__ import annotations

import logging
from fastapi import APIRouter, HTTPException, Request, status
from models import BookmarkRequest, BookmarkResponse

logger = logging.getLogger("jinvani.bookmarks")
router = APIRouter()


@router.post("/bookmarks", response_model=BookmarkResponse, summary="Toggle a bookmark")
async def toggle_bookmark(request: Request, body: BookmarkRequest) -> BookmarkResponse:
    from main import state

    user_id = str(body.user_id)
    card_id = str(body.card_id)

    # 1. Check for existing bookmark
    try:
        existing = (
            await state.supabase
            .table("user_stash")
            .select("id")
            .eq("user_id", user_id)
            .eq("card_id", card_id)
            .maybe_single()
            .execute()
        )
    except Exception as exc:
        logger.exception("SELECT failed in toggle_bookmark")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Database read error.") from exc

    # 2. Delete if found
    if existing.data:
        try:
            await (
                state.supabase
                .table("user_stash")
                .delete()
                .eq("id", existing.data["id"])
                .execute()
            )
        except Exception as exc:
            logger.exception("DELETE failed in toggle_bookmark")
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Database delete error.") from exc
        logger.info("Bookmark removed: user=%s card=%s", user_id, card_id)
        return BookmarkResponse(action="removed", user_id=body.user_id, card_id=body.card_id)

    # 3. Insert if not found
    try:
        await (
            state.supabase
            .table("user_stash")
            .insert({"user_id": user_id, "card_id": card_id})
            .execute()
        )
    except Exception as exc:
        # Handle unique constraint race condition (23505)
        if "23505" in str(exc):
            return BookmarkResponse(action="added", user_id=body.user_id, card_id=body.card_id)
        logger.exception("INSERT failed in toggle_bookmark")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Database insert error.") from exc

    logger.info("Bookmark added: user=%s card=%s", user_id, card_id)
    return BookmarkResponse(action="added", user_id=body.user_id, card_id=body.card_id)
