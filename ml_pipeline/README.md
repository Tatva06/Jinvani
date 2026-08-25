# ML Ingestion Pipeline

Turns a source PDF into trilingual (en/hi/gu) cards in the Supabase `cards`
table — always landing as `status = "pending_review"`, never auto-approved.
There is no scholar CMS yet, so nothing skips human review.

## What changed from the earlier prototype

- **`status` is always `pending_review`**, never `approved`. The scholar
  review gate from the architecture doc wasn't built, so nothing bypasses it.
- **Gujarati (`gu`) is required**, not just `en`/`hi`.
- **Verse text and concept text are handled by separate prompts.** Verse
  (Mode B) chunks get a literal-translation-only prompt with zero
  temperature; concept (Mode A) chunks get the modern-takeaway style with a
  hard word-count instruction. One chunk is never asked to be both.
- **A book that produces zero verse-regex matches now warns loudly**
  instead of silently routing 100% of its content through concept mode.
  This was found happening in production: the default `verse_regex`
  (tuned for "Sutra X.Y" citations) matched nothing in a book with no such
  markers, so the literal-translation safety path never engaged anywhere
  in that run, with no signal that it hadn't. If the book DOES contain
  verses/scripture, fix `--verse-regex` before trusting the output; if it
  genuinely has none, the warning is expected and safe to ignore.
- **`sequence_order` is derived from the target deck's actual current
  state**, not a run-local counter. An earlier version numbered chunks
  `1..N` from scratch every run, which hard-fails (`23505` on
  `cards_deck_order_unique`) the moment you ingest into a deck that
  already has cards — e.g. anything seeded by hand, or a second run adding
  a later chapter. It now re-queries the deck's max `sequence_order`
  immediately before each insert and retries on conflict, which self-heals
  both same-run thread races and races across two separate `--commit`
  invocations.
- **OCR is actually implemented** (`extract.py`, PyMuPDF block-level
  extraction) instead of running against a hardcoded sample string.
- **`citation_reference`, `source_page_number`, `card_type`** are
  populated on every insert.
- **Validation runs before every write** — word-count bounds per language,
  all three languages present, and (for verse chunks) a similarity check
  confirming the model preserved the original text instead of rewriting it.
  Anything that fails goes to `flagged/`, not to Supabase.
- **Idempotent inserts** — a chunk with a citation_reference that already
  exists for that deck is skipped, not duplicated. App-level check only;
  no DB constraint backs it yet — see "Known limitations" below.
- **Dry-run is the default.** Nothing touches Supabase unless you pass
  `--commit`.
- **Daily LLM call budget** tracked locally, behind a thread lock so it
  stays accurate under concurrent workers, so you don't blow past Gemini's
  free-tier daily request cap mid-run.

## Setup

```bash
cd ml_pipeline
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# fill in GEMINI_API_KEY, SUPABASE_URL, SUPABASE_KEY in .env
```

**SUPABASE_KEY must be a service-role key, not the anon key.** `schema.sql`
defines zero INSERT policies on `public.cards` for any role — RLS blocks
every insert from an anon-tier key with `42501: new row violates row-level
security policy`. The `backend/.env` your FastAPI app uses is correctly on
the anon key (it only ever reads `approved` cards); this pipeline needs a
different, more powerful key from the same Supabase project (Settings →
API → service_role / secret key, `sb_secret_...` prefix). That key bypasses
RLS entirely — treat `ml_pipeline/.env` as more sensitive than
`backend/.env`, keep it gitignored, and don't reuse it anywhere else.

**A `decks` row must already exist for the book you're ingesting into.**
This pipeline never creates one — `--deck-id` is taken as an
already-existing UUID. `decks.book_id` is a bare `TEXT` column with no FK,
so create the deck manually (matching SQL to whatever `seed_extra_cards.sql`
used) before your first run against a new book:
```sql
INSERT INTO decks (id, book_id, sequence_order, title, topic_tag)
VALUES (gen_random_uuid(), 'Shaakahaar', 1, 'Shaakahaar', 'Ethics');
```


