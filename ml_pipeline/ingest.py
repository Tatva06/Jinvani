"""
Step 5: Ingestion.

Every card lands with status="pending_review" — there is no scholar CMS
yet, so nothing is auto-approved. This was the single most important fix
from the earlier prototype, which inserted with status="approved" and no
human gate at all.

Idempotency: before inserting, check for an existing card with the same
deck_id + citation_reference and skip it rather than creating a duplicate.
No DB-level unique constraint backs this yet — it's an app-level check
only. Recommended migration (not applied by this pipeline):
    ALTER TABLE cards ADD CONSTRAINT cards_deck_citation_unique
        UNIQUE (deck_id, citation_reference);

sequence_order: derived from the target deck's current max value at
insert time, NOT a run-local index. An earlier version passed in a plain
1..N counter from the caller's chunk loop, which collides the moment the
pipeline is pointed at a deck that already has cards (e.g. a deck seeded
by hand, or a second ingestion run adding a later chapter) — every insert
after the first would violate the schema's
UNIQUE (deck_id, sequence_order) constraint. This version re-derives the
next value from the DB immediately before each insert and retries on a
23505 conflict, which self-heals both same-run thread races and races
across two separate `run.py --commit` invocations, without needing any
in-process lock.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from supabase import Client, create_client

from chunk import Chunk
from config import PipelineConfig
from structure import StructuredCard

RUN_LOG_PATH = Path(__file__).parent / "run_log.jsonl"

MAX_SEQUENCE_CONFLICT_RETRIES = 5


@dataclass
class IngestResult:
    status: str  # "inserted" | "skipped_duplicate" | "error"
    card_id: str | None = None
    detail: str | None = None


def _get_client(cfg: PipelineConfig) -> Client:
    if not cfg.supabase_url or not cfg.supabase_key:
        raise RuntimeError("SUPABASE_URL / SUPABASE_KEY not set — check your .env file.")
    return create_client(cfg.supabase_url, cfg.supabase_key)


def _log(entry: dict) -> None:
    entry["timestamp"] = datetime.now(timezone.utc).isoformat()
    with open(RUN_LOG_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def _already_exists(client: Client, deck_id: str, citation_reference: str) -> bool:
    result = (
        client.table("cards")
        .select("id")
        .eq("deck_id", deck_id)
        .eq("citation_reference", citation_reference)
        .limit(1)
        .execute()
    )
    return len(result.data) > 0


def _get_next_sequence_order(client: Client, deck_id: str) -> int:
    result = (
        client.table("cards")
        .select("sequence_order")
        .eq("deck_id", deck_id)
        .order("sequence_order", desc=True)
        .limit(1)
        .execute()
    )
    if result.data:
        return result.data[0]["sequence_order"] + 1
    return 1


def _is_sequence_order_conflict(error: Exception) -> bool:
    # supabase-py's error string representation includes the Postgres error
    # code and/or constraint name — check for both rather than importing a
    # specific exception class, since that's varied across client versions.
    text = str(error)
    return "23505" in text or "cards_deck_order_unique" in text


def ingest_card(
    client: Client,
    chunk: Chunk,
    card: StructuredCard,
    deck_id: str,
    book_title: str,
) -> IngestResult:
    citation_reference = f"{book_title}, {chunk.citation_label}"

    if _already_exists(client, deck_id, citation_reference):
        _log({
            "event": "skipped_duplicate",
            "deck_id": deck_id,
            "citation_reference": citation_reference,
        })
        return IngestResult(status="skipped_duplicate", detail=citation_reference)

    base_row = {
        "deck_id": deck_id,
        "card_type": "chunked_verse" if chunk.mode == "verse" else "summary",
        "citation_reference": citation_reference,
        "source_page_number": chunk.page_number,
        "is_scholar_verified": False,
        "status": "pending_review",  # never auto-approved — see module docstring
        "content": card.content,
        "original_verse": card.original_verse,
    }

    last_error: Exception | None = None
    for attempt in range(1, MAX_SEQUENCE_CONFLICT_RETRIES + 1):
        sequence_order = _get_next_sequence_order(client, deck_id)
        row = {**base_row, "sequence_order": sequence_order}
        try:
            result = client.table("cards").insert(row).execute()
            card_id = result.data[0]["id"]
            _log({"event": "inserted", "card_id": card_id, "citation_reference": citation_reference})
            return IngestResult(status="inserted", card_id=card_id)
        except Exception as e:  # noqa: BLE001
            if _is_sequence_order_conflict(e) and attempt < MAX_SEQUENCE_CONFLICT_RETRIES:
                last_error = e
                continue  # another writer took this slot — re-derive and retry
            _log({
                "event": "error",
                "citation_reference": citation_reference,
                "error": str(e),
            })
            return IngestResult(status="error", detail=str(e))

    _log({
        "event": "error",
        "citation_reference": citation_reference,
        "error": f"exhausted {MAX_SEQUENCE_CONFLICT_RETRIES} sequence_order retries: {last_error}",
    })
    return IngestResult(status="error", detail=f"sequence_order conflict retries exhausted: {last_error}")