import { create } from 'zustand';
import { storage } from './mmkvStorage';
import { ThemeMode } from '../theme';

const THEME_KEY = 'app-theme';

interface ThemeState {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
  loadTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'dark',

  toggleTheme: () => {
    const next: ThemeMode = get().theme === 'dark' ? 'light' : 'dark';
    storage.set(THEME_KEY, next);
    set({ theme: next });
  },

  setTheme: (theme: ThemeMode) => {
    storage.set(THEME_KEY, theme);
    set({ theme });
  },

  loadTheme: () => {
    const saved = storage.getString(THEME_KEY);
    if (saved === 'light' || saved === 'dark') {
      set({ theme: saved });
    }
  },
}));
