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
  // ─── Semantic ───
  error: string;
  success: string;
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
    // lightened from #5C5870 → #7A768A for WCAG AA contrast (~5.0:1 on #0A0A0F)
    textMuted:       '#7A768A',
    takeawayBg:      'rgba(200,169,110,0.08)',
    verseBg:         'rgba(255,255,255,0.05)',
    // increased from 0.10 → 0.18 for better definition
    verseBorder:     'rgba(255,255,255,0.18)',
    tabBar:          '#12121A',
    tabBarBorder:    '#2A2A3D',
    chipBg:          'rgba(200,169,110,0.08)',
    chipBorder:      'rgba(200,169,110,0.25)',
    chipActiveBg:    '#C8A96E',
    error:           '#E5484D',
    success:         '#30A46C',
  },
  light: {
    bg:              '#F8F5F0',
    surface:         '#FFFFFF',
    surfaceElevated: '#F0EBE0',
    border:          '#E0D8CC',
    // deepened from #9C6F2E → #8B5D20 for a richer light-mode accent
    accent:          '#8B5D20',
    accentMuted:     'rgba(139,93,32,0.12)',
    accentBorder:    'rgba(139,93,32,0.30)',
    text:            '#1A1714',
    textSecondary:   '#5C5448',
    textMuted:       '#9B9080',
    takeawayBg:      'rgba(139,93,32,0.07)',
    verseBg:         'rgba(0,0,0,0.04)',
    verseBorder:     'rgba(0,0,0,0.15)',
    tabBar:          '#FFFFFF',
    tabBarBorder:    '#E0D8CC',
    chipBg:          'rgba(139,93,32,0.08)',
    chipBorder:      'rgba(139,93,32,0.25)',
    chipActiveBg:    '#8B5D20',
    error:           '#C0392B',
    success:         '#27AE60',
  },
};

