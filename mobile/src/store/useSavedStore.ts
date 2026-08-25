import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { SeedCard } from '../types';
import { normalizeContent } from '../utils/content';

export type ToggleSavedResult = 'saved' | 'unsaved' | 'requires-login' | 'error';

interface SavedState {
  savedCards: SeedCard[];
  isLoading: boolean;
  isSaved: (id: string) => boolean;
  /** profileId is public.users.id (NOT auth.uid()) — user_stash.user_id
   * references public.users.id. Callers read this from
   * useAuthStore(s => s.profileId). */
  loadSaved: (profileId: string) => Promise<void>;
  toggleSaved: (profileId: string | null, card: SeedCard) => Promise<ToggleSavedResult>;
  /** Called on logout — there is no local fallback list; a logged-out
   * user simply has no saved cards to show. */
  clear: () => void;
}

function mapStashRow(row: any): SeedCard | null {
  const c = row.cards;
  if (!c) return null;
  return {
    id: c.id,
    deckTitle: c.decks?.title || 'Jain Scripture',
    cardIndex: c.sequence_order ? `Card ${c.sequence_order}` : 'Card 1',
    citation: c.citation_reference || '',
    cardType: c.card_type,
    content: normalizeContent(c.content),
    originalVerse: c.original_verse ?? undefined,
  };
}

// Real, cross-device storage backed by Supabase's user_stash table — RLS
// already scopes every read/write to the logged-in user (auth.uid() via
// public.users.auth_id), so no backend endpoint is needed here. There is
// deliberately no local-only fallback list: a logged-out user has nothing
// saved, full stop, rather than a separate list that would need merging
// with the server later.
export const useSavedStore = create<SavedState>((set, get) => ({
  savedCards: [],
  isLoading: false,

  isSaved: (id: string) => get().savedCards.some((c) => c.id === id),

  loadSaved: async (profileId: string) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('user_stash')
        .select('card_id, created_at, cards(*, decks(title))')
        .eq('user_id', profileId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const cards = (data || [])
        .map(mapStashRow)
        .filter((c): c is SeedCard => c !== null);
      set({ savedCards: cards, isLoading: false });
    } catch (err: any) {
      console.warn('Failed to load saved cards:', err?.message);
      set({ isLoading: false });
    }
  },

  toggleSaved: async (profileId: string | null, card: SeedCard) => {
    if (!profileId) return 'requires-login';

    const alreadySaved = get().isSaved(card.id);

    if (alreadySaved) {
      const { error } = await supabase
        .from('user_stash')
        .delete()
        .eq('user_id', profileId)
        .eq('card_id', card.id);
      if (error) {
        console.warn('Failed to unsave card:', error.message);
        return 'error';
      }
      set({ savedCards: get().savedCards.filter((c) => c.id !== card.id) });
      return 'unsaved';
    }

    const { error } = await supabase
      .from('user_stash')
      .insert({ user_id: profileId, card_id: card.id });
    if (error) {
      console.warn('Failed to save card:', error.message);
      return 'error';
    }
    set({ savedCards: [card, ...get().savedCards] });
    return 'saved';
  },

  clear: () => set({ savedCards: [] }),
}));
