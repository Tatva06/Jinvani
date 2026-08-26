"""
CLI entrypoint. Dry-run is the default — nothing touches Supabase unless
you pass --commit explicitly, and only after you've looked at dry-run
output at least once for a new book.

Concurrency model
─────────────────
max_workers=2 threads, each sleeping 5 s after every Gemini call.
Effective throughput: 2 × (1 / (gemini_call_time + 5s)) ≈ 12–14 calls/min,
safely inside the free-tier 15 RPM cap. A threading.Lock guards the shared
output files so lines are never interleaved.

Usage:
  python run.py --pdf book.pdf --deck-id <uuid> --book-title "Shaakahaar" --mode auto
  python run.py --pdf book.pdf --deck-id <uuid> --book-title "..." --mode verse --commit --limit 3
"""
from __future__ import annotations

import argparse
import json
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

from chunk import chunk_pages
from config import load_config, PipelineConfig
from extract import extract_pages, extract_page_range
from structure import BudgetExceeded, structure_chunk
from validate import validate_card

DRY_RUN_DIR = Path(__file__).parent / "dry_run"
FLAGGED_DIR = Path(__file__).parent / "flagged"

# Types 1 & 5 — one LLM call over a page range instead of the per-chunk
# pipeline below. See _run_multi_card.
MULTI_CARD_MODES = {"digest", "narrative"}

# ── Rate-limit constant ────────────────────────────────────────────────────────
# After each Gemini call, workers sleep this many seconds.
# With 2 workers: effective rate ≈ 2 / (avg_gemini_time + SLEEP_PER_CALL)
# ≈ 2 / (3 + 5) = 13 calls/min — comfortably under the 15 RPM free-tier cap.
SLEEP_PER_CALL: float = 5.0


def _run_multi_card(
    args: argparse.Namespace,
    cfg: PipelineConfig,
    page_start: int,
    page_end: int,
    dry_run_path: Path,
    flagged_path: Path,
) -> None:
    """--mode digest / --mode narrative: extract one page range, make ONE
    LLM call over the whole thing (structure_multi_card), validate every
    card in the returned array, then either dry-run-log or ingest —
    same --commit/dry-run gate, same dry_run/flagged directories and
    per-run timestamped files, same daily-budget printout as the per-chunk
    modes above, just without the thread pool (there's only one LLM call
    to make, not one per chunk).

    Partial-ingest policy differs by style, per an explicit call made for
    this pipeline rather than picked silently:
      - narrative: ANY failing card rejects the WHOLE array. A missing
        "Part 2 of 5" breaks the continuous, sequential-swipe reading
        experience narrative mode exists for — a gap there isn't cosmetic,
        it defeats the point of the mode.
      - digest: passing cards are ingested, failing ones are flagged and
        dropped. Digest cards are self-contained compressed points, so a
        gap is low-cost — and discarding an entire otherwise-good LLM call
        over one card missing its word-count target would waste budget for
        no real benefit.
    """
    from ingest import ingest_multi_card
    from structure import structure_multi_card
    from validate import validate_multi_card

    print(f"📄 Extracting pages {page_start}-{page_end} from {args.pdf}...")
    full_text = extract_page_range(args.pdf, page_start, page_end)
    print(f"   {len(full_text)} characters extracted")

    print(f"🧠 Structuring as one {args.mode} LLM call...")
    try:
        cards = structure_multi_card(full_text, args.mode, cfg)
    except BudgetExceeded as e:
        print(f"🛑 {e}")
        return
    except Exception as e:  # noqa: BLE001
        print(f"❌ LLM structuring failed: {e}")
        with open(flagged_path, "a", encoding="utf-8") as f:
            f.write(json.dumps({"unit_title": args.unit_title, "reason": str(e)}, ensure_ascii=False) + "\n")
        return

    total = len(cards)
    print(f"   {total} cards returned")

    results = validate_multi_card(cards, cfg)
    failed_count = sum(1 for r in results if not r.passed)

    for i, (card, result) in enumerate(zip(cards, results), start=1):
        if not result.passed:
            print(f"⚠️  Card {i}/{total} failed validation: {result.reasons}")
            with open(flagged_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({
                    "unit_title": args.unit_title,
                    "part": f"{i} of {total}",
                    "reasons": result.reasons,
                    "content": card.content,
                }, ensure_ascii=False) + "\n")

    if args.mode == "narrative" and failed_count:
        print(f"🛑 narrative mode: {failed_count}/{total} cards failed validation — rejecting the whole batch")
        cards_to_ingest: list = []
    elif args.mode == "narrative":
        cards_to_ingest = cards
    else:  # digest — partial ingest
        cards_to_ingest = [card for card, result in zip(cards, results) if result.passed]

    if not args.commit:
        for i, (card, result) in enumerate(zip(cards, results), start=1):
            if result.passed:
                with open(dry_run_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps({
                        "unit_title": args.unit_title,
                        "part": f"{i} of {total}",
                        "mode": args.mode,
                        "content": card.content,
                    }, ensure_ascii=False) + "\n")
        print(f"✅ {total - failed_count}/{total} cards passed validation (dry-run — not written to Supabase)")
        print(f"  Daily LLM budget:  {cfg.daily_call_budget} calls (see .llm_call_budget.json for usage)")
        print("\nThis was a DRY RUN. Nothing was written to Supabase.")
        print(f"Review {dry_run_path} and re-run the same command with --commit.")
        return

    if not cards_to_ingest:
        print("Nothing to ingest.")
        print(f"  Daily LLM budget:  {cfg.daily_call_budget} calls (see .llm_call_budget.json for usage)")
        return

    from ingest import _get_client
    client = _get_client(cfg)
    outcomes = ingest_multi_card(
        client, cards_to_ingest,
        deck_id=args.deck_id,
        book_title=args.book_title,
        unit_title=args.unit_title,
        style=args.mode,
    )
    inserted = skipped = errors = 0
    for outcome in outcomes:
        if outcome.status == "inserted":
            print(f"✅ Inserted card {outcome.card_id}")
            inserted += 1
        elif outcome.status == "skipped_duplicate":
            print(f"⏭️  Skipped (already exists): {outcome.detail}")
            skipped += 1
        else:
            print(f"❌ Insert failed: {outcome.detail}")
            errors += 1

    print("\n" + "=" * 50)
    print("SUMMARY")
    print(f"  Cards returned:    {total}")
    print(f"  Inserted:          {inserted}")
    print(f"  Skipped (dupes):   {skipped}")
    print(f"  Insert errors:     {errors}")
    print(f"  Flagged:           {failed_count}  → {flagged_path if failed_count else '(none)'}")
    print(f"  Daily LLM budget:  {cfg.daily_call_budget} calls (see .llm_call_budget.json for usage)")
    print("=" * 50)


