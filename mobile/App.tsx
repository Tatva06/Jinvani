import React, { useCallback, useState } from 'react';
import {
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FlashList, ListRenderItemInfo } from '@shopify/flash-list';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { SEED_CARDS } from './src/seedData';
import { Language, SeedCard } from './src/types';

// ─── Constants ────────────────────────────────────────────────────────────────
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const LANGUAGES: Language[] = ['en', 'hi', 'gu'];
const LANG_LABELS: Record<Language, string> = { en: 'EN', hi: 'HI', gu: 'GU' };

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg: '#0A0A0F',
  surface: '#12121A',
  surfaceElevated: '#1C1C28',
  border: '#2A2A3D',
  accent: '#C8A96E',         // warm saffron-gold
  accentMuted: 'rgba(200,169,110,0.15)',
  accentBorder: 'rgba(200,169,110,0.35)',
  text: '#F0EDE8',           // warm off-white
  textSecondary: '#9B97A8',
  textMuted: '#5C5870',
  takeawayBg: 'rgba(200,169,110,0.08)',
  takeawayBorder: '#C8A96E',
  verseBg: 'rgba(255,255,255,0.04)',
  verseBorder: 'rgba(255,255,255,0.1)',
};

// ─── Card Component ───────────────────────────────────────────────────────────
interface CardProps {
  card: SeedCard;
  language: Language;
  screenHeight: number;
}

const JinvaniCard = React.memo(({ card, language, screenHeight }: CardProps) => {
  const insets = useSafeAreaInsets();
  const content = card.content[language];

  return (
    <View style={[styles.card, { height: screenHeight }]}>
      {/* ── Decorative gradient orb ── */}
      <View style={styles.glowOrb} pointerEvents="none" />

      {/* ── Inner scroll-safe container ── */}
      <View style={[styles.cardInner, { paddingTop: insets.top + 72, paddingBottom: insets.bottom + 20 }]}>

        {/* ═══════════ TOP SECTION ═══════════ */}
        <View style={styles.topSection}>
          <View style={styles.deckBadge}>
            <Text style={styles.deckBadgeText} numberOfLines={1}>
              {card.deckTitle}
            </Text>
          </View>
          <Text style={styles.cardIndexText}>{card.cardIndex}</Text>
        </View>

        {/* ═══════════ MIDDLE SECTION ════════ */}
        <View style={styles.middleSection}>
          {/* Title */}
          <Text style={styles.cardTitle}>{content.title}</Text>

          {/* Divider */}
          <View style={styles.titleDivider} />

          {/* Body */}
          <Text style={styles.bodyText}>{content.body}</Text>

          {/* Original Verse (optional) */}
          {card.originalVerse && (
            <View style={styles.verseContainer}>
              <Text style={styles.verseScriptLabel}>{card.originalVerse.script}</Text>
              <Text style={styles.verseText}>{card.originalVerse.text}</Text>
            </View>
          )}
        </View>

        {/* ═══════════ BOTTOM SECTION ════════ */}
        <View style={styles.bottomSection}>
          {/* Key Takeaway */}
          <View style={styles.takeawayBox}>
            <View style={styles.takeawayHeader}>
              <View style={styles.takeawayDot} />
              <Text style={styles.takeawayLabel}>Key Takeaway</Text>
            </View>
            <Text style={styles.takeawayText}>{content.takeaway}</Text>
          </View>

          {/* Citation */}
          <Text style={styles.citationText}>{card.citation}</Text>
        </View>

      </View>
    </View>
  );
});

JinvaniCard.displayName = 'JinvaniCard';

// ─── Language Toggle ──────────────────────────────────────────────────────────
interface LangToggleProps {
  active: Language;
  onSelect: (l: Language) => void;
}

