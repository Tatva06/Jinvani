import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { TOPICS } from '../data/topics';
import { Colors } from '../theme';
import { SCREEN_PADDING, SPACING } from '../theme/spacing';
import { Language } from '../types';
import { CHROME } from '../i18n/chrome';
import { scriptFontFamily } from '../utils/fonts';

function Chip({
  label,
  active,
  onPress,
  colors,
  language,
  themeMode,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: (typeof Colors)['dark'];
  language: Language;
  themeMode: 'dark' | 'light';
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, {
        backgroundColor: active ? colors.accent : colors.chipBg,
        borderColor: active ? colors.accent : colors.chipBorder,
      }]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <Text
        numberOfLines={1}
        style={[styles.chipText, {
          color: active ? (themeMode === 'dark' ? '#0A0A0F' : '#FFFFFF') : colors.text,
          fontWeight: active ? '700' : '500',
          fontFamily: scriptFontFamily(language, active ? '700' : '500'),
        }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function TopicStrip({
  activeTag,
  onSelect,
  language,
  themeMode,
}: {
  /** null = unfiltered ("All Topics") */
  activeTag: string | null;
  onSelect: (tag: string | null) => void;
  language: Language;
  themeMode: 'dark' | 'light';
}) {
  const colors = Colors[themeMode];
  const t = CHROME[language];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      <Chip
        label={t.topics.allTopics}
        active={activeTag === null}
        onPress={() => onSelect(null)}
        colors={colors}
        language={language}
        themeMode={themeMode}
      />
      {TOPICS.map((topic) => (
        <Chip
          key={topic.id}
          label={topic.name[language]}
          active={activeTag === topic.tag}
          onPress={() => onSelect(topic.tag)}
          colors={colors}
          language={language}
          themeMode={themeMode}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Outer edge now matches the app's standard screen padding (was 16, one
  // of the drifted values from the earlier consistency pass) — every
  // screen embedding this strip (feed header, Profile > Personalize Feed)
  // now lines up at the same 20px edge.
  container: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SCREEN_PADDING },
  // Horizontal padding tightened from 13 — at 13 the pill read as
  // over-padded/circular per feedback, especially on short topic names.
  chip: { paddingHorizontal: SPACING.sm, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  chipText: { fontSize: 12, letterSpacing: 0.2, maxWidth: 160 },
});
