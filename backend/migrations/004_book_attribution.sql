-- =============================================================================
-- 004 · Wire decks up to the existing books table + add rights_note
--
-- NOT auto-applied. Review, then run this yourself in the Supabase SQL
-- Editor (or via `psql`) against your project.
--
-- IMPORTANT — this is NOT the migration originally sketched in an earlier
-- session. That draft assumed there was no books table yet and planned to
-- create one with columns author_name/source_url/rights_note. Checked the
-- live database directly before writing this: a `books` table already
-- exists (hand-created in the Supabase dashboard, not tracked by any
-- migration in this repo) with columns id/title/author/tradition_tag/
-- is_public_domain/pdf_url/total_chapters/created_at — different column
-- names, and it's currently completely disconnected from decks (no FK,
-- and backend/routers/books.py + models.py still say "there is no books
-- table"). This migration wires the two together instead of creating a
-- second, competing table.
--
-- Confirmed via direct query: books has exactly one row —
--   id=00000000-0000-0000-0000-000000000001, title='Tattvartha Sutra',
--   author='Acharya Umaswati', tradition_tag='Universal',
--   is_public_domain=true, pdf_url=NULL, total_chapters=10.
--
-- decks.book_id (bare TEXT, no FK) holds exactly three distinct values:
--   - 'Tattvartha Sutra'                       — same book as the row
--     above, just stored as a loose title string instead of its real id.
--   - '00000000-0000-0000-0000-000000000001'   — the row's UUID, but
--     itself stored as TEXT (decks.book_id has no type relationship to
--     books.id at all — this is a coincidental text match, not a
--     working reference).
--   - 'TEST-SEED-BOOK'                         — test/seed data with no
--     corresponding book. Left unlinked (book_id_ref NULL) deliberately
--     — do not invent a books row for this.
--
-- What this migration does:
--   1. decks.book_id_ref — new nullable UUID FK to books.id, added
--      ALONGSIDE the existing decks.book_id TEXT column (not replacing
--      it — nothing currently reading book_id breaks).
--   2. Backfills book_id_ref explicitly for the two decks.book_id text
--      values known to mean the Tattvartha Sutra row (see above) —
--      hardcoded to the confirmed values rather than inferred by
--      regex/type-cast, since we now know the exact reconciliation
--      rather than guessing at it. 'TEST-SEED-BOOK' is not matched by
--      either branch, so it stays NULL, exactly as intended.
--   3. books.rights_note — new nullable TEXT column. Does not exist on
--      the current table (confirmed via schema dump) and the
--      attribution feature needs it. Left NULL here; fill in per book
--      manually.
--
-- Does NOT touch books.pdf_url (stays NULL on the one real row) or
-- invent author/rights_note values for any book — attribution.py's
-- fallback already renders the attribution footer/"Read Complete
-- Original" action correctly with source_url absent (re-verify this
-- specifically after applying, per the current session's ask — it was
-- only ever checked against a row that had no book_id_ref link at all,
-- not against a genuinely-linked row whose pdf_url is null).
-- =============================================================================

ALTER TABLE public.decks
  ADD COLUMN IF NOT EXISTS book_id_ref UUID REFERENCES public.books(id);

UPDATE public.decks
SET book_id_ref = '00000000-0000-0000-0000-000000000001'
WHERE book_id_ref IS NULL
  AND book_id IN ('Tattvartha Sutra', '00000000-0000-0000-0000-000000000001');

-- 'TEST-SEED-BOOK' matches neither literal above, so it's left with
-- book_id_ref = NULL by omission — no separate statement needed, but
-- spelled out here so that's legible as intentional, not an oversight.

CREATE INDEX IF NOT EXISTS idx_decks_book_id_ref ON public.decks (book_id_ref);

ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS rights_note TEXT;

COMMENT ON COLUMN public.decks.book_id_ref IS
  'FK to books.id. Nullable — NULL means this deck''s book_id text has no matching books row yet (add one, then backfill this deck manually).';
COMMENT ON COLUMN public.books.rights_note IS
  'Free-text rights/licensing note shown in the app''s attribution footer (e.g. "Public domain translation" or "Used with permission"). NULL = nothing shown.';

-- ─── Verification queries — run after applying, not part of the migration ───
-- select column_name from information_schema.columns where table_name = 'decks';
-- select column_name from information_schema.columns where table_name = 'books';
--
-- Every non-test deck should now have a non-null book_id_ref; only the
-- TEST-SEED-BOOK deck(s) should show NULL:
-- select id, title, book_id, book_id_ref
--   from public.decks
--   where (book_id_ref is null) != (book_id = 'TEST-SEED-BOOK');
-- -- ^ expect zero rows back. Any row returned here is either a non-test
-- -- deck that failed to backfill, or a test deck that unexpectedly got
-- -- linked.
--
-- select d.id, d.title, d.book_id, d.book_id_ref, b.title as book_title, b.author, b.pdf_url
--   from public.decks d left join public.books b on b.id = d.book_id_ref;
