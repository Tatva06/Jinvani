import { CardContent, Language } from '../types';

export const LANGUAGES: Language[] = ['en', 'hi', 'gu'];

export const PLACEHOLDER_CONTENT: CardContent = {
  title: 'Content unavailable',
  body: 'This card could not be loaded correctly.',
  takeaway: 'Content unavailable',
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isValidCardContent(value: unknown): value is CardContent {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return isNonEmptyString(v.title) && isNonEmptyString(v.body) && isNonEmptyString(v.takeaway);
}

/**
 * Normalizes an arbitrary (possibly malformed) `content` payload into a
 * guaranteed-valid Record<Language, CardContent> — every language key is
 * present, and any missing/malformed language degrades to an explicit
 * "unavailable" placeholder rather than an empty object a renderer could
 * throw on.
 */
export function normalizeContent(raw: unknown): Record<Language, CardContent> {
  const rawObj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const result = {} as Record<Language, CardContent>;
  for (const lang of LANGUAGES) {
    const candidate = rawObj[lang];
    result[lang] = isValidCardContent(candidate) ? candidate : PLACEHOLDER_CONTENT;
  }
  return result;
}

/** Resolves the content to display for a card in a given language, falling
 * back to English, then to the placeholder — never throws regardless of
 * what shape `content` actually is. */
export function resolveCardContent(
  content: Partial<Record<Language, CardContent>> | undefined | null,
  language: Language
): CardContent {
  const preferred = content?.[language];
  if (isValidCardContent(preferred)) return preferred;
  const english = content?.en;
  if (isValidCardContent(english)) return english;
  return PLACEHOLDER_CONTENT;
}