def main() -> None:
    parser = argparse.ArgumentParser(description="Book → trilingual card ingestion pipeline")
    parser.add_argument("--pdf", required=True, help="Path to source PDF")
    parser.add_argument("--deck-id", required=True, help="Target decks.id (UUID) in Supabase")
    parser.add_argument("--book-title", required=True, help="Used to build citation_reference")
    parser.add_argument(
        "--mode",
        choices=["concept", "verse", "auto", "verbatim", "digest", "narrative"],
        default="auto",
    )
    parser.add_argument("--verse-regex", default=None, help="Override config.yaml verse_regex")
    parser.add_argument("--limit", type=int, default=None, help="Only process the first N chunks (for testing)")
    parser.add_argument(
        "--pages",
        default=None,
        help="Page range START-END, 1-indexed inclusive (e.g. 12-30). Required for --mode digest/narrative.",
    )
    parser.add_argument(
        "--unit-title",
        default=None,
        help="Chapter/story title for this unit, used in citation_reference alongside --book-title. "
             "Required for --mode digest/narrative.",
    )
    parser.add_argument(
        "--commit",
        action="store_true",
        help="Actually write to Supabase. Without this flag, runs a full dry-run only.",
    )
    parser.add_argument("--workers", type=int, default=2, help="Thread pool size (default 2, max 2 for free tier)")
    parser.add_argument("--config", default=None, help="Path to config.yaml")
    args = parser.parse_args()

    page_start = page_end = None
    if args.mode in MULTI_CARD_MODES:
        if not args.pages:
            parser.error(f"--mode {args.mode} requires --pages START-END")
        if not args.unit_title:
            parser.error(f"--mode {args.mode} requires --unit-title")
        try:
            start_str, end_str = args.pages.split("-", 1)
            page_start, page_end = int(start_str), int(end_str)
        except ValueError:
            parser.error("--pages must be START-END, e.g. --pages 12-30")

    cfg = load_config(args.config) if args.config else load_config()

    DRY_RUN_DIR.mkdir(exist_ok=True)
    FLAGGED_DIR.mkdir(exist_ok=True)
    run_stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    dry_run_path = DRY_RUN_DIR / f"{run_stamp}.jsonl"
    flagged_path = FLAGGED_DIR / f"{run_stamp}.jsonl"

    if args.mode in MULTI_CARD_MODES:
        _run_multi_card(args, cfg, page_start, page_end, dry_run_path, flagged_path)
        return

    verse_regex = args.verse_regex or cfg.verse_regex

    print(f"📄 Extracting text from {args.pdf}...")
    pages = extract_pages(args.pdf)
    print(f"   {len(pages)} pages with text")

    print(f"🔪 Chunking (mode={args.mode})...")
    chunks = chunk_pages(pages, args.mode, verse_regex, cfg.min_chunk_chars)
    if args.limit:
        chunks = chunks[: args.limit]
    total = len(chunks)
    print(f"   {total} chunks")

    client = None
    ingest_card = None
    if args.commit:
        from ingest import _get_client, ingest_card as _ingest_card  # only connect when committing
        client = _get_client(cfg)
        ingest_card = _ingest_card

    # ── Shared state for concurrent workers ───────────────────────────────────
    file_lock = threading.Lock()         # guards dry_run + flagged file writes
    print_lock = threading.Lock()        # guards stdout so lines don't interleave
    counter_lock = threading.Lock()
    stop_event = threading.Event()       # set on BudgetExceeded to drain pool early

    counters: dict[str, int] = {"inserted": 0, "skipped": 0, "flagged": 0, "errors": 0}

    def _print(*a: object) -> None:
        with print_lock:
            print(*a, flush=True)

    def _inc(key: str) -> None:
        with counter_lock:
            counters[key] += 1

    # ── Per-chunk worker ──────────────────────────────────────────────────────
    def process_chunk(indexed_chunk: tuple[int, object]) -> None:
        i, chunk = indexed_chunk
        if stop_event.is_set():
            return

        _print(f"\n🧠 [{i}/{total}] {chunk.mode} chunk — {chunk.citation_label}")

        # 1. LLM structuring (Gemini call)
        try:
            card = structure_chunk(chunk, cfg)
        except BudgetExceeded as e:
            _print(f"🛑 {e}")
            stop_event.set()
            return
        except Exception as e:  # noqa: BLE001
            _print(f"❌ LLM structuring failed, flagging: {e}")
            with file_lock:
                with open(flagged_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps({"citation_label": chunk.citation_label, "reason": str(e)}) + "\n")
            _inc("flagged")
            time.sleep(SLEEP_PER_CALL)  # pace even on error — call still happened
            return

        # 2. Pace after Gemini call to stay under 15 RPM
        time.sleep(SLEEP_PER_CALL)

        # 3. Validate
        result = validate_card(chunk, card, cfg)
        if not result.passed:
            _print(f"⚠️  Failed validation: {result.reasons}")
            with file_lock:
                with open(flagged_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps({
                        "citation_label": chunk.citation_label,
                        "reasons": result.reasons,
                        "content": card.content,
                        "original_verse": card.original_verse,
                    }, ensure_ascii=False) + "\n")
            _inc("flagged")
            return

        # 4a. Dry run — write output, don't touch Supabase
        if not args.commit:
            with file_lock:
                with open(dry_run_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps({
                        "citation_label": chunk.citation_label,
                        "page_number": chunk.page_number,
                        "mode": chunk.mode,
                        "content": card.content,
                        "original_verse": card.original_verse,
                    }, ensure_ascii=False) + "\n")
            _print("✅ Passed validation (dry-run — not written to Supabase)")
            return

        # 4b. Commit — insert into Supabase
        outcome = ingest_card(
            client, chunk, card,
            deck_id=args.deck_id,
            book_title=args.book_title,
        )
        if outcome.status == "inserted":
            _print(f"✅ Inserted card {outcome.card_id}")
            _inc("inserted")
        elif outcome.status == "skipped_duplicate":
            _print(f"⏭️  Skipped (already exists): {outcome.detail}")
            _inc("skipped")
        else:
            _print(f"❌ Insert failed: {outcome.detail}")
            _inc("errors")

    # ── Thread pool ───────────────────────────────────────────────────────────
    n_workers = min(args.workers, 2)  # cap at 2 — free tier can't sustain more
    print(f"\n⚡ Processing with {n_workers} worker(s), {SLEEP_PER_CALL}s pace delay per call...")
    if not args.commit:
        print("   DRY RUN — nothing will be written to Supabase\n")

    with ThreadPoolExecutor(max_workers=n_workers) as executor:
        executor.map(process_chunk, enumerate(chunks, start=1))

    # ── Summary ───────────────────────────────────────────────────────────────
    print("\n" + "=" * 50)
    print("SUMMARY")
    print(f"  Chunks processed:  {total}")
    if args.commit:
        print(f"  Inserted:          {counters['inserted']}")
        print(f"  Skipped (dupes):   {counters['skipped']}")
        print(f"  Insert errors:     {counters['errors']}")
    else:
        print(f"  Dry-run output:    {dry_run_path}")
    print(f"  Flagged:           {counters['flagged']}  → {flagged_path if counters['flagged'] else '(none)'}")
    print(f"  Daily LLM budget:  {cfg.daily_call_budget} calls (see .llm_call_budget.json for usage)")
    print("=" * 50)
    if not args.commit:
        print("\nThis was a DRY RUN. Nothing was written to Supabase.")
        print(f"Review {dry_run_path} and re-run the same command with --commit.")


if __name__ == "__main__":
    main()
