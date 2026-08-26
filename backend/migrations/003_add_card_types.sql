-- =============================================================================
-- 003 · Add card_type_enum values for the new ingestion modes
--
-- NOT auto-applied. Review, then run this yourself in the Supabase SQL
-- Editor (or via `psql`) against your project.
--
-- Adds the three new card types the ml_pipeline ingestion modes now
-- produce (see ml_pipeline/structure.py, ml_pipeline/ingest.py):
--   - 'verbatim'  — --mode verbatim  (Type 3: original book, unmodified)
--   - 'digest'    — --mode digest    (Type 1: compressed essential ideas)
--   - 'narrative' — --mode narrative (Type 5: story broken into cards)
--
-- Postgres requires each ALTER TYPE ... ADD VALUE to run in its own
-- transaction (they can't be added inside the same transaction as a
-- later statement that uses the new value) — the Supabase SQL Editor
-- runs each statement in the script as its own implicit transaction,
-- which satisfies this; if running via psql in a single explicit
-- transaction block instead, split these into separate `\c` sessions or
-- run the script un-wrapped.
-- =============================================================================

ALTER TYPE card_type_enum ADD VALUE IF NOT EXISTS 'verbatim';
ALTER TYPE card_type_enum ADD VALUE IF NOT EXISTS 'digest';
ALTER TYPE card_type_enum ADD VALUE IF NOT EXISTS 'narrative';

-- ─── Verification query — run after applying, not part of the migration ───
-- select enumlabel from pg_enum
--   where enumtypid = 'card_type_enum'::regtype order by enumsortorder;
