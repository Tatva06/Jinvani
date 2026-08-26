import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookOpenText, ChevronLeft, Play } from 'lucide-react-native';

import { useThemeStore } from '../../src/store/useThemeStore';
import { useFeedStore } from '../../src/store/useFeedStore';
import { Colors } from '../../src/theme';
import { CHROME } from '../../src/i18n/chrome';
import { scriptFontFamily } from '../../src/utils/fonts';
import { fetchStory } from '../../src/api/client';
import { resolveCardContent } from '../../src/utils/content';
import { StoryDetail } from '../../src/types';

// Type 5 (narrative) reading gate — deliberately a separate screen from
// Book Detail's "Start Reading", not a shared component: the whole point
// (per the original ask) is that tapping a story does NOT drop straight
// into swipe mode the way Book Detail's button does — it shows enough
// (title, count, a preview line) for the user to decide to read or skip,
// then reuses the same startBookReading/isBookMode mechanism once they
// actually commit.
export default function StoryPreviewScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useThemeStore((s) => s.theme);
  const colors = Colors[theme];
  const language = useFeedStore((s) => s.language);
  const startBookReading = useFeedStore((s) => s.startBookReading);
  const t = CHROME[language];

  const [story, setStory] = useState<StoryDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const load = useCallback(() => {
    if (!deckId) return;
    setIsLoading(true);
    setError(null);
    fetchStory(deckId)
      .then(setStory)
      .catch((err: any) => setError(err?.message || 'Failed to load story'))
      .finally(() => setIsLoading(false));
  }, [deckId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStartReading = async () => {
    if (!story) return;
    setIsStarting(true);
    await startBookReading({
      bookId: story.bookId,
      title: story.title,
      deckId: story.deckId,
      cardType: 'narrative',
    });
    setIsStarting(false);
    router.push('/(tabs)');
  };

  const preview = story?.previewCard ? resolveCardContent(story.previewCard.content, language) : null;

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.backButton}
          accessibilityLabel={t.story.back}
          accessibilityRole="button"
        >
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={styles.centerBlock} />
      ) : error || !story ? (
        <Text style={[styles.errorText, { color: colors.textMuted, fontFamily: scriptFontFamily(language, '400') }]}>
          {error || 'Story not found.'}
        </Text>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.storyHeader}>
            <View style={[styles.iconBox, { backgroundColor: colors.accentMuted, borderColor: colors.accentBorder }]}>
              <BookOpenText size={28} color={colors.accent} />
            </View>
            <View style={styles.storyHeaderText}>
              <Text style={[styles.title, { color: colors.text, fontFamily: scriptFontFamily(language, '700') }]}>
                {story.title}
              </Text>
              <Text style={[styles.meta, { color: colors.textSecondary, fontFamily: scriptFontFamily(language, '400') }]}>
                {story.cardCount} {t.library.cardsLabel}
              </Text>
            </View>
          </View>

          {preview && (
            <View style={[styles.previewBox, { backgroundColor: colors.takeawayBg, borderColor: colors.accentBorder }]}>
              <Text style={[styles.previewLabel, { color: colors.accent, fontFamily: scriptFontFamily(language, '700') }]}>
                {t.feed.keyTakeaway}
              </Text>
              <Text style={[styles.previewText, { color: colors.text, fontFamily: scriptFontFamily(language, '400') }]}>
                {preview.takeaway}
              </Text>
            </View>
          )}

          <Pressable
            onPress={handleStartReading}
            disabled={isStarting}
            style={({ pressed }) => [
              styles.startButton,
              { backgroundColor: colors.accent },
              (pressed || isStarting) && { opacity: 0.85 },
            ]}
            accessibilityLabel={`${t.story.startReading}: ${story.title}`}
            accessibilityRole="button"
          >
            {isStarting ? (
              <ActivityIndicator size="small" color={theme === 'dark' ? '#0A0A0F' : '#FFFFFF'} />
            ) : (
              <Play size={16} color={theme === 'dark' ? '#0A0A0F' : '#FFFFFF'} fill={theme === 'dark' ? '#0A0A0F' : '#FFFFFF'} />
            )}
            <Text style={[styles.startButtonText, { color: theme === 'dark' ? '#0A0A0F' : '#FFFFFF' }]}>
              {t.story.startReading}
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, marginBottom: 4 },
  backButton: { alignSelf: 'flex-start', padding: 4 },
  centerBlock: { marginTop: 60 },
  errorText: { fontSize: 13, paddingHorizontal: 20, marginTop: 20 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  storyHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 20, marginTop: 8 },
  storyHeaderText: { flex: 1, justifyContent: 'center' },
  iconBox: { width: 56, height: 56, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3, marginBottom: 4, lineHeight: 28 },
  meta: { fontSize: 13 },
  previewBox: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 28 },
  previewLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 8 },
  previewText: { fontSize: 15, lineHeight: 22 },
  startButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 13, borderRadius: 26, alignSelf: 'flex-start' },
  startButtonText: { fontSize: 15, fontWeight: '700' },
});
