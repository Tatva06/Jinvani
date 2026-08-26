import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookOpenText, ChevronRight } from 'lucide-react-native';

import { useThemeStore } from '../../src/store/useThemeStore';
import { useFeedStore } from '../../src/store/useFeedStore';
import { Colors } from '../../src/theme';
import { CHROME } from '../../src/i18n/chrome';
import { scriptFontFamily } from '../../src/utils/fonts';
import { fetchBooks, fetchStories } from '../../src/api/client';
import { Book, Story } from '../../src/types';

// Stories (Type 5 / narrative) live as a section within this same Library
// screen rather than a separate tab or list: they're browsed the same
// way books are ("long-form content, read in order"), and at this scale
// a handful of stories don't earn a whole extra tab in an already-4-tab
// bar. A horizontal strip (not a second FlatList — RN warns/misbehaves
// nesting virtualized lists) keeps it visually distinct from the
// vertical books list below it without a second screen to navigate.
function StoriesSection({
  stories,
  colors,
  language,
  t,
  onSelect,
}: {
  stories: Story[];
  colors: (typeof Colors)['dark'];
  language: ReturnType<typeof useFeedStore.getState>['language'];
  t: (typeof CHROME)['en'];
  onSelect: (story: Story) => void;
}) {
  return (
    <View style={styles.storiesSection}>
      <Text style={[styles.sectionHeader, { color: colors.accent, fontFamily: scriptFontFamily(language, '700') }]}>
        {t.library.storiesTitle}
      </Text>
      {stories.length === 0 ? (
        <Text style={[styles.storiesEmpty, { color: colors.textMuted, fontFamily: scriptFontFamily(language, '400') }]}>
          {t.library.storiesEmpty}
        </Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesRow}>
          {stories.map((story) => (
            <Pressable
              key={story.deckId}
              onPress={() => onSelect(story)}
              style={({ pressed }) => [
                styles.storyCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && { opacity: 0.75 },
              ]}
              accessibilityLabel={`Open story: ${story.title}, ${story.cardCount} cards`}
              accessibilityRole="button"
            >
              <BookOpenText size={20} color={colors.accent} />
              <Text numberOfLines={2} style={[styles.storyTitle, { color: colors.text, fontFamily: scriptFontFamily(language, '600') }]}>
                {story.title}
              </Text>
              <Text style={[styles.storyMeta, { color: colors.textSecondary, fontFamily: scriptFontFamily(language, '400') }]}>
                {story.cardCount} {t.library.cardsLabel}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

export default function LibraryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useThemeStore((s) => s.theme);
  const colors = Colors[theme];
  const language = useFeedStore((s) => s.language);
  const t = CHROME[language];

  const [books, setBooks] = useState<Book[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setIsLoading(true);
    setError(null);
    Promise.all([fetchBooks(), fetchStories()])
      .then(([b, s]) => {
        setBooks(b);
        setStories(s);
      })
      .catch((err: any) => setError(err?.message || 'Failed to load library'))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <Text style={[styles.title, { color: colors.text, fontFamily: scriptFontFamily(language, '700') }]}>
          {t.library.title}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: scriptFontFamily(language, '400') }]}>
          {t.library.subtitle}
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={styles.centerBlock} />
      ) : error ? (
        <Text style={[styles.errorText, { color: colors.textMuted, fontFamily: scriptFontFamily(language, '400') }]}>
          {error}
        </Text>
      ) : (
        <FlatList
          data={books}
          keyExtractor={(b) => b.bookId}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 40 }]}
          ListHeaderComponent={
            <StoriesSection
              stories={stories}
              colors={colors}
              language={language}
              t={t}
              onSelect={(story) => router.push({ pathname: '/story/[deckId]', params: { deckId: story.deckId } })}
            />
          }
          renderItem={({ item, index }) => {
            const topicTag = item.decks.find((d) => d.topicTag)?.topicTag;
            // Cycle through a curated set of accent-adjacent badge colors
            const BADGE_COLORS = [
              '#C8A96E', '#A87C4F', '#D4A853', '#B8956A',
              '#C49A6C', '#E8C07A', '#9A7550', '#BFA06E',
            ];
            const badgeColor = BADGE_COLORS[index % BADGE_COLORS.length];
            return (
              <Pressable
                onPress={() => router.push({ pathname: '/book/[bookId]', params: { bookId: item.bookId } })}
                style={({ pressed }) => [
                  styles.bookRow,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  pressed && { opacity: 0.75 },
                ]}
                accessibilityLabel={`Open ${item.title}`}
                accessibilityRole="button"
              >
                <View style={[styles.iconBox, { backgroundColor: `${badgeColor}22`, borderColor: `${badgeColor}55` }]}>
                  <Text style={[styles.iconNumber, { color: badgeColor }]}>{index + 1}</Text>
                </View>
                <View style={styles.bookInfo}>
                  <Text numberOfLines={1} style={[styles.bookTitle, { color: colors.text, fontFamily: scriptFontFamily(language, '600') }]}>
                    {item.title}
                  </Text>
                  <Text style={[styles.bookMeta, { color: colors.textSecondary, fontFamily: scriptFontFamily(language, '400') }]}>
                    {item.approvedCardCount} {t.library.cardsLabel}
                    {item.decks.length > 1 ? ` · ${item.decks.length} ${t.library.chaptersLabel}` : ''}
                  </Text>
                  {topicTag && (
                    <View style={[styles.chip, { backgroundColor: colors.chipBg, borderColor: colors.chipBorder }]}>
                      <Text style={[styles.chipText, { color: colors.accent }]}>{topicTag}</Text>
                    </View>
                  )}
                </View>
                <ChevronRight size={18} color={colors.textMuted} />
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20 },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5, marginBottom: 6 },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 20 },
  centerBlock: { marginTop: 40 },
  errorText: { fontSize: 13, paddingHorizontal: 20, marginTop: 20 },
  listContent: { paddingHorizontal: 20, gap: 10 },
  bookRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 16, borderWidth: 1 },
  iconBox: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  iconNumber: { fontSize: 16, fontWeight: '800' },
  bookInfo: { flex: 1, gap: 4 },
  bookTitle: { fontSize: 15, fontWeight: '600' },
  bookMeta: { fontSize: 12.5 },
  chip: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginTop: 2 },
  chipText: { fontSize: 10.5, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  storiesSection: { marginBottom: 18 },
  sectionHeader: { fontSize: 11.5, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 12 },
  storiesEmpty: { fontSize: 13 },
  storiesRow: { gap: 10, paddingRight: 4 },
  storyCard: { width: 150, borderWidth: 1, borderRadius: 16, padding: 14, gap: 8 },
  storyTitle: { fontSize: 13.5, lineHeight: 18 },
  storyMeta: { fontSize: 11.5 },
});