const LanguageToggle = ({ active, onSelect }: LangToggleProps) => {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.langToggle, { top: insets.top + 12 }]}>
      {LANGUAGES.map((lang) => (
        <Pressable
          key={lang}
          onPress={() => onSelect(lang)}
          style={[
            styles.langPill,
            active === lang && styles.langPillActive,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Switch to ${lang.toUpperCase()}`}
          accessibilityState={{ selected: active === lang }}
        >
          <Text style={[styles.langPillText, active === lang && styles.langPillTextActive]}>
            {LANG_LABELS[lang]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
};

// ─── App Root ─────────────────────────────────────────────────────────────────
function FeedScreen() {
  const [language, setLanguage] = useState<Language>('en');

  // ── renderItem: language is read from extraData to avoid FlashList re-mount ──
  const renderItem = useCallback(
    ({ item, extraData }: ListRenderItemInfo<SeedCard>) => {
      const lang = (extraData as Language) ?? 'en';
      return (
        <JinvaniCard
          card={item}
          language={lang}
          screenHeight={SCREEN_HEIGHT}
        />
      );
    },
    [],
  );

  const keyExtractor = useCallback((item: SeedCard) => item.id, []);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <FlashList
        data={SEED_CARDS}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        extraData={language}
        // ── Snapping physics ──
        pagingEnabled={Platform.OS === 'ios'}
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        // ── Layout ──
        showsVerticalScrollIndicator={false}
        bounces={false}
      />

      {/* Floating language toggle — rendered above list, does not affect layout */}
      <LanguageToggle active={language} onSelect={setLanguage} />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <FeedScreen />
    </SafeAreaProvider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // ── Card ──
  card: {
    backgroundColor: C.bg,
    width: '100%',
    overflow: 'hidden',
  },
  glowOrb: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(200,169,110,0.06)',
  },
  cardInner: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },

  // ── Top ──
  topSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  deckBadge: {
    borderWidth: 1,
    borderColor: C.accentBorder,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    backgroundColor: C.accentMuted,
    maxWidth: '75%',
  },
  deckBadgeText: {
    color: C.accent,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  cardIndexText: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.4,
  },

  // ── Middle ──
  middleSection: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 16,
  },
  cardTitle: {
    color: C.text,
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 34,
    letterSpacing: -0.3,
    marginBottom: 16,
  },
  titleDivider: {
    width: 36,
    height: 2,
    backgroundColor: C.accent,
    borderRadius: 1,
    marginBottom: 20,
    opacity: 0.7,
  },
  bodyText: {
    color: '#C8C4D4',
    fontSize: 15.5,
    lineHeight: 26,
    fontWeight: '400',
    letterSpacing: 0.1,
  },

  // ── Original Verse ──
  verseContainer: {
    marginTop: 22,
    padding: 16,
    backgroundColor: C.verseBg,
    borderWidth: 1,
    borderColor: C.verseBorder,
    borderRadius: 12,
  },
  verseScriptLabel: {
    color: C.textMuted,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  verseText: {
    color: '#E8D5A3',
    fontSize: 15,
    lineHeight: 24,
    fontStyle: 'italic',
    letterSpacing: 0.3,
  },

  // ── Bottom ──
  bottomSection: {
    gap: 14,
  },
  takeawayBox: {
    backgroundColor: C.takeawayBg,
    borderWidth: 1,
    borderColor: C.accentBorder,
    borderRadius: 16,
    padding: 16,
  },
  takeawayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  takeawayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.accent,
  },
  takeawayLabel: {
    color: C.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  takeawayText: {
    color: C.text,
    fontSize: 14.5,
    lineHeight: 22,
    fontWeight: '400',
  },
  citationText: {
    color: C.textMuted,
    fontSize: 11.5,
    fontStyle: 'italic',
    textAlign: 'right',
    letterSpacing: 0.2,
    paddingRight: 4,
    marginBottom: 4,
  },

  // ── Language Toggle ──
  langToggle: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    gap: 6,
    backgroundColor: 'rgba(18,18,26,0.85)',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 24,
    padding: 4,
    // glass blur effect via shadow (native only)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  langPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  langPillActive: {
    backgroundColor: C.accent,
  },
  langPillText: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  langPillTextActive: {
    color: '#0A0A0F',
    fontWeight: '700',
  },
});
