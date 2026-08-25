import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../constants';
import { storage } from '../store/mmkvStorage';

// Supabase's auth client accepts sync-or-Promise return values from its
// storage adapter (SupportedStorage's methods are typed as `T |
// Promise<T>`), so wrapping the already-synchronous MMKV instance directly
// is valid — same convention as useThemeStore.ts/useSavedStore.ts.
const mmkvAuthStorage = {
  getItem: (key: string) => storage.getString(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: (key: string) => {
    storage.remove(key);
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: mmkvAuthStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // not relevant on native — no URL-based OAuth/magic-link redirect this session
  },
});
