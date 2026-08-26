import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FlashList, FlashListRef, ListRenderItemInfo, ViewToken } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

import { useThemeStore } from '../../src/store/useThemeStore';
import { useFeedStore } from '../../src/store/useFeedStore';
import { Colors } from '../../src/theme';
import { Language, SeedCard } from '../../src/types';
import { JinvaniCard } from '../../src/components/JinvaniCard';
import { TopicStrip } from '../../src/components/TopicStrip';
import { scriptFontFamily } from '../../src/utils/fonts';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const LANGUAGES: Language[] = ['en', 'hi', 'gu'];
const LANG_LABELS: Record<Language, string> = { en: 'EN', hi: 'HI', gu: 'GU' };

// ─── Feed Screen ───────────────────────────────────────────────────────────────
export default function FeedScreen() {
  const router = useRouter();
  const { topic: urlTopic, focusCard } = useLocalSearchParams<{ topic?: string; focusCard?: string }>();
  const insets = useSafeAreaInsets();
  const theme = useThemeStore((s) => s.theme);
  const colors = Colors[theme];

  const cards = useFeedStore((s) => s.cards);
  const language = useFeedStore((s) => s.language);
  const setLanguage = useFeedStore((s) => s.setLanguage);
  const topicFilter = useFeedStore((s) => s.topicFilter);
  const setTopic = useFeedStore((s) => s.setTopic);
  const loadMore = useFeedStore((s) => s.loadMore);
  const setActiveIndex = useFeedStore((s) => s.setActiveIndex);
  const isBookMode = useFeedStore((s) => s.isBookMode);
  const bookModeTitle = useFeedStore((s) => s.bookModeTitle);
  const exitBookMode = useFeedStore((s) => s.exitBookMode);

  const listRef = useRef<FlashListRef<SeedCard>>(null);

  // Jump to the right card whenever book mode is entered or exited —
  // startBookReading()/exitBookMode() both already set activeIndex to the
  // correct target before this fires; scrollToIndex just makes the visible
  // list catch up, since FlashList doesn't auto-scroll on a data swap.
  // Deliberately keyed only on isBookMode, not activeIndex — activeIndex
  // also changes on every normal swipe (via setActiveIndex), and reacting
  // to that here would fight the user's own scroll.
  useEffect(() => {
    const index = useFeedStore.getState().activeIndex;
    listRef.current?.scrollToIndex({ index, animated: false });
  }, [isBookMode]);

  // URL param is the source of truth — syncing it to the store triggers loadFeed automatically.
  // Skip this when arriving to view a single focused card (e.g. a tapped search
  // result via openSingleCard) — that flow sets up its own single-card state,
  // and re-running setTopic here would immediately overwrite it with a fresh
  // loadFeed() call. Absent an explicit URL topic, fall back to the user's
  // persisted "personalize feed" default topic (read once at mount, not
  // reactively — this is a cold-start preference, not a live binding).
  useEffect(() => {
    if (focusCard) return;
    const fallback = useFeedStore.getState().defaultTopic;
    setTopic(urlTopic && urlTopic.length > 0 ? urlTopic : fallback);
  }, [urlTopic, focusCard, setTopic]);

  const renderItem = useCallback(
    ({ item, extraData }: ListRenderItemInfo<SeedCard>) => {
      const { lang, themeMode } = (extraData as { lang: Language; themeMode: 'dark' | 'light' });
      return (
        <JinvaniCard
          card={item}
          language={lang}
          themeMode={themeMode}
          screenHeight={SCREEN_HEIGHT}
        />
      );
    },
    []
  );

  const keyExtractor = useCallback((item: SeedCard) => item.id, []);

  // Stable reference — FlashList (like FlatList) re-subscribes viewability
  // tracking whenever this identity changes, so it must not be recreated
  // every render.
  const extraData = useMemo(() => ({ lang: language, themeMode: theme }), [language, theme]);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken<SeedCard>[] }) => {
      const first = viewableItems[0];
      if (first?.index != null) {
        setActiveIndex(first.index);
      }
    }
  ).current;

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      {/* ─── Sticky frosted header — groups language + topics in one bar ─── */}
      <View style={[styles.stickyHeader, {
        paddingTop: insets.top + 8,
        backgroundColor: theme === 'dark' ? 'rgba(10,10,15,0.88)' : 'rgba(248,245,240,0.92)',
        borderBottomColor: colors.border,
      }]}>
        {isBookMode ? (
          /* Book mode — show reading banner spanning the full header */
          <View style={[styles.bookModeBanner, {
            backgroundColor: colors.surfaceElevated,
            borderColor: colors.border,
          }]}>
            <Text
              numberOfLines={1}
              style={[styles.bookModeBannerText, { color: colors.accent, fontFamily: scriptFontFamily(language, '700') }]}
            >
              {bookModeTitle}
            </Text>
            <Pressable
              onPress={exitBookMode}
              hitSlop={12}
              accessibilityLabel="Exit book reading mode"
              accessibilityRole="button"
            >
              <X size={16} color={colors.textMuted} />
            </Pressable>
          </View>
        ) : (
          /* Normal mode — language toggle row + topic strip */
          <>
            <View style={styles.headerRow}>
              {/* Spacer left to balance language pills visually */}
              <View style={styles.headerSpacer} />
              <View style={[styles.langToggle, {
                backgroundColor: theme === 'dark' ? 'rgba(28,28,40,0.9)' : 'rgba(255,255,255,0.9)',
                borderColor: colors.border,
              }]}>
                {LANGUAGES.map((lang) => {
                  const isActive = language === lang;
                  return (
                    <Pressable
                      key={lang}
                      onPress={() => setLanguage(lang)}
                      style={[styles.langPill, isActive && { backgroundColor: colors.accent }]}
                      accessibilityLabel={`Switch to ${LANG_LABELS[lang]} language`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                    >
                      <Text style={[styles.langPillText, {
                        color: isActive
                          ? (theme === 'dark' ? '#0A0A0F' : '#FFFFFF')
                          : colors.textSecondary,
                        fontWeight: isActive ? '700' : '600',
                      }]}>
                        {LANG_LABELS[lang]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <TopicStrip
              activeTag={topicFilter}
              onSelect={(tag) => router.setParams({ topic: tag ?? '', focusCard: '' })}
              language={language}
              themeMode={theme}
            />
          </>
        )}
      </View>

      <FlashList
        ref={listRef}
        data={cards}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        extraData={extraData}
        pagingEnabled={true}
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        bounces={true}
        onRefresh={() => useFeedStore.getState().loadFeed()}
        refreshing={useFeedStore((s) => s.isLoading)}
        onEndReached={loadMore}
        onEndReachedThreshold={2}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  stickyHeader: {
    zIndex: 10,
    borderBottomWidth: 1,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerSpacer: { flex: 1 },
  langToggle: {
    flexDirection: 'row',
    gap: 4,
    borderWidth: 1,
    borderRadius: 24,
    padding: 3,
  },
  langPill: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 18 },
  langPillText: { fontSize: 11.5, letterSpacing: 0.6 },
  bookModeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderWidth: 1,
    borderRadius: 20,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 8,
  },
  bookModeBannerText: { flex: 1, fontSize: 12.5 },
});
