// ─── Typography scale ───────────────────────────────────────────────────────
// Named tokens for text styles that were previously copy-pasted as literal
// numbers across screens (and had quietly drifted — e.g. one copy at
// fontSize 11 where the other three were 11.5). Spread into a StyleSheet
// entry: `sectionHeader: { ...TYPE.sectionLabel, color: c.accent }`.
//
// Title sizes are intentionally NOT collapsed into one value — screenTitle
// (top-level tab screens), modalTitle (the auth sheet) and detailTitle
// (pushed book/story screens) are a real 3-tier hierarchy already; this
// just gives each tier a name instead of a scattered magic number.
export const TYPE = {
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  detailTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 28,
  },
  // Uppercase caps label used above a block of content ("KEY TAKEAWAY",
  // "SAVED", "CHAPTERS", ...). Previously 11.5 in three places and 11 in
  // a fourth (JinvaniCard's takeawayLabel) — standardized on 11.5.
  sectionLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
} as const;
