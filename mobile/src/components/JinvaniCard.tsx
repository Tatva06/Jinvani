import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { RotateCw, Bookmark } from 'lucide-react-native';

import { Colors } from '../theme';
import { Language, SeedCard } from '../types';
import { resolveCardContent } from '../utils/content';
import { CHROME } from '../i18n/chrome';
import { scriptFontFamily, verseScriptFontFamily } from '../utils/fonts';
import { useSavedStore } from '../store/useSavedStore';
import { useAuthStore } from '../store/useAuthStore';

const FLIP_DURATION_MS = 420;

export const JinvaniCard = React.memo(function JinvaniCard({
  card,
  language,
  themeMode,
  screenHeight,
}: {
  card: SeedCard;
  language: Language;
  themeMode: 'dark' | 'light';
  screenHeight: number;
}) {
  const insets = useSafeAreaInsets();
  const c = Colors[themeMode];
  const content = resolveCardContent(card.content, language);

  // A card is flippable purely based on whether there's an original verse to
  // show on the back — this is the real condition that matters (and covers
  // both API-fetched cards, which carry cardType, and local seed-data
  // fallback cards, which currently don't).
  const canFlip = Boolean(card.originalVerse);

  const router = useRouter();
  const isSaved = useSavedStore((s) => s.isSaved(card.id));
  const toggleSaved = useSavedStore((s) => s.toggleSaved);
  const profileId = useAuthStore((s) => s.profileId);

  const handleToggleSaved = async () => {
    const result = await toggleSaved(profileId, card);
    if (result === 'requires-login') {
      router.push('/auth');
    }
  };

  // Worklet-driven rotation — runs on the UI thread, not JS-thread state.
  // 0deg = front face showing, 180deg = back face showing.
  const rotation = useSharedValue(0);
  const [isBack, setIsBack] = React.useState(false);

  const flip = () => {
    if (!canFlip) return;
    const next = rotation.value === 0 ? 180 : 0;
    rotation.value = withTiming(next, { duration: FLIP_DURATION_MS });
    setIsBack(next === 180);
  };

  const frontAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateY: `${interpolate(rotation.value, [0, 180], [0, 180])}deg` },
    ],
    opacity: rotation.value < 90 ? 1 : 0,
  }));

  const backAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateY: `${interpolate(rotation.value, [0, 180], [180, 360])}deg` },
    ],
    opacity: rotation.value >= 90 ? 1 : 0,
  }));

  return (
    <View style={[styles.card, { height: screenHeight, backgroundColor: c.bg }]}>
      <View
        style={[styles.glowOrb, {
          backgroundColor: themeMode === 'dark'
            ? 'rgba(200,169,110,0.06)'
            : 'rgba(156,111,46,0.06)',
        }]}
        pointerEvents="none"
      />

      {/* ─── Front face ─── */}
      <Animated.View
        style={[styles.face, frontAnimatedStyle]}
        pointerEvents={isBack ? 'none' : 'auto'}
      >
        <View style={[styles.cardInner, { paddingTop: insets.top + 100, paddingBottom: insets.bottom + 80 }]}>
          {/* Top */}
          <View style={styles.topSection}>
            <View style={[styles.deckBadge, { backgroundColor: c.accentMuted, borderColor: c.accentBorder }]}>
              <Text style={[styles.deckBadgeText, { color: c.accent }]} numberOfLines={1}>
                {card.deckTitle}
              </Text>
            </View>
            <Text style={[styles.cardIndexText, { color: c.textMuted }]}>{card.cardIndex}</Text>
          </View>

          {/* Middle */}
          <View style={styles.middleSection}>
            <Text style={[styles.cardTitle, { color: c.text, fontFamily: scriptFontFamily(language, '700') }]}>{content.title}</Text>
            <View style={[styles.titleDivider, { backgroundColor: c.accent }]} />
            <Text style={[styles.bodyText, { color: c.textSecondary, fontFamily: scriptFontFamily(language, '400') }]}>{content.body}</Text>
            {card.originalVerse && (
              <View style={[styles.verseContainer, { backgroundColor: c.verseBg, borderColor: c.verseBorder }]}>
                <Text style={[styles.verseScriptLabel, { color: c.textMuted }]}>
                  {card.originalVerse.script}
                </Text>
                <Text style={[styles.verseText, { color: c.accent, fontFamily: verseScriptFontFamily('400') }]}>
                  {card.originalVerse.text}
                </Text>
              </View>
            )}
          </View>

          {/* Bottom */}
          <View style={styles.bottomSection}>
            <View style={[styles.takeawayBox, { backgroundColor: c.takeawayBg, borderColor: c.accentBorder }]}>
              <View style={styles.takeawayHeader}>
                <View style={[styles.takeawayDot, { backgroundColor: c.accent }]} />
                <Text style={[styles.takeawayLabel, { color: c.accent, fontFamily: scriptFontFamily(language, '700') }]}>{CHROME[language].feed.keyTakeaway}</Text>
              </View>
              <Text style={[styles.takeawayText, { color: c.text, fontFamily: scriptFontFamily(language, '400') }]}>{content.takeaway}</Text>
            </View>
            <Text style={[styles.citationText, { color: c.textMuted }]}>{card.citation}</Text>
          </View>
        </View>
      </Animated.View>

      {/* ─── Back face — original verse, only for chunked_verse cards ─── */}
      {canFlip && card.originalVerse && (
        <Animated.View
          style={[styles.face, backAnimatedStyle]}
          pointerEvents={isBack ? 'auto' : 'none'}
        >
          <View style={[styles.cardInner, styles.backInner, { paddingTop: insets.top + 100, paddingBottom: insets.bottom + 80 }]}>
            <Text style={[styles.backLabel, { color: c.accent }]}>{CHROME[language].feed.originalSource}</Text>
            <View style={[styles.titleDivider, { backgroundColor: c.accent }]} />
            <Text style={[styles.backScriptLabel, { color: c.textMuted }]}>
              {card.originalVerse.script}
            </Text>
            <Text style={[styles.backVerseText, { color: c.text, fontFamily: verseScriptFontFamily('400') }]}>
              {card.originalVerse.text}
            </Text>
            <Text style={[styles.citationText, styles.backCitation, { color: c.textMuted }]}>
              {card.citation}
            </Text>
          </View>
        </Animated.View>
      )}

      {/* ─── Flip affordance ─── */}
      {canFlip && (
        <Pressable
          onPress={flip}
          hitSlop={12}
          style={[styles.flipButton, styles.rightActionButton, {
            backgroundColor: c.accentMuted,
            borderColor: c.accentBorder,
            bottom: insets.bottom + 96,
          }]}
        >
          <RotateCw size={16} color={c.accent} />
        </Pressable>
      )}

      {/* ─── Save — requires login; prompts the auth screen if logged out ─── */}
      <Pressable
        onPress={handleToggleSaved}
        hitSlop={12}
        style={[styles.flipButton, styles.leftActionButton, {
          backgroundColor: isSaved ? c.accent : c.accentMuted,
          borderColor: c.accentBorder,
          bottom: insets.bottom + 96,
        }]}
      >
        <Bookmark
          size={16}
          color={isSaved ? (themeMode === 'dark' ? '#0A0A0F' : '#FFFFFF') : c.accent}
          fill={isSaved ? (themeMode === 'dark' ? '#0A0A0F' : '#FFFFFF') : 'none'}
        />
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { width: '100%', overflow: 'hidden' },
  face: { ...StyleSheet.absoluteFillObject, backfaceVisibility: 'hidden' },
  glowOrb: { position: 'absolute', top: -120, right: -80, width: 280, height: 280, borderRadius: 140 },
  cardInner: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between' },
  topSection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  deckBadge: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, maxWidth: '75%' },
  deckBadgeText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },
  cardIndexText: { fontSize: 11, fontWeight: '500', letterSpacing: 0.4 },
  middleSection: { flex: 1, justifyContent: 'center', paddingVertical: 12 },
  cardTitle: { fontSize: 25, fontWeight: '700', lineHeight: 33, letterSpacing: -0.3, marginBottom: 14 },
  titleDivider: { width: 36, height: 2, borderRadius: 1, marginBottom: 18, opacity: 0.8 },
  bodyText: { fontSize: 15.5, lineHeight: 25, fontWeight: '400', letterSpacing: 0.1 },
  verseContainer: { marginTop: 20, padding: 14, borderWidth: 1, borderRadius: 12 },
  verseScriptLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 },
  verseText: { fontSize: 14.5, lineHeight: 23, fontStyle: 'italic', letterSpacing: 0.3 },
  bottomSection: { gap: 12 },
  takeawayBox: { borderWidth: 1, borderRadius: 16, padding: 15 },
  takeawayHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  takeawayDot: { width: 6, height: 6, borderRadius: 3 },
  takeawayLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase' },
  takeawayText: { fontSize: 14, lineHeight: 21 },
  citationText: { fontSize: 11.5, fontStyle: 'italic', textAlign: 'right', letterSpacing: 0.2, paddingRight: 4, marginBottom: 2 },
  backInner: { justifyContent: 'center', alignItems: 'center' },
  backLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14, textAlign: 'center' },
  backScriptLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 18, textAlign: 'center' },
  backVerseText: { fontSize: 20, lineHeight: 32, fontStyle: 'italic', textAlign: 'center', letterSpacing: 0.2 },
  backCitation: { position: 'absolute', bottom: 0, right: 0, textAlign: 'center' },
  flipButton: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightActionButton: { right: 20 },
  leftActionButton: { left: 20 },
});
