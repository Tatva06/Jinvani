# Jinvani — Audit v2 (Regression Check + ML Pipeline Integration)

Baseline: `AUDIT_REPORT.md` (this repo root), produced against the working tree before `ml_pipeline/` existed. This audit re-verifies every finding from that report against the current code, then audits the new `ml_pipeline/` directory. All paths are repo-root-relative. Every finding below was confirmed by reading the cited file directly in this session — none are inferred from filenames or from the prior report's claims.

---

## Part 1 — Regression check against AUDIT_REPORT.md

| # | Prior finding | Status | Evidence | Note |
|---|---|---|---|---|
| 1 | **[Critical]** Live Supabase URL + anon key committed in `backend/.env.example` | **Fixed** | `backend/.env.example:1-2` now reads `SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co` / `SUPABASE_KEY=YOUR_SUPABASE_ANON_KEY`. `git log --all -p` and a full-tree grep for the leaked project ref return no hits in any tracked or trackable file, in `ml_pipeline/`, or anywhere in git history. `backend/.env` is still gitignored (`.gitignore:19`). | See residual note below — the ref still exists in one place. |
| 2 | **[High]** No React error boundary; unguarded `content` shape from API can crash the app | **Not Fixed** | `mobile/app/_layout.tsx` still renders `<Stack>` with no boundary (search for `ErrorBoundary`/`componentDidCatch` across `mobile/src` and `mobile/app` returns nothing). `mobile/src/api/client.ts:34` is unchanged: `content: c.content \|\| {}`. `mobile/app/(tabs)/index.tsx:33,58,60,80` still dereference `content.title`/`.body`/`.takeaway` with no guard. | File-for-file identical to the version audited previously. |
| 3 | **[High]** Sliding-window ±2 memory strategy and card-flip animation don't exist; no pagination | **Not Fixed** | `grep` for `useSharedValue\|useAnimatedStyle\|withTiming\|Gesture\.\|PanGestureHandler` across `mobile/src`/`mobile/app` returns nothing (same as before). `FlashList` in `index.tsx:171-182` still has no `onEndReached`. `useFeedStore.cards` (`useFeedStore.ts:7,18`) is still one flat in-memory array with no windowing. | Untouched since last audit. |
| 4 | **[High]** Trilingual support covers content only; chrome hardcoded English; no bundled Devanagari/Gujarati font | **Not Fixed** | `settings.tsx` and `topics.tsx` still don't read `language` for their own text (`grep "language\|Language"` shows only the store hook and the `Language` type import — no chrome-string translation). No `.ttf`/`.otf` assets and no `expo-font`/`useFonts` usage anywhere (re-confirmed via search). | Untouched. |
| 5 | **[High]** Uncommitted downgrade: Expo 57→54, RN 0.86.2→0.81.5, `react-native-mmkv` dropped for AsyncStorage, contradicting `mobile/AGENTS.md` | **Not Fixed** | `mobile/package.json` still shows `"expo": "~54.0.37"`, `"react-native": "0.81.5"`, `"react": "19.1.0"`, `"typescript": "~5.8.0"`, no `react-native-mmkv` entry, and `@react-native-async-storage/async-storage` present (still declared twice — see below). `git diff mobile/package.json` against `HEAD` shows the same downgrade as before, still uncommitted. | Untouched — still sitting in the working tree unresolved. |
| 6 | Bookmarks endpoint dead end-to-end; `books`/`glossary_terms`/`training_feedback` missing from schema | **Not Fixed** | `git diff backend/schema.sql` against `HEAD` is empty (byte-identical). `grep -rl bookmark mobile/src mobile/app` still returns nothing. No `books`, `glossary_terms`, or `training_feedback` table anywhere in `backend/schema.sql`. | Untouched. Note: `ml_pipeline/ingest.py` also never touches `public.users`, so the bookmarks dead-end is unaffected by the new pipeline. |

**Residual note on #1 (resolved):** the prior report (`AUDIT_REPORT.md`) originally quoted the leaked ref/key verbatim, which would have re-introduced them into git history the moment it was committed. Both `AUDIT_REPORT.md` and this file (which separately quoted `ml_pipeline/.env`'s live Gemini key and Supabase service-role key) have been redacted before staging. The anon key and the `ml_pipeline` Gemini/service-role keys should still be rotated regardless — they existed in plaintext (in a diff, and in these now-redacted report drafts) once, and rotation is the only way to be certain they're dead.