**SUPABASE_KEY must be a service-role key, not the anon key.** `schema.sql`
defines zero INSERT policies on `public.cards` for any role — RLS blocks
every insert from an anon-tier key with `42501: new row violates row-level
security policy`. The `backend/.env` your FastAPI app uses is correctly on
the anon key (it only ever reads `approved` cards); this pipeline needs a
different, more powerful key from the same Supabase project (Settings →
API → service_role / secret key, `sb_secret_...` prefix). That key bypasses
RLS entirely — treat `ml_pipeline/.env` as more sensitive than
`backend/.env`, keep it gitignored, and don't reuse it anywhere else.

**A `decks` row must already exist for the book you're ingesting into.**
This pipeline never creates one — `--deck-id` is taken as an
already-existing UUID. `decks.book_id` is a bare `TEXT` column with no FK,
so create the deck manually (matching SQL to whatever `seed_extra_cards.sql`
used) before your first run against a new book:
```sql
INSERT INTO decks (id, book_id, sequence_order, title, topic_tag)
VALUES (gen_random_uuid(), 'Shaakahaar', 1, 'Shaakahaar', 'Ethics');
```

## Workflow — always dry-run a new book first

```bash
python run.py \
  --pdf path/to/book.pdf \
  --deck-id 00000000-0000-0000-0000-000000000000 \
  --book-title "Tattvartha Sutra" \
  --mode auto
```

This extracts, chunks, calls the LLM, and validates — but writes nothing to
Supabase. Output lands in two places:

- `dry_run/<timestamp>.jsonl` — cards that passed validation, one JSON
  object per line. **Read these before committing anything.** Check that
  verse chunks were translated literally, not rewritten, and that concept
  chunks read naturally in all three languages.
- `flagged/<timestamp>.jsonl` — cards that failed validation, with the
  specific reason(s) attached (word count out of range, missing language,
  verse text diverged from source, etc). These need either a config
  adjustment (e.g. word bounds too tight for this book) or manual handling
  — they are never silently dropped.

## Promoting to real ingestion

Once you've eyeballed the dry-run output for a book and you're satisfied:

```bash
python run.py \
  --pdf path/to/book.pdf \
  --deck-id 00000000-0000-0000-0000-000000000000 \
  --book-title "Tattvartha Sutra" \
  --mode auto \
  --commit
```

Cards land in Supabase as `pending_review`. They still need a human
(currently: you, manually, until the CMS from Sprint 2 exists) to update
`status` to `approved` before they'd ever be meant to reach end users.

## Chunk modes

- `--mode verse` — every chunk is treated as scripture, split on
  `verse_regex` in `config.yaml` (default matches `"Sutra 1.2"`-style
  markers — override with `--verse-regex` per book if the marker differs).
- `--mode concept` — every chunk is treated as prose, split by paragraph.
- `--mode auto` (default) — each page is routed to verse or concept
  chunking based on whether it contains a verse marker. A coarse heuristic;
  check `dry_run/` output for mis-routed pages on a new book.

## Useful flags

- `--limit N` — only process the first N chunks. Use this to test a new
  book's config (word bounds, verse regex) cheaply before running the
  whole thing and burning your daily LLM budget.
- `--config path/to/other.yaml` — per-book config override, if a book needs
  different word bounds or a different verse marker pattern.

## Notes / known limitations at this scale

- Word counts are whitespace-based, which is a rough proxy for Hindi and
  Gujarati (they don't segment into words via spaces the way English
  does). Good enough to catch gross drift, not a precise linguistic count.
- Verse chunking runs per-page, so a verse spanning a page break gets cut.
  Fine for a 15-book prototype; worth revisiting if it turns out to matter
  for a specific book.
- `run_log.jsonl` accumulates every insert/skip/error across all runs —
  worth rotating or archiving once it grows large.
- The duplicate-citation check (`_already_exists` in `ingest.py`) is an
  app-level SELECT-before-INSERT, not backed by a DB constraint. Two
  genuinely concurrent `--commit` runs could both pass the check before
  either insert lands, producing two rows with the same citation. This
  hasn't been observed in practice but is a real gap — recommended fix,
  not yet applied by this pipeline:
  ```sql
  ALTER TABLE cards ADD CONSTRAINT cards_deck_citation_unique
      UNIQUE (deck_id, citation_reference);
  ```