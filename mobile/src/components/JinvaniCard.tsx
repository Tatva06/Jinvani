import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { RotateCw, Bookmark, Sparkles, BookOpen } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { Colors } from '../theme';
import { SCREEN_PADDING } from '../theme/spacing';
import { TYPE } from '../theme/typography';
import { Language, SeedCard } from '../types';
import { resolveCardContent } from '../utils/content';
import { CHROME } from '../i18n/chrome';
import { scriptFontFamily, verseScriptFontFamily } from '../utils/fonts';
import { useSavedStore } from '../store/useSavedStore';
import { useAuthStore } from '../store/useAuthStore';
import { useFeedStore } from '../store/useFeedStore';

function SourceLabel({
  card,
  colors,
}: {
  card: SeedCard;
  colors: (typeof Colors)['dark'];
}) {
  const router = useRouter();
  const label = card.deckTitle ? `${card.deckTitle} • ${card.citation}` : card.citation;

  if (!card.bookId) {
    // No book_id (e.g. an offline seed-data fallback card) — nothing to
    // navigate to, so render as plain text rather than a dead tap target.
    return <Text style={[styles.citationText, { color: colors.textMuted }]}>{label}</Text>;
  }

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/book/[bookId]', params: { bookId: card.bookId! } })}
      hitSlop={6}
    >
      <Text style={[styles.citationText, styles.citationTextTappable, { color: colors.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

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
  // Book reading mode (verbatim/narrative sequential reading) gets a purely
  // visual treatment here — same swipe gesture and layout as the main feed,
  // just a tint/border/badge so it's recognizably a different mode.
  const isBookMode = useFeedStore((s) => s.isBookMode);

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  // Press-scale animations for action buttons
  const flipScale = useSharedValue(1);
  const bookmarkScale = useSharedValue(1);
  const flipButtonStyle = useAnimatedStyle(() => ({ transform: [{ scale: flipScale.value }] }));
  const bookmarkButtonStyle = useAnimatedStyle(() => ({ transform: [{ scale: bookmarkScale.value }] }));

  const handleToggleSavedWithHaptic = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await toggleSaved(profileId, card);
    if (result === 'requires-login') {
      router.push('/auth');
    }
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
    <View
      style={[
        styles.card,
        { height: screenHeight, backgroundColor: c.bg },
        isBookMode && { borderWidth: 2, borderColor: c.accent },
      ]}
    >
      <View
        style={[styles.glowOrb, {
          backgroundColor: themeMode === 'dark'
            ? 'rgba(200,169,110,0.12)'
            : 'rgba(139,93,32,0.10)',
        }]}
        pointerEvents="none"
      />
      {/* Book reading mode tint — a subtle full-card wash, purely visual;
          doesn't touch layout or the swipe gesture beneath it. */}
      {isBookMode && (
        <View style={[styles.bookModeTint, { backgroundColor: c.accentMuted }]} pointerEvents="none" />
      )}

      {/* ─── Front face ─── */}
      <Animated.View
        style={[styles.face, frontAnimatedStyle]}
        pointerEvents={isBack ? 'none' : 'auto'}
      >
        <View style={[styles.cardInner, { paddingTop: 20, paddingBottom: insets.bottom + 80 }]}>
          {/* Top */}
          <View style={styles.topSection}>
            {card.isFeatured ? (
              // Type 4 — "Today's Special": a label/badge is enough, reusing
              // this same card rather than a second card component (only
              // ever true for the one pinned card useFeedStore prepends).
              <View style={[styles.featuredBadge, { backgroundColor: c.accent }]}>
                <Sparkles size={11} color={themeMode === 'dark' ? '#0A0A0F' : '#FFFFFF'} />
                <Text style={[styles.featuredBadgeText, { color: themeMode === 'dark' ? '#0A0A0F' : '#FFFFFF' }]} numberOfLines={1}>
                  {CHROME[language].feed.todaysSpecial}
                </Text>
              </View>
            ) : (
              <View style={[styles.deckBadge, { backgroundColor: c.accentMuted, borderColor: c.accentBorder }]}>
                <Text style={[styles.deckBadgeText, { color: c.accent }]} numberOfLines={1}>
                  {card.deckTitle}
                </Text>
              </View>
            )}
            <View style={styles.indexRow}>
              {isBookMode && <BookOpen size={12} color={c.accent} />}
              <Text style={[styles.cardIndexText, { color: c.textMuted }]}>{card.cardIndex}</Text>
            </View>
          </View>

          {/* Title — its own fixed-height block, always directly below the
              header row (topSection). Deliberately NOT part of the
              scrollable/auto-centered body block below: a box that centers
              its content by auto-sizing to it and a box with a bounded,
              scrollable height are mutually exclusive, and pinning the
              title outside that block is what makes it structurally
              impossible for a wrapped 2-line title to paint back up over
              the badge above it (previously: title lived inside a flex:1
              centered block whose content could exceed the box and bleed
              into siblings above/below, since RN doesn't clip overflowing
              children by default). */}
          <View>
            <Text style={[styles.cardTitle, { color: c.text, fontFamily: scriptFontFamily(language, '700') }]}>{content.title}</Text>
            <View style={[styles.titleDivider, { backgroundColor: c.accent }]} />
          </View>

          {/* Body — the ONLY scrollable region, bounded between the title
              above and the Key Takeaway box below (bottomSection, still a
              fixed-height sibling, never overlapped). contentContainerStyle
              uses flexGrow+justifyContent:'center' so short content (most
              cards) still renders centered exactly as before and isn't
              scrollable at all (contentSize <= box size — RN's ScrollView
              only claims the pan gesture when there's actually somewhere
              to scroll, so a short card's swipe-to-next-card gesture is
              unaffected). Long content scrolls within this box instead of
              overflowing into the takeaway box. */}
          <View style={styles.bodyRegion}>
            <ScrollView
              style={styles.bodyScroll}
              contentContainerStyle={styles.bodyScrollContent}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
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
            </ScrollView>
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
            <SourceLabel card={card} colors={c} />
          </View>
        </View>
      </Animated.View>

      {/* ─── Back face — original verse, only for chunked_verse cards ─── */}
      {canFlip && card.originalVerse && (
        <Animated.View
          style={[styles.face, backAnimatedStyle]}
          pointerEvents={isBack ? 'auto' : 'none'}
        >
          <View style={[styles.cardInner, styles.backInner, { paddingTop: 20, paddingBottom: insets.bottom + 80 }]}>
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
        <Animated.View style={[styles.flipButton, styles.rightActionButton, flipButtonStyle, {
          backgroundColor: c.accentMuted,
          borderColor: c.accentBorder,
          bottom: insets.bottom + 96,
        }]}>
          <Pressable
            onPress={() => {
              flipScale.value = withSpring(0.88, { damping: 10 }, () => {
                flipScale.value = withSpring(1);
              });
              flip();
            }}
            hitSlop={12}
            style={styles.actionButtonInner}
            accessibilityLabel="Flip card to see original verse"
            accessibilityRole="button"
          >
            <RotateCw size={16} color={c.accent} />
          </Pressable>
        </Animated.View>
      )}

      {/* ─── Save — requires login; prompts the auth screen if logged out ─── */}
      <Animated.View style={[styles.flipButton, styles.leftActionButton, bookmarkButtonStyle, {
        backgroundColor: isSaved ? c.accent : c.accentMuted,
        borderColor: c.accentBorder,
        bottom: insets.bottom + 96,
      }]}>
        <Pressable
          onPress={() => {
            bookmarkScale.value = withSpring(0.88, { damping: 10 }, () => {
              bookmarkScale.value = withSpring(1);
            });
            handleToggleSavedWithHaptic();
          }}
          hitSlop={12}
          style={styles.actionButtonInner}
          accessibilityLabel={isSaved ? 'Remove from saved' : 'Save this card'}
          accessibilityRole="button"
          accessibilityState={{ selected: isSaved }}
        >
          <Bookmark
            size={16}
            color={isSaved ? (themeMode === 'dark' ? '#0A0A0F' : '#FFFFFF') : c.accent}
            fill={isSaved ? (themeMode === 'dark' ? '#0A0A0F' : '#FFFFFF') : 'none'}
          />
        </Pressable>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { width: '100%', overflow: 'hidden' },
  face: { ...StyleSheet.absoluteFillObject, backfaceVisibility: 'hidden' },
  glowOrb: { position: 'absolute', top: -120, right: -80, width: 280, height: 280, borderRadius: 140 },
  bookModeTint: { ...StyleSheet.absoluteFillObject },
  // No justifyContent:'space-between' — the single flex:1 child
  // (bodyRegion) already consumes all remaining vertical space between
  // the fixed-height siblings around it, so space-between would be a
  // no-op at best and misleading to a future reader at worst.
  cardInner: { flex: 1, paddingHorizontal: SCREEN_PADDING },
  topSection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  deckBadge: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, maxWidth: '75%' },
  deckBadgeText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },
  featuredBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, maxWidth: '75%' },
  featuredBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  indexRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardIndexText: { fontSize: 11, fontWeight: '500', letterSpacing: 0.4 },
  cardTitle: { fontSize: 25, fontWeight: '700', lineHeight: 33, letterSpacing: -0.3, marginBottom: 14 },
  titleDivider: { width: 36, height: 2, borderRadius: 1, marginBottom: 18, opacity: 0.8 },
  // The one flexible box in cardInner's column — bounded height is what
  // makes the ScrollView inside it actually scrollable (an auto-sized-to-
  // content box can't also be a bounded scroll container).
  bodyRegion: { flex: 1 },
  bodyScroll: { flex: 1 },
  // flexGrow (not flex) + justifyContent:'center' on the CONTENT container
  // — the standard RN pattern for "centered when content fits, scrolls
  // normally (content pinned to top, no forced centering) once it
  // doesn't." Matches middleSection's old paddingVertical for short cards.
  bodyScrollContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: 12 },
  bodyText: { fontSize: 16, lineHeight: 26, fontWeight: '400', letterSpacing: 0.1 },
  verseContainer: { marginTop: 20, padding: 14, borderWidth: 1, borderRadius: 12 },
  verseScriptLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 },
  verseText: { fontSize: 14.5, lineHeight: 23, fontStyle: 'italic', letterSpacing: 0.3 },
  bottomSection: { gap: 12 },
  takeawayBox: { borderWidth: 1, borderRadius: 16, padding: 15 },
  takeawayHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  takeawayDot: { width: 6, height: 6, borderRadius: 3 },
  takeawayLabel: { ...TYPE.sectionLabel },
  // bumped from 14 → 15.5 since takeaway is the most important text on the card
  takeawayText: { fontSize: 15.5, lineHeight: 23 },
  citationText: { fontSize: 11.5, fontStyle: 'italic', textAlign: 'right', letterSpacing: 0.2, paddingRight: 4, marginBottom: 2 },
  citationTextTappable: { textDecorationLine: 'underline' },
  backInner: { justifyContent: 'center', alignItems: 'center' },
  backLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14, textAlign: 'center' },
  backScriptLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 18, textAlign: 'center' },
  backVerseText: { fontSize: 20, lineHeight: 32, fontStyle: 'italic', textAlign: 'center', letterSpacing: 0.2 },
  // citation is part of natural flow on back face, not absolute
  backCitation: { marginTop: 16, textAlign: 'center' },
  flipButton: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  actionButtonInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightActionButton: { right: 20 },
  leftActionButton: { left: 20 },
});