---

## Part 2 — ML Pipeline integration audit

### Isolation — confirmed correct

- `ml_pipeline/venv/` is a separate virtualenv from `backend/venv/` (verified: `ml_pipeline/venv/lib/python3.9/site-packages/` and `backend/venv/lib/python3.9/site-packages/` are distinct directory trees with independently installed packages). Both are gitignored (`.gitignore:17` for `backend/venv/`, `.gitignore:39` for `ml_pipeline/venv/`, plus `ml_pipeline/.gitignore:5` for its own `venv/`).
- Both environments happen to have resolved `pydantic==2.13.4` independently — no conflict either way, but the isolation means it wouldn't matter if they'd diverged. `ml_pipeline/requirements.txt` (5 lines: `PyMuPDF`, `google-genai`, `supabase`, `python-dotenv`, `pyyaml`) pins no versions, same unpinned-floor pattern already flagged for `backend/requirements.txt` in the prior audit — **[Low]**, consistent pre-existing pattern, not a new regression.

### Secrets

- `ml_pipeline/.env` exists and contains real credentials:
  ```
  GEMINI_API_KEY=[REDACTED]
  SUPABASE_URL=https://[REDACTED-PROJECT-REF].supabase.co
  SUPABASE_KEY=[REDACTED-SERVICE-ROLE-KEY, sb_secret_... prefix]
  ```
  Confirmed correctly gitignored via `ml_pipeline/.gitignore:2` (`.env`) — `git check-ignore -v ml_pipeline/.env` confirms it, and `git add -n ml_pipeline/` (dry-run) does **not** stage it. `ml_pipeline/.env.example` is clean (`GEMINI_API_KEY=`, `SUPABASE_URL=`, `SUPABASE_KEY=` — no real values). **No leak.**
- **[Medium — new, informational]** The `SUPABASE_KEY` here uses the `sb_secret_...` prefix, Supabase's newer service-role-equivalent key format (bypasses RLS entirely), not the `anon` key format used by `backend/.env`. This is a materially more powerful credential than the one leaked in the prior audit's finding #1 — correctly gitignored today, but worth calling out explicitly since it sits in a local `.env` on a contributor machine with full read/write over every RLS-protected table. No hardcoded keys were found inside any `.py` file (`config.py:39-41` loads all three exclusively via `os.getenv(...)`, confirmed by reading the file).
- **[Medium — new]** `ml_pipeline/Shaakahaar - English v1.pdf` (2.3 MB source book) is **not** excluded by `ml_pipeline/.gitignore` — `git add -n ml_pipeline/` confirms it would be staged. Committing a full copy of what appears to be a published book's text into git history is both a repo-bloat and a potential copyright/licensing concern, independent of the Supabase-secrets question. Recommend adding `*.pdf` (or a specific `/sources/` exclusion) to `ml_pipeline/.gitignore`.

### Schema alignment — field by field (`ingest.py:77-86` row dict vs. `backend/schema.sql:58-79`)

| Field written by `ingest.py` | Schema column | Match? |
|---|---|---|
| `deck_id` (CLI-supplied UUID string) | `deck_id UUID NOT NULL REFERENCES decks(id)` | ✓ type-compatible; existence of the deck is never verified by the pipeline (see below) |
| `sequence_order` (`i`, run-local 1-based index — `run.py:184`) | `sequence_order INTEGER NOT NULL`, part of `UNIQUE (deck_id, sequence_order)` (`schema.sql:72`) | ✓ type, **✗ value derivation — see High finding below** |
| `card_type`: `"chunked_verse"` if verse else `"summary"` (`ingest.py:80`) | `card_type_enum AS ENUM ('summary', 'chunked_verse')` (`schema.sql:58`) | ✓ exact string match on both enum members |
| `citation_reference`: `f"{book_title}, {chunk.citation_label}"` (`ingest.py:67`) | `citation_reference TEXT` (nullable) | ✓ compatible, pipeline always supplies a non-null value |
| `source_page_number`: `chunk.page_number` (int) | `source_page_number INTEGER` (nullable) | ✓ |
| `status`: always `"pending_review"` (`ingest.py:83`) | `card_status_enum AS ENUM ('draft', 'pending_review', 'approved')` (`schema.sql:59`) | ✓ exact match |
| `content`: validated dict, all 3 langs guaranteed present (see below) | `content JSONB NOT NULL DEFAULT '{}'` (`schema.sql:69`) | ✓ |
| `original_verse`: dict or `None` | `original_verse JSONB` (nullable) | ✓ |
| `is_scholar_verified` | **does not exist as a column in `schema.sql`** | N/A — `ingest.py`'s row dict (`ingest.py:77-86`) also never includes this field. Both sides agree by omission; this concept simply hasn't been built into the schema yet, consistent with the prior audit's finding that no scholar-review workflow exists. |

