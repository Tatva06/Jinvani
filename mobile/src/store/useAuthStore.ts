import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useSavedStore } from './useSavedStore';

interface AuthState {
  session: Session | null;
  user: User | null;
  /** public.users.id for the current session's user — resolved via
   * auth_id, since user_stash.user_id references public.users.id, not
   * auth.uid() directly. null while resolving, or when logged out. */
  profileId: string | null;
  isInitializing: boolean;
  error: string | null;
  init: () => void;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

async function resolveProfileId(authId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', authId)
    .maybeSingle();
  if (error || !data) return null;
  return data.id as string;
}

// Guards against subscribing to onAuthStateChange more than once — init()
// is called from the app root's mount effect, which (React StrictMode,
// or any future re-render of that effect) could otherwise fire twice.
let authListenerAttached = false;

export const useAuthStore = create<AuthState>((set) => {
  // Applies a Supabase session to this store's state, resolves the
  // matching public.users.id, and reactively loads/clears the saved-cards
  // store to match — the single place session changes (initial load,
  // sign-in, sign-out, token refresh) are handled.
  const applySession = async (session: Session | null) => {
    const profileId = session?.user ? await resolveProfileId(session.user.id) : null;
    set({ session, user: session?.user ?? null, profileId, isInitializing: false });
    if (profileId) {
      useSavedStore.getState().loadSaved(profileId);
    } else {
      useSavedStore.getState().clear();
    }
  };

  return {
    session: null,
    user: null,
    profileId: null,
    isInitializing: true,
    error: null,

    init: () => {
      supabase.auth.getSession().then(({ data: { session } }) => applySession(session));

      if (authListenerAttached) return;
      authListenerAttached = true;
      supabase.auth.onAuthStateChange((_event, session) => {
        applySession(session);
      });
    },

    signUp: async (email: string, password: string) => {
      set({ error: null });
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        set({ error: error.message });
        return { error: error.message };
      }
      return { error: null };
    },

    signIn: async (email: string, password: string) => {
      set({ error: null });
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        set({ error: error.message });
        return { error: error.message };
      }
      return { error: null };
    },

    signOut: async () => {
      await supabase.auth.signOut();
    },

    clearError: () => set({ error: null }),
  };
});
