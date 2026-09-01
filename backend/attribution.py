"""Shared helpers for the decks.book_id_ref -> books join (migration
004_book_attribution.sql) and the derived estimated-read-time field.
Centralized here since feed.py/search.py/books.py all need the exact
same embed + graceful fallback — everything else in this codebase is
router-self-contained by convention, but this one join is genuinely
shared, not duplicated logic pretending not to be.
"""

from __future__ import annotations

import logging
from typing import Awaitable, Callable

logger = logging.getLogger("jinvani.attribution")

# Selects a card together with its deck AND (once migration 004 has been
# applied) that deck's book, via decks.book_id_ref -> books.id. Postgrest
# rejects the entire query if book_id_ref doesn't exist yet, so every
# call site uses `select_with_book_fallback` below rather than this
# constant directly.
CARDS_WITH_BOOK_SELECT = (
    "*, decks(title, topic_tag, book_id, sequence_order, "
    "books(title, author, pdf_url, is_public_domain, rights_note))"
)
CARDS_BASE_SELECT = "*, decks(title, topic_tag, book_id, sequence_order)"

DECKS_WITH_BOOK_SELECT = (
    "id, book_id, sequence_order, title, topic_tag, "
    "books(title, author, pdf_url, is_public_domain, rights_note)"
)
DECKS_BASE_SELECT = "id, book_id, sequence_order, title, topic_tag"


async def select_with_book_fallback(
    with_books: Callable[[], Awaitable],
    without_books: Callable[[], Awaitable],
):
    """Runs `with_books()` (a query using one of the *_WITH_BOOK_SELECT
    constants above); if that fails — the only realistic cause is
    migration 004 not being applied yet, so book_id_ref doesn't exist —
    falls back to `without_books()`. Both args are zero-arg callables
    returning an already-built (but not yet awaited) postgrest query, so
    callers keep full control over filters/ordering/limit.
    """
    try:
        return (await with_books()).data or []
    except Exception:
        logger.warning(
            "decks.book_id_ref join unavailable — falling back without book attribution "
            "(run migrations/004_book_attribution.sql to enable it)"
        )
        return (await without_books()).data or []


def attach_book_fields(row: dict) -> dict:
    """Flattens the embedded `decks.books` relationship (present only
    once migration 004 is applied AND this row's deck has a matching
    book_id_ref) onto CardOut/DeckOut-compatible top-level keys. Always
    safe to call — every field is None when the embed is absent, the
    per-deck book_id_ref is NULL (no matching book yet), or the
    migration hasn't run at all.
    """
    deck_info = row.get("decks")
    book = deck_info.get("books") if isinstance(deck_info, dict) else None
    if isinstance(book, list):  # some postgrest client versions embed to-one FKs as a 1-item list
        book = book[0] if book else None
    if not isinstance(book, dict):
        book = {}
    row["book_title"] = book.get("title")
    row["author_name"] = book.get("author")
    row["source_url"] = book.get("pdf_url")
    row["is_public_domain"] = book.get("is_public_domain")
    row["rights_note"] = book.get("rights_note")
    return row


def book_fields_from_embed(book: dict | None) -> dict:
    """Same field mapping as attach_book_fields, for call sites that
    already have the raw embedded `books` dict (e.g. from a
    decks-level query) rather than a card row wrapping it."""
    book = book or {}
    return {
        "book_title": book.get("title"),
        "author_name": book.get("author"),
        "source_url": book.get("pdf_url"),
        "is_public_domain": book.get("is_public_domain"),
        "rights_note": book.get("rights_note"),
    }


# ─── Estimated read time ───────────────────────────────────────────────────
# Rough and deliberately simple — a derived response field, never stored.
# These words-per-minute constants are reasonable approximations for
# silent reading, not measured against this app's actual readers; Hindi/
# Gujarati are set slightly lower since Devanagari/Gujarati script tends
# to read a little slower per "word" (whitespace-separated token) at a
# casual pace than English.
WORDS_PER_MINUTE = {"en": 200, "hi": 150, "gu": 150}


def estimate_read_minutes(card_contents: list[dict], lang: str = "en") -> int:
    """`card_contents` is a list of each card's raw `content` JSONB dict
    ({"en": {...}, "hi": {...}, "gu": {...}}). Sums body word counts in
    `lang`, falling back to `en` per card if that language's content is
    missing (same convention as the client's resolveCardContent), divides
    by the language's words-per-minute constant. Floors at 1 minute so a
    single short card/story never rounds down to "0 min".
    """
    wpm = WORDS_PER_MINUTE.get(lang, WORDS_PER_MINUTE["en"])
    total_words = 0
    for content in card_contents:
        entry = (content or {}).get(lang) or (content or {}).get("en") or {}
        body = entry.get("body") or ""
        total_words += len(body.split())
    return max(1, round(total_words / wpm))
