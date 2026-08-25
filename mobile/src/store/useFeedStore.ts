import { create } from 'zustand';
import { SeedCard, Language } from '../types';
import { SEED_CARDS } from '../seedData';
import { fetchFeed } from '../api/client';
import { storage } from './mmkvStorage';

const LANGUAGE_KEY = 'app-language';
const DEFAULT_TOPIC_KEY = 'pref-default-topic';
const PAGE_SIZE = 20;

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
}

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
        set({
          cards: response.cards,
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
}));
