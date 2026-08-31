// ─── Spacing scale ──────────────────────────────────────────────────────────
// A single source of truth for margins/padding/gaps, so screens stop
// inventing their own pixel values. `screen` is the one every screen's
// outer horizontal padding should use — it's 20 (not the more common 16)
// because that's what most of this app's screens already converged on
// before this scale existed; forcing 16 here would mean changing more
// call sites away from their existing value, not fewer.
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

// Standard horizontal inset for a full screen's content. Deliberately NOT
// used by TopicStrip's own horizontal-scroll chip row (SPACING.base/16) —
// that's an intentional "next chip peeks at the edge" convention, paired
// everywhere TopicStrip is embedded (e.g. ProfileScreen cancels its own
// screen padding via a negative margin specifically to let TopicStrip's
// 16 show through unmodified).
export const SCREEN_PADDING = SPACING.lg;