No mismatch in enum values or column types was found. The one real defect is in **how `sequence_order`'s value is computed**, not its type:

- **[High — new]** `run.py:184`: `executor.map(process_chunk, enumerate(chunks, start=1))` — every run numbers its own chunks `1..N` from scratch and passes that number straight through to `ingest_card(..., sequence_order=i)` (`run.py:161-166`). Nothing queries the target deck for its current max `sequence_order` before assigning. Since `cards_deck_order_unique UNIQUE (deck_id, sequence_order)` (`schema.sql:72`) is a real DB constraint, this will produce a hard insert failure (`23505`, caught generically as `except Exception` in `ingest_card`, `ingest.py:88-99`, and logged as an `"error"` event rather than halting the run) the moment the target deck already has a card at that same `sequence_order` — for example the exact deck seeded by `backend/seed_extra_cards.sql` (`sequence_order` 2–5 against deck `11111111-1111-1111-1111-111111111111`), or any deck the pipeline has already committed cards into during a prior run with different `--limit`/page coverage. This wasn't triggered in the observed sample run only because both successful inserts happened to land in a deck (`90bf1d3e-d82b-4aef-ba9d-1696265d80ae`) that had no pre-existing cards. It will trigger the moment the pipeline is pointed at a deck that already has content — which is the normal case for adding a second chapter to an existing book.

### `decks` dependency — confirmed no `books`-table assumption

- `ingest.py` never queries or writes the `decks` table at all; `--deck-id` (`run.py:46`) is taken as an opaque, already-existing UUID, and `--book-title` (`run.py:47`) is used only to build the `citation_reference` string (`ingest.py:67`) — never persisted against `decks.book_id`. This is consistent with the prior audit's finding that `decks.book_id` is a bare `TEXT` column with no FK — the pipeline correctly makes no assumption of a `books` table existing.
- **[Low/Medium]** Gap: nothing in the pipeline or `ml_pipeline/README.md` creates the target `decks` row for a brand-new book — an operator must `INSERT` it manually via SQL first, and this precondition isn't documented anywhere in the README's "Workflow" section (`ml_pipeline/README.md`, "Workflow — always dry-run a new book first").

### RLS dependency — confirmed via live evidence, not just static review

`ml_pipeline/run_log.jsonl` contains real run history. The first three entries:
```json
{"event": "error", "citation_reference": "Shaakahaar, p. 2", "error": "{'message': 'new row violates row-level security policy for table \"cards\"', 'code': '42501', ...}", "timestamp": "2026-08-24T10:18:03..."}
```
repeated 3 times, before the first successful `"event": "inserted"` at `10:24:55`. `backend/schema.sql:124-145` defines **zero INSERT policies** on `public.cards` for any role — the only way `ingest_card`'s `.insert()` (`ingest.py:89`) can ever succeed is with a service-role key that bypasses RLS entirely, which is exactly what `ml_pipeline/.env`'s `sb_secret_...` key is. This is expected, correct Postgres behavior, not a pipeline bug — but:
- **[Medium]** Neither `ml_pipeline/README.md`'s Setup section nor `.env.example` says anything about needing the *service-role* key specifically (as opposed to the anon key `backend/.env` uses) — the observed 3x RLS failures in the log are exactly the failure mode of a contributor reasonably assuming the same key type as the backend would work here too.

### Evidence of actual runs — sampled and sanity-checked

`ml_pipeline/dry_run/20260824T101552Z.jsonl` (3 entries, all `mode=concept`, page 2 of the Shaakahaar PDF) — all three have `en`/`hi`/`gu` populated with non-empty `title`/`body`/`takeaway`, and word counts land inside `config.yaml`'s configured bounds (`en: [60,140]`, `hi: [50,110]`, `gu: [50,100]`):

