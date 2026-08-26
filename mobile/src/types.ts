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
export type CardType = 'summary' | 'chunked_verse';

export interface SeedCard {
  /** Unique stable identifier */
  id: string;
  /** E.g. "Tattvartha Sutra", "Uttaradhyayana" */
  deckTitle: string;
  /** Displayed as "Card 1 of 12" etc. */
  cardIndex: string;
  /** Scholarly citation: author, chapter, verse */
  citation: string;
  /** Mirrors backend cards.card_type — 'chunked_verse' cards carry an
   * original-language source verse; 'summary' cards don't. */
  cardType?: CardType;
  /** Multilingual content keyed by language */
  content: Record<Language, CardContent>;
  /** Optional original verse in classical script */
  originalVerse?: {
    /** Devanagari / Ardhamagadhi script label */
    script: string;
    /** Transliterated or raw verse text */
    text: string;
  };
  /** decks.book_id — a bare string, no books table. Used to navigate to
   * Book Detail from a card's source/citation tap. */
  bookId?: string;
  /** decks.sequence_order — the card's chapter position within its book,
   * distinct from cardType.sequence_order (the card's position within
   * its own deck/chapter). */
  deckSequenceOrder?: number;
}

// ─── Book / Library ─────────────────────────────────────────────────────────────
export interface DeckSummary {
  id: string;
  title: string;
  sequenceOrder: number;
  topicTag: string | null;
  approvedCardCount: number;
}

export interface Book {
  bookId: string;
  /** No books.title column exists — this is the lowest-sequence_order
   * deck's title, used as a readable stand-in. */
  title: string;
  decks: DeckSummary[];
  approvedCardCount: number;
}
