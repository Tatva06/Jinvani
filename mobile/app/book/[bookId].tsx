import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookOpen, ChevronLeft, ExternalLink, Play } from 'lucide-react-native';

import { useThemeStore } from '../../src/store/useThemeStore';
import { useFeedStore } from '../../src/store/useFeedStore';
import { Colors } from '../../src/theme';
import { SCREEN_PADDING, SPACING } from '../../src/theme/spacing';
import { TYPE } from '../../src/theme/typography';
import { CHROME } from '../../src/i18n/chrome';
import { scriptFontFamily } from '../../src/utils/fonts';
import { fetchBook } from '../../src/api/client';
import { Book } from '../../src/types';

export default function BookDetailScreen() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useThemeStore((s) => s.theme);
  const colors = Colors[theme];
  const language = useFeedStore((s) => s.language);
  const startBookReading = useFeedStore((s) => s.startBookReading);
  const t = CHROME[language];

  const [book, setBook] = useState<Book | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!bookId) return;
    setIsLoading(true);
    setError(null);
    fetchBook(bookId, language)
      .then(setBook)
      .catch((err: any) => setError(err?.message || 'Failed to load book'))
      .finally(() => setIsLoading(false));
  }, [bookId, language]);

  useEffect(() => {
    load();
  }, [load]);

  // A book whose approved cards are (any) verbatim content reads as
  // continuous verbatim reading instead of the normal all-approved-cards
  // book order — Phase C: "if that book has verbatim-type cards, [Start
  // Reading] is what it launches." Mixed-type books are rare at this
  // scale (one ingestion run == one card_type per deck in practice); this
  // filters to verbatim cards specifically rather than assuming the whole
  // book is uniform.
  const isVerbatimBook = book?.cardTypes.includes('verbatim') ?? false;

  const handleStartReading = async (startDeckSequenceOrder?: number) => {
    if (!book) return;
    await startBookReading({
      bookId: book.bookId,
      title: book.title,
      cardType: isVerbatimBook ? 'verbatim' : undefined,
      startDeckSequenceOrder,
    });
    router.push('/(tabs)');
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.backButton}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={styles.centerBlock} />
      ) : error || !book ? (
        <Text style={[styles.errorText, { color: colors.textMuted, fontFamily: scriptFontFamily(language, '400') }]}>
          {error || 'Book not found.'}
        </Text>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.bookHeader}>
            <View style={[styles.iconBox, { backgroundColor: colors.accentMuted, borderColor: colors.accentBorder }]}>
              <BookOpen size={28} color={colors.accent} />
            </View>
            <View style={styles.bookHeaderText}>
              <Text style={[styles.title, { color: colors.text, fontFamily: scriptFontFamily(language, '700') }]}>
                {book.title}
              </Text>
              <Text style={[styles.meta, { color: colors.textSecondary, fontFamily: scriptFontFamily(language, '400') }]}>
                {book.approvedCardCount} {t.library.cardsLabel}
                {book.decks.length > 1 ? ` · ${book.decks.length} ${t.library.chaptersLabel}` : ''}
                {' · '}{book.estimatedReadMinutes} {t.library.minRead}
              </Text>
              {/* Book attribution — null until migration 004 is applied
                  AND this book has a matching books row (see attribution.py).
                  Renders nothing at all when every field is absent. */}
              {(book.authorName || book.rightsNote || book.isPublicDomain) && (
                <Text style={[styles.attribution, { color: colors.textMuted, fontFamily: scriptFontFamily(language, '400') }]}>
                  {[
                    book.authorName ? `${t.feed.attributionBy} ${book.authorName}` : null,
                    book.rightsNote || (book.isPublicDomain ? t.feed.publicDomain : null),
                  ].filter(Boolean).join(' · ')}
                </Text>
              )}
            </View>
          </View>

          <Pressable
            onPress={() => handleStartReading()}
            style={({ pressed }) => [
              styles.startButton,
              { backgroundColor: colors.accent, marginBottom: book.sourceUrl ? 12 : 32 },
              pressed && { opacity: 0.85 },
            ]}
            accessibilityLabel={`Start reading ${book.title}`}
            accessibilityRole="button"
          >
            <Play size={16} color={theme === 'dark' ? '#0A0A0F' : '#FFFFFF'} fill={theme === 'dark' ? '#0A0A0F' : '#FFFFFF'} />
            <Text style={[styles.startButtonText, { color: theme === 'dark' ? '#0A0A0F' : '#FFFFFF' }]}>
              {t.library.startReading}
            </Text>
          </Pressable>

          {/* Cleanly absent (not a disabled/dead button) when there's no
              source_url yet — same null-until-migration contract as the
              rest of the attribution fields. */}
          {book.sourceUrl && (
            <Pressable
              onPress={() => Linking.openURL(book.sourceUrl!).catch(() => {})}
              style={({ pressed }) => [
                styles.readOriginalButton,
                { borderColor: colors.accentBorder },
                pressed && { opacity: 0.75 },
              ]}
              accessibilityRole="link"
              accessibilityLabel={t.feed.readCompleteOriginal}
            >
              <ExternalLink size={14} color={colors.accent} />
              <Text style={[styles.readOriginalButtonText, { color: colors.accent }]}>
                {t.feed.readCompleteOriginal}
              </Text>
            </Pressable>
          )}

          {/* Only show the chapter list when there's more than one deck —
              a single-deck book (the common case in the seeded data) would
              otherwise show one redundant row repeating what's already
              above. Built for the general multi-deck case regardless,
              since the schema supports any number of decks per book. */}
          {book.decks.length > 1 && (
            <>
              <Text style={[styles.sectionHeader, { color: colors.accent, fontFamily: scriptFontFamily(language, '700') }]}>
                {t.library.chaptersTitle}
              </Text>
              {book.decks.map((deck) => (
                <Pressable
                  key={deck.id}
                  onPress={() => handleStartReading(deck.sequenceOrder)}
                  style={({ pressed }) => [
                    styles.chapterRow,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    pressed && { opacity: 0.75 },
                  ]}
                  accessibilityLabel={`Start reading chapter: ${deck.title}`}
                  accessibilityRole="button"
                >
                  <View style={[styles.chapterIndex, { backgroundColor: colors.accentMuted }]}>
                    <Text style={[styles.chapterIndexText, { color: colors.accent }]}>{deck.sequenceOrder}</Text>
                  </View>
                  <View style={styles.chapterInfo}>
                    <Text numberOfLines={1} style={[styles.chapterTitle, { color: colors.text, fontFamily: scriptFontFamily(language, '600') }]}>
                      {deck.title}
                    </Text>
                    <Text style={[styles.chapterMeta, { color: colors.textSecondary, fontFamily: scriptFontFamily(language, '400') }]}>
                      {deck.approvedCardCount} {t.library.cardsLabel}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: SCREEN_PADDING, marginBottom: 4 },
  backButton: { alignSelf: 'flex-start', padding: 4 },
  centerBlock: { marginTop: 60 },
  errorText: { fontSize: 13, paddingHorizontal: SCREEN_PADDING, marginTop: 20 },
  scrollContent: { paddingHorizontal: SCREEN_PADDING, paddingBottom: 40 },
  bookHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 24, marginTop: 8 },
  bookHeaderText: { flex: 1, justifyContent: 'center' },
  iconBox: { width: 56, height: 56, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title: { ...TYPE.detailTitle, marginBottom: 4 },
  meta: { fontSize: 13 },
  attribution: { fontSize: 12, marginTop: 4 },
  startButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 13, borderRadius: 26, marginBottom: 12, alignSelf: 'flex-start' },
  startButtonText: { fontSize: 15, fontWeight: '700' },
  readOriginalButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, marginBottom: 32, alignSelf: 'flex-start' },
  readOriginalButtonText: { fontSize: 13, fontWeight: '600' },
  sectionHeader: { ...TYPE.sectionLabel, marginBottom: SPACING.md },
  chapterRow: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 10, width: '100%' },
  chapterIndex: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  chapterIndexText: { fontSize: 13, fontWeight: '700' },
  chapterInfo: { flex: 1, gap: 2 },
  chapterTitle: { fontSize: 14.5, fontWeight: '600' },
  chapterMeta: { fontSize: 12 },
});