| Entry | en words | hi words | gu words |
|---|---|---|---|
| 1 | 98 | 97 | 77 |
| 2 | 109 | 88 | 72 |
| 3 | 106 | 95 | 72 |

All within bounds — consistent with these being post-`validate_card` output, since only passing cards reach `dry_run/`.

- **[Medium — new] Zero verse-mode chunks appear anywhere in the observed output.** All 3 `dry_run` entries and all 5 `flagged` entries across all three flagged files are `mode=concept` (or, for the flagged ones, failed before mode was recorded but originate from the same `p. 2`/`p. 3` pages). `config.yaml:13`'s `verse_regex: "Sutra\\s+\\d+\\.\\d+"` is tuned for Tattvartha-Sutra-style citations (matching the original seed data's `"Chapter 1, Sutra 2"` labels) — but the book actually being processed is `"Shaakahaar - English v1.pdf"`, a vegetarianism-themed text with no evident reason to use `"Sutra X.Y"` markers. `chunk_auto` (`chunk.py:96-127`) silently routes any page with zero regex matches to 100%-concept chunking with no warning emitted anywhere. **Practical consequence:** if this book contains any material that should be preserved verbatim (a quoted verse, a canonical line), it is currently being run through the concept prompt (`temperature_concept: 0.4`, modern-takeaway paraphrasing style, `structure.py:54-75`) instead of the verse prompt (`temperature_verse: 0.0`, literal-translation-only, `structure.py:33-52`) — and `validate.py`'s verse-similarity check (`validate.py:55-67`), the mechanism specifically built to catch a model rewriting scripture instead of preserving it, never runs at all, because it only fires when `chunk.mode == "verse"` in the first place. The pipeline's single most emphasized safety property (per its own module docstrings) is silently inapplicable to this book with no signal that this happened.
- Two real Supabase inserts are recorded: `"Shaakahaar, p. 2"` → card `9d127f0b-aa25-4642-81c9-ee02d235a059`, and `"Shaakahaar, p. 3"` → card `a97f6d81-55ef-459c-ac56-b94d7e76c8f7`, both against deck `90bf1d3e-d82b-4aef-ba9d-1696265d80ae`, both `status="pending_review"` per `ingest.py:83`. No DB access was available in this session to query the live `cards` table directly and confirm these two rows' actual stored shape — the safety claim below is a static-code-path conclusion, not a verified-live-row conclusion.
- **[Low, positive]** The crash path from Part 1 finding #2 cannot originate from a pipeline-inserted row, by construction: `_validate_llm_shape` (`structure.py:121-131`) raises before `structure_chunk` can return if any of `content.{en,hi,gu}.{title,body,takeaway}` is missing/empty, and `validate_card` (`validate.py:34-53`) independently re-checks the same before `run.py:132-144` will allow either a `dry_run/` write or a `--commit` insert. A card that fails either check goes to `flagged/`, never to Supabase. So the two rows above are guaranteed (by code path, not by direct observation) to have all three languages present. The residual risk is entirely non-pipeline writes — manual SQL (`backend/seed_extra_cards.sql`, spot-checked: all 4 of its rows do populate `en`/`hi`/`gu`) or a future scholar-review UI that doesn't reuse this validation.

### Race / idempotency — confirmed real gap, distinct from what was observed

- `ingest.py:47-56`'s `_already_exists` is a plain `SELECT ... LIMIT 1` before the `INSERT` (`ingest.py:69,89`) — an app-level TOCTOU check. `backend/schema.sql`'s only unique constraint touching `cards` is `cards_deck_order_unique UNIQUE (deck_id, sequence_order)` (`schema.sql:72`) — there is **no** unique index on `(deck_id, citation_reference)`.
- The log shows this check working correctly across ~13 consecutive re-runs of the same chunk (all logged as `"skipped_duplicate"` between `10:25` and `10:33`) — but these are sequential retries, not concurrent processes; the SELECT-then-INSERT window was never actually raced in the observed sample.
- **[Medium]** The gap the prior review point raises is still real and unaddressed: two genuinely concurrent `--commit` invocations (e.g., a second run started before the first finishes, plausible given each run already spins up 2 worker threads and can take many minutes per `SLEEP_PER_CALL=5.0`-paced call) could both pass the `SELECT` check before either `INSERT` commits, producing two `cards` rows with identical `citation_reference`. Nothing in the current schema would reject the second one. **Fix:** add `UNIQUE (deck_id, citation_reference)` to `cards` (or a partial unique index), which would also make the existing app-level check redundant-but-safe rather than the only line of defense.

