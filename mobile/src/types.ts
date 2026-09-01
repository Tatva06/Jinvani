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
export type CardType = 'summary' | 'chunked_verse' | 'verbatim' | 'digest' | 'narrative';

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
  /** Type 4 — "Today's Special". Client-side-only flag set by
   * useFeedStore when it prepends the API's `featured` card; never comes
   * from the API response itself. Drives JinvaniCard's badge. */
  isFeatured?: boolean;
  // ─── Book attribution (migration 004_book_attribution.sql) — all
  // undefined/null until that migration is applied AND the card's deck
  // has a matching books row. JinvaniCard's attribution footer and
  // "Read Complete Original" action must render sensibly with any/all
  // of these absent. ───
  bookTitle?: string | null;
  authorName?: string | null;
  sourceUrl?: string | null;
  isPublicDomain?: boolean | null;
  rightsNote?: string | null;
}

// ─── Book / Library ─────────────────────────────────────────────────────────────
export interface DeckSummary {
  id: string;
  title: string;
  sequenceOrder: number;
  topicTag: string | null;
  approvedCardCount: number;
  /** Distinct card_type values among this deck's approved cards. */
  cardTypes: CardType[];
  /** Word-count-derived, computed server-side per request. */
  estimatedReadMinutes: number;
}

export interface Book {
  bookId: string;
  /** No books.title column exists — this is the lowest-sequence_order
   * deck's title, used as a readable stand-in. */
  title: string;
  decks: DeckSummary[];
  approvedCardCount: number;
  /** Union of every deck's cardTypes. */
  cardTypes: CardType[];
  estimatedReadMinutes: number;
  // ─── Book attribution — see SeedCard's identical fields for the
  // null-until-migration-004-applied contract. ───
  authorName?: string | null;
  sourceUrl?: string | null;
  isPublicDomain?: boolean | null;
  rightsNote?: string | null;
}

// ─── Stories (Type 5 / narrative) ────────────────────────────────────────────
export interface Story {
  deckId: string;
  bookId: string;
  title: string;
  cardCount: number;
  estimatedReadMinutes: number;
}

export interface StoryDetail extends Story {
  /** First card in reading order — used for the "decide to read or skip"
   * preview (title/count/takeaway) before committing to the story. */
  previewCard: SeedCard | null;
}
