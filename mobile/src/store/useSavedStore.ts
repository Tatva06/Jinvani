import { create } from 'zustand';
import { storage } from './mmkvStorage';
import { SeedCard } from '../types';

const SAVED_KEY = 'saved-cards';

interface SavedState {
  savedCards: SeedCard[];
  isSaved: (id: string) => boolean;
  toggleSaved: (card: SeedCard) => void;
  loadSaved: () => void;
}

function readSavedCards(): SeedCard[] {
  const raw = storage.getString(SAVED_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Local-device-only "saved" list — there is no account/login system in this
// app, so this is not a server-backed bookmark (the existing user_stash
// table has no working path to it: no auth flow ever creates a
// public.users row). Full card objects are stored, not just ids, so the
// saved list still renders after a cold start without needing a
// get-card-by-id endpoint that doesn't exist.
export const useSavedStore = create<SavedState>((set, get) => ({
  savedCards: [],

  isSaved: (id: string) => get().savedCards.some((c) => c.id === id),

  toggleSaved: (card: SeedCard) => {
    const current = get().savedCards;
    const exists = current.some((c) => c.id === card.id);
    const next = exists ? current.filter((c) => c.id !== card.id) : [...current, card];
    storage.set(SAVED_KEY, JSON.stringify(next));
    set({ savedCards: next });
  },

  loadSaved: () => {
    set({ savedCards: readSavedCards() });
  },
}));