### New concurrency bug found in this pass (not in the user's checklist, found via code reading)

- **[High — new]** `_check_and_increment_budget` (`structure.py:98-110`) does a plain `_load_budget_state()` → check → `state["count"] += 1` → `_save_budget_state(state)` read-modify-write cycle on `.llm_call_budget.json`, with **no lock**. `run.py` explicitly defines and uses `file_lock`, `print_lock`, and `counter_lock` (`run.py:89-91`) to guard exactly this class of shared-state race across its `ThreadPoolExecutor(max_workers=n_workers)` (`run.py:183-184`, up to 2 concurrent workers) — but the budget-counter file has no equivalent guard, even though `_check_and_increment_budget` is called from `structure_chunk`, which both worker threads call concurrently. With 2 threads both reading `count=N` before either writes back, the file can advance to `N+1` once instead of `N+2` for two calls that both actually happened — **undercounting real Gemini API usage**, which is the opposite direction of safe: it makes the self-imposed `daily_call_budget` cap *less* protective than its already-miscalibrated value (see below), not more.

### Cost/quota calibration — live evidence of a broken assumption

- `config.yaml:6`: `daily_call_budget: 200`. `ml_pipeline/.llm_call_budget.json` currently reads `{"date": "2026-08-24", "count": 45}` — well under the pipeline's own 200 cap. But `ml_pipeline/flagged/20260824T103025Z.jsonl` records a live `429 RESOURCE_EXHAUSTED` from Google whose payload explicitly states `'quotaId': 'GenerateRequestsPerDayPerProjectPerModel-FreeTier'`, `'quotaValue': '20'` — i.e., **the real enforced daily cap for this API key/model is 20 requests/day**, not 200. The pipeline had already made 45 calls today (`.llm_call_budget.json`) by the time this audit ran, more than double the cap Google is actually enforcing.
- **[High]** Compounding this: `flagged/20260824T101249Z.jsonl` and `flagged/20260824T104902Z.jsonl` both show `404 NOT_FOUND` for the pinned model: `'This model models/gemini-2.5-flash is no longer available to new users. Please update your code to use models/gemini-3.6-flash'` (`config.yaml:3` still pins `models/gemini-2.5-flash`). Google appears to be transparently redirecting the deprecated model name server-side to `gemini-3.6-flash` for some calls (the 429's quota payload names `gemini-3.6-flash`, not the configured `gemini-2.5-flash`) — a model swap the pipeline has no visibility into, whose real free-tier quota (20/day) is far stricter than the `15 RPM` figure `run.py:36-40`'s rate-limiting comments and `daily_call_budget: 200` were designed around. **Net effect: the pipeline's cost/quota protection does not reflect the API's actual current behavior for this key, and — per the race condition above — even its own internal counter isn't reliably tracking the calls it does make.**

---

## Part 3 — Other new findings since the last audit

Beyond `ml_pipeline/` itself, `git status` shows no other new files: no new mobile screens, no new backend routes, no schema changes outside what's covered above. The only other change is `.gitignore`, which gained a correct new `ml_pipeline/` section (`.gitignore:34-46`, covered in Part 2). Everything substantive that's new lives in `ml_pipeline/` and is covered in Part 2; the two items below are cross-cutting observations that don't fit neatly under the user's Part 2 checklist:

- **[Low]** `structure_chunk` (`structure.py:138`) constructs a new `genai.Client(api_key=...)` on every single call rather than once per run — harmless at this scale (2 workers, 5s pacing) but worth folding into a shared client if call volume ever grows.
- **[Low]** `ml_pipeline/requirements.txt` has no version pins at all (same pattern as `backend/requirements.txt`, already flagged in the prior audit) — a fresh `pip install -r requirements.txt` today vs. in three months could resolve a materially different `google-genai`, which is a fast-moving SDK; combined with the model-name churn already observed live in `flagged/` (see Part 2), this is a real reproducibility risk, not just a style nit.

---

## Part 4 — Updated top-5 issues, ranked

| Rank | Severity | Issue | Status |
|---|---|---|---|
| 1 | **High** | No React error boundary anywhere in the mobile app; `api/client.ts:34`'s `content: c.content \|\| {}` plus direct `content.title/body/takeaway` access in `index.tsx:58,60,80` can still crash the whole app on one malformed row. | **Carried over** (§Part 1, item 2) |
| 2 | **High** | `ml_pipeline` assigns `sequence_order` as a run-local 1-based index (`run.py:184`) rather than deriving it from the target deck's existing rows — will hard-fail every insert (`23505` on `cards_deck_order_unique`) the moment the pipeline is pointed at a deck that already has cards, e.g. the exact deck seeded by `backend/seed_extra_cards.sql`. | **New** (§Part 2) |
| 3 | **High** | Sliding-window ±2 memory strategy and card-flip animation still don't exist anywhere in the mobile app; `reanimated`/`worklets`/`gesture-handler` remain installed with zero call sites; no `onEndReached` pagination. | **Carried over** (§Part 1, item 3) |
| 4 | **High** | Trilingual coverage still stops at card content — Settings/Topics/"Key Takeaway" chrome is hardcoded English regardless of selected language, and no Devanagari/Gujarati font is bundled. | **Carried over** (§Part 1, item 4) |
| 5 | **High** | The pipeline's core scripture-fidelity safety property — literal translation, never paraphrase, for verse content — silently never engages for the book actually being ingested: zero `mode="verse"` chunks appear anywhere in `dry_run/`/`flagged/` output, because `config.yaml`'s default `verse_regex` (tuned for `"Sutra X.Y"`-style citations) has no reason to match a book titled "Shaakahaar." Nothing warns that this happened. | **New** (§Part 2) |

**Just below the cut, still real:** the uncommitted Expo 57→54 / RN 0.86.2→0.81.5 / MMKV-dropped regression (**Carried over**, High, §Part 1 item 5); the LLM daily-budget miscalibration compounded by an unlocked concurrent-write race on `.llm_call_budget.json` (**New**, High, §Part 2); the missing `UNIQUE (deck_id, citation_reference)` DB constraint backing only an app-level duplicate check (**New**, Medium, §Part 2); and the dead `/bookmarks` endpoint plus missing `books`/`glossary_terms`/`training_feedback` tables (**Carried over**, Medium-High, §Part 1 item 6).

---

## Part 5 — What blocks a working demo today

**Fixed since last time, no longer blocking:**
- The committed secret leak (prior finding #1) — resolved. (Residual: redact `AUDIT_REPORT.md` before committing it, and still rotate the once-exposed anon key out of caution.)

**Blocks a demo today, or blocks trusting what the demo shows:**
- **The crash risk (rank #1 above)** remains latent rather than actively triggering — static review of the current pipeline code shows the two rows it has actually inserted so far are guaranteed well-formed by validation, and no DB access was available this session to check for other, non-pipeline rows. It should still be fixed before demoing anything that depends on unreviewed or hand-edited card content, since one bad row (manual SQL, a future CMS) is one `git`-diff away from being possible again.
- **The `sequence_order` collision bug (rank #2)** directly blocks the most natural "grow the existing content" demo step — ingesting a new chapter into a deck that already has cards (including the very deck `backend/seed_extra_cards.sql` seeded). It will not silently corrupt data (the insert fails cleanly and is logged as an error), but it will silently *under-deliver* — a batch run against a non-empty deck will drop rows with no top-level failure signal beyond a per-row log line.
- **The verse-regex silent bypass (rank #5)** doesn't crash anything or block a demo mechanically, but it does mean any claim that "verse content is preserved literally, never paraphrased" is unverified for whatever book is actually being shown — worth confirming before presenting Shaakahaar-sourced cards as scripturally faithful, or before promoting any of its `pending_review` rows to `approved`.

**Later-stage, non-blocking for a first walkthrough:** card-flip animation, feed pagination/windowing, chrome i18n, bundled fonts, the Expo/MMKV dependency question, test coverage, CORS hardening, the missing `glossary_terms`/`training_feedback`/`books` tables and scholar-only RLS tier, the DB-level duplicate-citation constraint, the LLM budget/quota calibration, and the unlocked budget-counter race. The three-tab mobile flow and the two live pipeline-ingested cards both function correctly on their respective happy paths today.
