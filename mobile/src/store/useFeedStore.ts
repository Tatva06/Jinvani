import { create } from 'zustand';
import { SeedCard, Language } from '../types';
import { SEED_CARDS } from '../seedData';
import { fetchFeed, fetchBookCards } from '../api/client';
import { storage } from './mmkvStorage';

const LANGUAGE_KEY = 'app-language';
const DEFAULT_TOPIC_KEY = 'pref-default-topic';
// Type 4 — "Today's Special": the date (YYYY-MM-DD) it was last shown.
// Client-side "seen today" tracking — the backend has no per-user state
// to hang this on (feed is unauthenticated), so this is the simplest
// correct place for it, same MMKV convention as language/theme.
const FEATURED_LAST_SHOWN_KEY = 'featured-last-shown-date';
const PAGE_SIZE = 20;

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD, device-local-enough for "once a day"
}

/** True the first time this is called on a given calendar day; marks the
 * day as shown as a side effect. Deliberately impure (check-and-set) —
 * every caller wants exactly that: "may I show it, and if so, consider it
 * shown now." */
function claimFeaturedSlotForToday(): boolean {
  const today = todayStamp();
  if (storage.getString(FEATURED_LAST_SHOWN_KEY) === today) return false;
  storage.set(FEATURED_LAST_SHOWN_KEY, today);
  return true;
}

// Once the in-memory feed grows past this many cards, trim everything more
// than WINDOW_RADIUS cards behind the active (currently-viewed) card. Cards
// ahead of the active index are never trimmed here — they're the content
// the user is about to scroll into, bounded naturally by how far pagination
// has gotten ahead of them, not by anything that needs capping.
const MAX_CARDS_IN_MEMORY = 120;
const WINDOW_RADIUS = 40;

interface FeedState {
  cards: SeedCard[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  topicFilter: string | null;
  language: Language;
  activeIndex: number;
  hasMore: boolean;
  /** Server-side pagination cursor — tracked separately from cards.length,
   * since windowing can shrink the in-memory array without rewinding how
   * much has actually been fetched from the feed. */
  nextOffset: number;
  /** Personalization preference: the topic filter applied on cold start,
   * absent an explicit URL param. Persisted separately from the live
   * topicFilter, which resets/changes freely during a session. */
  defaultTopic: string | null;
  setTopic: (topic: string | null) => void;
  setLanguage: (lang: Language) => void;
  loadLanguage: () => void;
  setDefaultTopic: (tag: string | null) => void;
  loadFeed: () => Promise<void>;
  loadMore: () => Promise<void>;
  setActiveIndex: (index: number) => void;
  /** Opens a single card (e.g. a tapped search result) as a focused,
   * non-paginated feed — reuses the same feed screen and JinvaniCard
   * rendering rather than a separate detail view. */
  openSingleCard: (card: SeedCard) => void;

  // ─── Sequential reading mode — plays one book's (or one deck/story's)
  // cards in real stored order (deck.sequence_order, then
  // card.sequence_order), reusing this same feed screen/FlashList/
  // JinvaniCard rather than a second card UI. Covers both Book Detail's
  // "Start Reading" (whole book, or verbatim-filtered if the book is
  // verbatim content) and story reading (Type 5 — one deck, card_type
  // filtered to 'narrative') — same mechanism, different scope/filter. ───
  isBookMode: boolean;
  bookModeTitle: string | null;
  startBookReading: (params: {
    bookId: string;
    title: string;
    /** Scope to one deck instead of the whole book — used by story
     * reading, where "the book" isn't the unit being read. */
    deckId?: string;
    /** Filter to one card_type — 'verbatim' for continuous verbatim
     * reading, 'narrative' for a story. Omit for the original
     * all-approved-cards book behavior. */
    cardType?: string;
    startDeckSequenceOrder?: number;
  }) => Promise<void>;
  exitBookMode: () => void;
}

interface FeedSnapshot {
  cards: SeedCard[];
  topicFilter: string | null;
  activeIndex: number;
  hasMore: boolean;
  nextOffset: number;
}

// Snapshot of the normal topic-feed state, taken right before entering book
// mode and restored on exit — kept outside the reactive store state
// (nothing should subscribe to it; it's pure internal bookkeeping) so
// entering/exiting book mode can never silently corrupt normal feed state.
let preBookModeSnapshot: FeedSnapshot | null = null;

function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'hi' || value === 'gu';
}

