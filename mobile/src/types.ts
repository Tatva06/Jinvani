// ─── Language ────────────────────────────────────────────────────────────────
export type Language = 'en' | 'hi' | 'gu';

// ─── Card Content ─────────────────────────────────────────────────────────────
export interface CardContent {
  /** Short headline for the card (≤ 8 words) */
  title: string;
  /** 60-word scripture summary */
  body: string;
  /** Distilled practical insight */
  takeaway: string;
}

// ─── Seed Card ────────────────────────────────────────────────────────────────
export interface SeedCard {
  /** Unique stable identifier */
  id: string;
  /** E.g. "Tattvartha Sutra", "Uttaradhyayana" */
  deckTitle: string;
  /** Displayed as "Card 1 of 12" etc. */
  cardIndex: string;
  /** Scholarly citation: author, chapter, verse */
  citation: string;
  /** Multilingual content keyed by language */
  content: Record<Language, CardContent>;
  /** Optional original verse in classical script */
  originalVerse?: {
    /** Devanagari / Ardhamagadhi script label */
    script: string;
    /** Transliterated or raw verse text */
    text: string;
  };
}
