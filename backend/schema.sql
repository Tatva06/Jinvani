-- =============================================================================
-- Jinvani · PostgreSQL Schema
-- Run this in the Supabase SQL Editor (or psql) in order.
-- All tables use UUIDs as primary keys and include created_at timestamps.
-- Extensions expected: pgcrypto (for gen_random_uuid) — enabled by default
-- in Supabase.
-- =============================================================================

-- ─── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- =============================================================================
-- 1. users
--    Mirrors auth.users — stores app-level preferences per authenticated user.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_id             UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    preferred_language  TEXT        NOT NULL DEFAULT 'en'
                        CHECK (preferred_language IN ('en', 'hi', 'gu')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.users                    IS 'App-level user profiles mirroring auth.users.';
COMMENT ON COLUMN public.users.auth_id            IS 'References auth.users.id — one-to-one.';
COMMENT ON COLUMN public.users.preferred_language IS 'ISO 639-1 code; drives default language on feed load.';


-- =============================================================================
-- 2. decks
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.decks (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id         TEXT        NOT NULL,
    sequence_order  INTEGER     NOT NULL,
    title           TEXT        NOT NULL,
    topic_tag       TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT decks_book_order_unique UNIQUE (book_id, sequence_order)
);

CREATE INDEX IF NOT EXISTS idx_decks_book_id        ON public.decks (book_id);
CREATE INDEX IF NOT EXISTS idx_decks_sequence_order ON public.decks (sequence_order);

COMMENT ON TABLE  public.decks IS 'Thematic groupings of cards, ordered within a source book.';


-- =============================================================================
-- 3. cards
--
--  content JSONB shape:
--    { "en": { "title": "...", "body": "...", "takeaway": "..." }, ... }
--
--  original_verse JSONB shape (nullable):
--    { "script": "Sanskrit · Devanāgarī", "text": "सम्यग्..." }
-- =============================================================================
CREATE TYPE card_type_enum   AS ENUM ('summary', 'chunked_verse');
CREATE TYPE card_status_enum AS ENUM ('draft', 'pending_review', 'approved');

CREATE TABLE IF NOT EXISTS public.cards (
    id                  UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
    deck_id             UUID              NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
    sequence_order      INTEGER           NOT NULL,
    card_type           card_type_enum    NOT NULL DEFAULT 'summary',
    citation_reference  TEXT,
    source_page_number  INTEGER,
    status              card_status_enum  NOT NULL DEFAULT 'draft',
    content             JSONB             NOT NULL DEFAULT '{}'::JSONB,
    original_verse      JSONB,
    created_at          TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    CONSTRAINT cards_deck_order_unique UNIQUE (deck_id, sequence_order)
);

CREATE INDEX IF NOT EXISTS idx_cards_status      ON public.cards (status);
CREATE INDEX IF NOT EXISTS idx_cards_deck_seq    ON public.cards (deck_id, sequence_order);
CREATE INDEX IF NOT EXISTS idx_cards_content_gin ON public.cards USING GIN (content);

COMMENT ON TABLE  public.cards IS 'Atomic scripture cards; one card = one swipe.';


-- =============================================================================
-- 4. user_stash — cross-device bookmarks
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.user_stash (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    card_id     UUID        NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT user_stash_unique_bookmark UNIQUE (user_id, card_id)
);

CREATE INDEX IF NOT EXISTS idx_user_stash_user_id ON public.user_stash (user_id);
CREATE INDEX IF NOT EXISTS idx_user_stash_card_id ON public.user_stash (card_id);

COMMENT ON TABLE public.user_stash IS 'Cross-device bookmarks: one row = one saved card per user.';


-- =============================================================================
-- 5. telemetry_events — append-only engagement log
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.telemetry_events (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        REFERENCES public.users(id) ON DELETE SET NULL,
    session_id      UUID        NOT NULL,
    event_name      TEXT        NOT NULL,
    card_id         UUID        REFERENCES public.cards(id) ON DELETE SET NULL,
    deck_id         UUID        REFERENCES public.decks(id) ON DELETE SET NULL,
    dwell_time_ms   INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_user_id    ON public.telemetry_events (user_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_session_id ON public.telemetry_events (session_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_event_name ON public.telemetry_events (event_name);
CREATE INDEX IF NOT EXISTS idx_telemetry_created_at ON public.telemetry_events (created_at DESC);

COMMENT ON TABLE public.telemetry_events IS 'Append-only engagement event log. Never UPDATE or DELETE rows.';


-- =============================================================================
-- Row Level Security
-- =============================================================================
ALTER TABLE public.users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stash       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read approved cards"
    ON public.cards FOR SELECT USING (status = 'approved');

CREATE POLICY "Public can read decks"
    ON public.decks FOR SELECT USING (true);

CREATE POLICY "Users manage own stash"
    ON public.user_stash FOR ALL
    USING  (auth.uid() = (SELECT auth_id FROM public.users WHERE id = user_id))
    WITH CHECK (auth.uid() = (SELECT auth_id FROM public.users WHERE id = user_id));

CREATE POLICY "Users read own profile"
    ON public.users FOR SELECT USING (auth.uid() = auth_id);

CREATE POLICY "Anyone can insert telemetry"
    ON public.telemetry_events FOR INSERT WITH CHECK (true);