function dedupeById(cards: SeedCard[]): SeedCard[] {
  const seen = new Set<string>();
  const result: SeedCard[] = [];
  for (const card of cards) {
    if (!seen.has(card.id)) {
      seen.add(card.id);
      result.push(card);
    }
  }
  return result;
}

/** Trims cards more than WINDOW_RADIUS behind activeIndex once the array
 * exceeds MAX_CARDS_IN_MEMORY. Cards are keyed by stable id (FlashList's
 * keyExtractor), so removing from the front doesn't disturb the currently
 * visible items' identity/scroll position. Returns the adjusted index
 * (shifted to stay valid against the trimmed array) alongside the trimmed
 * array itself. */
function trimAround(cards: SeedCard[], activeIndex: number): { cards: SeedCard[]; activeIndex: number } {
  if (cards.length <= MAX_CARDS_IN_MEMORY) return { cards, activeIndex };
  const cutoff = Math.max(0, activeIndex - WINDOW_RADIUS);
  if (cutoff === 0) return { cards, activeIndex };
  return { cards: cards.slice(cutoff), activeIndex: activeIndex - cutoff };
}

export const useFeedStore = create<FeedState>((set, get) => ({
  cards: SEED_CARDS,
  isLoading: false,
  isLoadingMore: false,
  error: null,
  topicFilter: null,
  // Read synchronously at store-creation time (MMKV is sync, unlike the
  // AsyncStorage it replaced) — index.tsx's mount effect needs this value
  // correct on its very first run. Loading it later via a useEffect would
  // lose the race: React fires child effects (index.tsx's) before parent
  // effects (_layout.tsx's), so a loadDefaultTopic()-in-an-effect pattern
  // would still see null on that first run and never apply the preference.
  defaultTopic: storage.getString(DEFAULT_TOPIC_KEY) ?? null,
  language: 'en',
  activeIndex: 0,
  hasMore: true,
  nextOffset: 0,
  isBookMode: false,
  bookModeTitle: null,

  setTopic: (topic: string | null) => {
    set({ topicFilter: topic });
    get().loadFeed();
  },

  setLanguage: (lang: Language) => {
    storage.set(LANGUAGE_KEY, lang);
    set({ language: lang });
  },

  loadLanguage: () => {
    const saved = storage.getString(LANGUAGE_KEY);
    if (isLanguage(saved)) {
      set({ language: saved });
    }
  },

  setDefaultTopic: (tag: string | null) => {
    if (tag) {
      storage.set(DEFAULT_TOPIC_KEY, tag);
    } else {
      storage.remove(DEFAULT_TOPIC_KEY);
    }
    set({ defaultTopic: tag });
  },

  loadFeed: async () => {
    const { topicFilter } = get();
    set({ isLoading: true, error: null, activeIndex: 0 });

    try {
      const response = await fetchFeed(PAGE_SIZE, 0, topicFilter || undefined);
      if (response.cards && response.cards.length > 0) {
        // Type 4 — "Today's Special": prepend once per calendar day. The
        // backend already withholds `featured` for topic-filtered/later
        // pages, so no need to re-check that here — only whether *this
        // device* has already shown today's pick.
        let cards = response.cards;
        if (response.featured && claimFeaturedSlotForToday()) {
          cards = [{ ...response.featured, isFeatured: true }, ...cards];
        }
        set({
          cards,
          isLoading: false,
          hasMore: response.cards.length >= PAGE_SIZE,
          nextOffset: response.cards.length,
        });
      } else if (topicFilter) {
        // Filter local seed cards as offline fallback
        const filtered = SEED_CARDS.filter((c) =>
          c.deckTitle.toLowerCase().includes(topicFilter.toLowerCase())
        );
        set({ cards: filtered.length > 0 ? filtered : SEED_CARDS, isLoading: false, hasMore: false, nextOffset: 0 });
      } else {
        set({ cards: SEED_CARDS, isLoading: false, hasMore: false, nextOffset: 0 });
      }
    } catch (err: any) {
      // Fallback gracefully to SEED_CARDS on network failure
      console.warn('Feed API fetch failed, falling back to local seed data:', err?.message);
      set({
        cards: SEED_CARDS,
        isLoading: false,
        hasMore: false,
        nextOffset: 0,
        error: err?.message || 'Failed to load live feed',
      });
    }
  },

  loadMore: async () => {
    const { isLoadingMore, hasMore, topicFilter, nextOffset } = get();
    if (isLoadingMore || !hasMore) return;

    set({ isLoadingMore: true });
    try {
      const response = await fetchFeed(PAGE_SIZE, nextOffset, topicFilter || undefined);
      const newCards = response.cards || [];
      set((state) => ({
        cards: dedupeById([...state.cards, ...newCards]),
        isLoadingMore: false,
        hasMore: newCards.length >= PAGE_SIZE,
        nextOffset: state.nextOffset + newCards.length,
      }));
    } catch (err: any) {
      // Transient failure — leave hasMore alone so a later onEndReached
      // (e.g. after the network recovers) retries instead of giving up.
      console.warn('Failed to load more cards:', err?.message);
      set({ isLoadingMore: false });
    }
  },

  setActiveIndex: (index: number) => {
    const { cards } = get();
    const trimmed = trimAround(cards, index);
    set({ activeIndex: trimmed.activeIndex, cards: trimmed.cards });
  },

  openSingleCard: (card: SeedCard) => {
    set({
      cards: [card],
      activeIndex: 0,
      topicFilter: null,
      hasMore: false,
      nextOffset: 0,
      error: null,
    });
  },

  startBookReading: async ({ bookId, title, deckId, cardType, startDeckSequenceOrder }) => {
    if (!get().isBookMode) {
      const s = get();
      preBookModeSnapshot = {
        cards: s.cards,
        topicFilter: s.topicFilter,
        activeIndex: s.activeIndex,
        hasMore: s.hasMore,
        nextOffset: s.nextOffset,
      };
    }
    set({ isLoading: true, error: null, isBookMode: true, bookModeTitle: title });

    try {
      // Books (and single-deck stories) are small at this scale — one
      // full fetch, no pagination.
      const response = await fetchBookCards(bookId, deckId, cardType);
      const cards = response.cards;
      const startIndex = startDeckSequenceOrder != null
        ? Math.max(0, cards.findIndex((c) => c.deckSequenceOrder === startDeckSequenceOrder))
        : 0;
      set({
        cards,
        activeIndex: startIndex,
        isLoading: false,
        hasMore: false,
        nextOffset: 0,
        topicFilter: null,
      });
    } catch (err: any) {
      console.warn('Failed to load sequential reading mode:', err?.message);
      set({ isLoading: false, error: err?.message || 'Failed to load book' });
    }
  },

  exitBookMode: () => {
    const snapshot = preBookModeSnapshot;
    preBookModeSnapshot = null;
    if (snapshot) {
      set({
        cards: snapshot.cards,
        topicFilter: snapshot.topicFilter,
        activeIndex: snapshot.activeIndex,
        hasMore: snapshot.hasMore,
        nextOffset: snapshot.nextOffset,
        isBookMode: false,
        bookModeTitle: null,
      });
    } else {
      set({ isBookMode: false, bookModeTitle: null });
    }
  },
}));
