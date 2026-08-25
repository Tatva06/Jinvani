// ─── Theme Tokens ─────────────────────────────────────────────────────────────
// One source of truth for all colors. Both tabs and cards consume this.

export type ThemeMode = 'dark' | 'light';

interface ThemeColors {
  bg: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  accent: string;
  accentMuted: string;
  accentBorder: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  takeawayBg: string;
  verseBg: string;
  verseBorder: string;
  tabBar: string;
  tabBarBorder: string;
  chipBg: string;
  chipBorder: string;
  chipActiveBg: string;
}

export const Colors: Record<ThemeMode, ThemeColors> = {
  dark: {
    bg:              '#0A0A0F',
    surface:         '#12121A',
    surfaceElevated: '#1C1C28',
    border:          '#2A2A3D',
    accent:          '#C8A96E',
    accentMuted:     'rgba(200,169,110,0.15)',
    accentBorder:    'rgba(200,169,110,0.35)',
    text:            '#F0EDE8',
    textSecondary:   '#9B97A8',
    textMuted:       '#5C5870',
    takeawayBg:      'rgba(200,169,110,0.08)',
    verseBg:         'rgba(255,255,255,0.04)',
    verseBorder:     'rgba(255,255,255,0.1)',
    tabBar:          '#12121A',
    tabBarBorder:    '#2A2A3D',
    chipBg:          'rgba(200,169,110,0.08)',
    chipBorder:      'rgba(200,169,110,0.25)',
    chipActiveBg:    '#C8A96E',
  },
  light: {
    bg:              '#F8F5F0',
    surface:         '#FFFFFF',
    surfaceElevated: '#F0EBE0',
    border:          '#E0D8CC',
    accent:          '#9C6F2E',
    accentMuted:     'rgba(156,111,46,0.12)',
    accentBorder:    'rgba(156,111,46,0.30)',
    text:            '#1A1714',
    textSecondary:   '#5C5448',
    textMuted:       '#9B9080',
    takeawayBg:      'rgba(156,111,46,0.07)',
    verseBg:         'rgba(0,0,0,0.04)',
    verseBorder:     'rgba(0,0,0,0.10)',
    tabBar:          '#FFFFFF',
    tabBarBorder:    '#E0D8CC',
    chipBg:          'rgba(156,111,46,0.08)',
    chipBorder:      'rgba(156,111,46,0.25)',
    chipActiveBg:    '#9C6F2E',
  },
};
