import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FlashList, ListRenderItemInfo, ViewToken } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeStore } from '../../src/store/useThemeStore';
import { useFeedStore } from '../../src/store/useFeedStore';
import { Colors } from '../../src/theme';
import { Language, SeedCard } from '../../src/types';
import { JinvaniCard } from '../../src/components/JinvaniCard';
import { TopicStrip } from '../../src/components/TopicStrip';

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
      {/* Top topic strip — reuses the same URL-param -> setTopic mechanism
          the old banner's clear button used, so it stays the single source
          of truth for the topic filter across screens. */}
      <View style={[styles.topicStripWrap, { top: insets.top + 56 }]}>
        <TopicStrip
          activeTag={topicFilter}
          onSelect={(tag) => router.setParams({ topic: tag ?? '', focusCard: '' })}
          language={language}
          themeMode={theme}
        />
      </View>

      {/* Language toggle */}
      <View style={[styles.langToggle, {
        top: insets.top + 12,
        backgroundColor: theme === 'dark' ? 'rgba(18,18,26,0.85)' : 'rgba(255,255,255,0.9)',
        borderColor: colors.border,
      }]}>
        {LANGUAGES.map((lang) => {
          const isActive = language === lang;
          return (
            <Pressable
              key={lang}
              onPress={() => setLanguage(lang)}
              style={[styles.langPill, isActive && { backgroundColor: colors.accent }]}
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

      <FlashList
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
  langToggle: { position: 'absolute', right: 16, zIndex: 10, flexDirection: 'row', gap: 6, borderWidth: 1, borderRadius: 24, padding: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 6 },
  langPill: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 18 },
  langPillText: { fontSize: 11.5, letterSpacing: 0.6 },
  topicStripWrap: { position: 'absolute', left: 0, right: 0, zIndex: 10 },
});
