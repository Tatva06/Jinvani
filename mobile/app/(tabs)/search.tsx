import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search as SearchIcon } from 'lucide-react-native';

import { useThemeStore } from '../../src/store/useThemeStore';
import { useFeedStore } from '../../src/store/useFeedStore';
import { Colors } from '../../src/theme';
import { CHROME } from '../../src/i18n/chrome';
import { searchCards } from '../../src/api/client';
import { SeedCard } from '../../src/types';
import { resolveCardContent } from '../../src/utils/content';
import { scriptFontFamily } from '../../src/utils/fonts';

const DEBOUNCE_MS = 400;

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useThemeStore((s) => s.theme);
  const colors = Colors[theme];
  const language = useFeedStore((s) => s.language);
  const openSingleCard = useFeedStore((s) => s.openSingleCard);
  const t = CHROME[language];

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SeedCard[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced — fires DEBOUNCE_MS after the user stops typing, not per keystroke.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const response = await searchCards(trimmed, language);
        setResults(response.cards);
      } catch (err: any) {
        console.warn('Search failed:', err?.message);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, language]);

  const handleSelect = (card: SeedCard) => {
    openSingleCard(card);
    router.push({ pathname: '/(tabs)', params: { focusCard: card.id } });
  };

  const showEmptyState = !isSearching && query.trim().length > 0 && results.length === 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top + 16 }]}>
      <View style={[styles.inputWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <SearchIcon size={16} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t.search.placeholder}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { color: colors.text, fontFamily: scriptFontFamily(language, '400') }]}
          autoCorrect={false}
        />
      </View>

      {!query.trim() && !isSearching && (
        <View style={styles.initialState}>
          <View style={[styles.initialIcon, { backgroundColor: colors.accentMuted, borderColor: colors.accentBorder }]}>
            <SearchIcon size={28} color={colors.accent} />
          </View>
          <Text style={[styles.initialTitle, { color: colors.text, fontFamily: scriptFontFamily(language, '700') }]}>
            {t.search.placeholder}
          </Text>
          <Text style={[styles.initialSubtitle, { color: colors.textMuted, fontFamily: scriptFontFamily(language, '400') }]}>
            Search across all texts, topics, and teachings
          </Text>
        </View>
      )}

      {isSearching && (
        <View style={styles.centerBlock}>
          <ActivityIndicator color={colors.accent} />
          <Text style={[styles.statusText, { color: colors.textMuted, fontFamily: scriptFontFamily(language, '400') }]}>
            {t.search.searching}
          </Text>
        </View>
      )}

      {showEmptyState && (
        <View style={styles.centerBlock}>
          <Text style={[styles.statusText, { color: colors.textMuted, fontFamily: scriptFontFamily(language, '400') }]}>
            {t.search.noResults}
          </Text>
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const content = resolveCardContent(item.content, language);
          return (
            <Pressable
              onPress={() => handleSelect(item)}
              style={({ pressed }) => [
                styles.resultRow,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && { opacity: 0.75 },
              ]}
            >
              <Text numberOfLines={1} style={[styles.resultTitle, { color: colors.text, fontFamily: scriptFontFamily(language, '600') }]}>
                {content.title}
              </Text>
              <Text numberOfLines={2} style={[styles.resultBody, { color: colors.textSecondary, fontFamily: scriptFontFamily(language, '400') }]}>
                {content.body}
              </Text>
              <Text numberOfLines={1} style={[styles.resultDeck, { color: colors.accent }]}>
                {item.deckTitle}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, height: 48, marginBottom: 16 },
  input: { flex: 1, fontSize: 15 },
  initialState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 16, paddingBottom: 80 },
  initialIcon: { width: 72, height: 72, borderRadius: 36, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  initialTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  initialSubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 20, paddingHorizontal: 24 },
  centerBlock: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  statusText: { fontSize: 13 },
  listContent: { paddingBottom: 40, gap: 10 },
  resultRow: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 4 },
  resultTitle: { fontSize: 15, fontWeight: '600' },
  resultBody: { fontSize: 13, lineHeight: 18 },
  resultDeck: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 4 },
});
