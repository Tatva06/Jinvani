"""GET /api/v1/feed — public, no auth required."""

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

logger = logging.getLogger("jinvani.feed")
router = APIRouter()

# Type 4 — "Today's Special": eligible card types for the one pinned slot
# at the top of the main feed. Deliberately just 'summary'/'digest' — the
# main mixed feed's own content, not verbatim/narrative, which are
# separate deliberately-entered reading experiences (see books.py).
FEATURED_CARD_TYPES = ("summary", "digest")


async def _get_featured_card(supabase) -> CardOut | None:
    """Simple selection rule, not a recommendation engine: the most
    recently approved summary/digest card. "Most recently approved" is
    approximated as "most recently created and currently approved" —
    there's no separate approved_at timestamp in the schema. "Hasn't seen
    today" is intentionally left to the client (MMKV-tracked, see
    useFeedStore) rather than server-side per-user state, since /feed has
    no auth requirement to hang that on.
    """
    def build(select: str):
        return (
            supabase.table("cards")
            .select(select)
            .eq("status", "approved")
            .in_("card_type", FEATURED_CARD_TYPES)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )

    rows = await select_with_book_fallback(
        lambda: build(CARDS_WITH_BOOK_SELECT),
        lambda: build(CARDS_BASE_SELECT),
    )
    if not rows:
        return None
    row = attach_book_fields(rows[0])
    deck_info = row.get("decks")
    if deck_info and isinstance(deck_info, dict):
        row["deck_title"] = deck_info.get("title")
        row["book_id"] = deck_info.get("book_id")
        row["deck_sequence_order"] = deck_info.get("sequence_order")
    return CardOut(**row)


@router.get("/feed", response_model=FeedResponse, summary="Get the public card feed")
async def get_feed(
    request: Request,
    limit: int = Query(default=10, ge=1, le=100, description="Cards per page (max 100)."),
    offset: int = Query(default=0, ge=0, description="Pagination offset."),
    topic: str | None = Query(default=None, description="Filter by deck topic_tag."),
) -> FeedResponse:
    from main import state

    # Only the first, unfiltered page ever gets a featured card — a
    # topic-filtered view or a later page isn't "the main mixed feed" this
    # pin is meant for.
    featured: CardOut | None = None
    if offset == 0 and not topic:
        try:
            featured = await _get_featured_card(state.supabase)
        except Exception:
            logger.exception("Featured-card lookup failed for /feed — continuing without one")
            featured = None

    def build(select_decks: str):
        q = (
            state.supabase
            .table("cards")
            .select(f"*, {select_decks}")
            .eq("status", "approved")
        )
        if topic:
            q = q.eq("decks.topic_tag", topic)
        return (
            q.order("deck_id", desc=False)
            .order("sequence_order", desc=False)
            .limit(limit)
            .offset(offset)
            .execute()
        )

    # `!inner` is required only for the topic-filtered case (it turns the
    # embed into an inner join so `.eq("decks.topic_tag", ...)` actually
    # filters rows instead of being ignored on a left join).
    inner = "!inner" if topic else ""
    try:
        rows = await select_with_book_fallback(
            lambda: build(f"decks{inner}(title, topic_tag, book_id, sequence_order, books(title, author, pdf_url, is_public_domain, rights_note))"),
            lambda: build(f"decks{inner}(title, topic_tag, book_id, sequence_order)"),
        )
    except Exception as exc:
        logger.exception("Supabase query failed for /feed")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Feed fetch failed.") from exc

    featured_id = str(featured.id) if featured else None
    cards = []
    for row in rows:
        if featured_id and row["id"] == featured_id:
            continue  # already returned via `featured` — don't show it twice
        attach_book_fields(row)
        deck_info = row.get("decks")
        if deck_info and isinstance(deck_info, dict):
            row["deck_title"] = deck_info.get("title")
            row["book_id"] = deck_info.get("book_id")
            row["deck_sequence_order"] = deck_info.get("sequence_order")
        cards.append(CardOut(**row))

    logger.info(
        "Feed served %d cards (limit=%d, offset=%d, topic=%s, featured=%s)",
        len(cards), limit, offset, topic, featured_id,
    )
    return FeedResponse(cards=cards, count=len(cards), featured=featured)

