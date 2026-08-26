import { API_V1 } from '../constants';
import { Book, Language, SeedCard } from '../types';
import { normalizeContent } from '../utils/content';

export interface FeedResponse {
  cards: SeedCard[];
  count: number;
}

const FETCH_HEADERS = {
  'Bypass-Tunnel-Reminder': 'true',
  'Content-Type': 'application/json',
};

function mapCard(c: any): SeedCard {
  return {
    id: c.id,
    deckTitle: c.deck_title || c.deckTitle || 'Jain Scripture',
    cardIndex: c.sequence_order ? `Card ${c.sequence_order}` : (c.cardIndex || 'Card 1'),
    citation: c.citation_reference || c.citation || '',
    cardType: c.card_type || c.cardType,
    content: normalizeContent(c.content),
    originalVerse: c.original_verse || c.originalVerse,
    bookId: c.book_id ?? c.bookId,
    deckSequenceOrder: c.deck_sequence_order ?? c.deckSequenceOrder,
  };
}

function mapBook(b: any): Book {
  return {
    bookId: b.book_id,
    title: b.title,
    approvedCardCount: b.approved_card_count,
    decks: (b.decks || []).map((d: any) => ({
      id: d.id,
      title: d.title,
      sequenceOrder: d.sequence_order,
      topicTag: d.topic_tag ?? null,
      approvedCardCount: d.approved_card_count,
    })),
  };
}

export async function fetchFeed(
  limit: number = 10,
  offset: number = 0,
  topic_tag?: string
): Promise<FeedResponse> {
  const url = new URL(`${API_V1}/feed`);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));
  if (topic_tag) {
    url.searchParams.set('topic', topic_tag);
  }

  const res = await fetch(url.toString(), { headers: FETCH_HEADERS });
  if (!res.ok) {
    throw new Error(`Failed to fetch feed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const cards: SeedCard[] = (data.cards || []).map(mapCard);

  return {
    cards,
    count: data.count ?? cards.length,
  };
}

export async function searchCards(
  q: string,
  lang: Language = 'en',
  limit: number = 20
): Promise<FeedResponse> {
  const url = new URL(`${API_V1}/search`);
  url.searchParams.set('q', q);
  url.searchParams.set('lang', lang);
  url.searchParams.set('limit', String(limit));

  const res = await fetch(url.toString(), { headers: FETCH_HEADERS });
  if (!res.ok) {
    throw new Error(`Search failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const cards: SeedCard[] = (data.cards || []).map(mapCard);

  return {
    cards,
    count: data.count ?? cards.length,
  };
}

export async function fetchBooks(): Promise<Book[]> {
  const res = await fetch(`${API_V1}/books`, { headers: FETCH_HEADERS });
  if (!res.ok) {
    throw new Error(`Failed to fetch books: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return (data.books || []).map(mapBook);
}

export async function fetchBook(bookId: string): Promise<Book> {
  const res = await fetch(`${API_V1}/books/${encodeURIComponent(bookId)}`, { headers: FETCH_HEADERS });
  if (!res.ok) {
    throw new Error(`Failed to fetch book: ${res.status} ${res.statusText}`);
  }
  return mapBook(await res.json());
}

export async function fetchBookCards(bookId: string, deckId?: string): Promise<FeedResponse> {
  const url = new URL(`${API_V1}/books/${encodeURIComponent(bookId)}/cards`);
  if (deckId) {
    url.searchParams.set('deck_id', deckId);
  }
  const res = await fetch(url.toString(), { headers: FETCH_HEADERS });
  if (!res.ok) {
    throw new Error(`Failed to fetch book cards: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const cards: SeedCard[] = (data.cards || []).map(mapCard);
  return { cards, count: data.count ?? cards.length };
}
