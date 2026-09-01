import React from 'react';
import { AccessibilityInfo, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
    return <Text maxFontSizeMultiplier={1.3} style={[styles.citationText, { color: colors.textMuted }]}>{label}</Text>;
  }

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/book/[bookId]', params: { bookId: card.bookId! } })}
      hitSlop={6}
    >
      <Text maxFontSizeMultiplier={1.3} style={[styles.citationText, styles.citationTextTappable, { color: colors.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

// Book attribution (migration 004_book_attribution.sql) — every field is
// None until that's applied AND the card's deck has a matching books
// row, so this renders nothing at all (not an empty row/stray "by ")
// when there's nothing to show. "Read Complete Original" is scoped to
// digest cards specifically (per the original ask) — a digest is a
// compressed stand-in for a full source text, so linking out to the
// complete original is exactly what that card type wants; other card
// types either already ARE the full text (verbatim) or aren't tied to
// one linear source (summary/chunked_verse/narrative).
function AttributionFooter({
  card,
  colors,
  language,
}: {
  card: SeedCard;
  colors: (typeof Colors)['dark'];
  language: Language;
}) {
  const t = CHROME[language].feed;

  const parts: string[] = [];
  if (card.bookTitle) parts.push(card.bookTitle);
  if (card.authorName) parts.push(`${t.attributionBy} ${card.authorName}`);
  if (card.rightsNote) parts.push(card.rightsNote);
  else if (card.isPublicDomain) parts.push(t.publicDomain);
  const attributionText = parts.join(' · ');

  const showReadOriginal = card.cardType === 'digest' && Boolean(card.sourceUrl);

  if (!attributionText && !showReadOriginal) return null;

  return (
    <View style={styles.attributionFooter}>
      {attributionText.length > 0 && (
        <Text maxFontSizeMultiplier={1.3} style={[styles.attributionText, { color: colors.textMuted }]} numberOfLines={2}>
          {attributionText}
        </Text>
      )}
      {showReadOriginal && (
        <Pressable
          onPress={() => Linking.openURL(card.sourceUrl!).catch(() => {})}
          hitSlop={8}
          accessibilityRole="link"
          accessibilityLabel={t.readCompleteOriginal}
        >
          <Text maxFontSizeMultiplier={1.3} style={[styles.readOriginalText, { color: colors.accent }]}>
            {t.readCompleteOriginal}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const FLIP_DURATION_MS = 420;

// cardInner's bottom padding, on top of insets.bottom. This card is given
// `screenHeight` (the full window height) even though the feed screen's
// visible viewport is shorter than that by (sticky header height + tab
// bar height) — both sit outside the paging FlashList, so every card's
// bottom edge extends that far below what's actually visible. This
// constant is what pulls the Key Takeaway box + citation back up into
// the visible area. Was 80 (just clearing the tab bar); confirmed via
// screenshot that this under-counted the sticky header's own height too,
// clipping the takeaway box's bottom border and citation. 180 clears
// both with comfortable margin on a real device — re-check visually if
// the feed header's height or the tab bar's height/style ever changes.
const CARD_BOTTOM_PADDING = 180;

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

  // flex-start reads well once there's enough body text to make top
  // alignment look intentional (confirmed against a real medium card:
  // Ācārāṅga Sūtra / "All Living Beings Desire to Live", ~425 chars). But
  // the one genuinely short card in the real dataset (~123 chars, 17
  // words) looked broken with flex-start — all its leftover space
  // dumped below the text as one large dead gap. 200 chars sits safely
  // between that outlier and every other card actually seen (next
  // shortest is ~389 chars), so centering is kept only for content this
  // sparse; everything else uses flex-start.
  const isVerySparseBody = content.body.length < 200;

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

  // Reduce Motion — checked once on mount and kept live via the OS
  // change event, same as any other system-settings-driven UI toggle.
  // When on, the flip snaps instantly instead of forcing the rotation
  // transition regardless of the user's accessibility setting.
  const [reduceMotionEnabled, setReduceMotionEnabled] = React.useState(false);
  React.useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotionEnabled);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotionEnabled);
    return () => sub.remove();
  }, []);

  const flip = () => {
    if (!canFlip) return;
    const next = rotation.value === 0 ? 180 : 0;
    rotation.value = reduceMotionEnabled ? next : withTiming(next, { duration: FLIP_DURATION_MS });
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
        <View style={[styles.cardInner, { paddingTop: 20, paddingBottom: insets.bottom + CARD_BOTTOM_PADDING }]}>
          {/* Top */}
          <View style={styles.topSection}>
            {card.isFeatured ? (
              // Type 4 — "Today's Special": a label/badge is enough, reusing
              // this same card rather than a second card component (only
              // ever true for the one pinned card useFeedStore prepends).
              <View style={[styles.featuredBadge, { backgroundColor: c.accent }]}>
                <Sparkles size={11} color={themeMode === 'dark' ? '#0A0A0F' : '#FFFFFF'} />
                <Text maxFontSizeMultiplier={1.3} style={[styles.featuredBadgeText, { color: themeMode === 'dark' ? '#0A0A0F' : '#FFFFFF' }]} numberOfLines={1}>
                  {CHROME[language].feed.todaysSpecial}
                </Text>
              </View>
            ) : (
              <View style={[styles.deckBadge, { backgroundColor: c.accentMuted, borderColor: c.accentBorder }]}>
                <Text maxFontSizeMultiplier={1.3} style={[styles.deckBadgeText, { color: c.accent }]} numberOfLines={1}>
                  {card.deckTitle}
                </Text>
              </View>
            )}
            <View style={styles.indexRow}>
              {isBookMode && <BookOpen size={12} color={c.accent} />}
              <Text maxFontSizeMultiplier={1.3} style={[styles.cardIndexText, { color: c.textMuted }]}>{card.cardIndex}</Text>
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
            <Text maxFontSizeMultiplier={1.3} style={[styles.cardTitle, { color: c.text, fontFamily: scriptFontFamily(language, '700') }]}>{content.title}</Text>
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
              contentContainerStyle={[
                styles.bodyScrollContent,
                isVerySparseBody && styles.bodyScrollContentCentered,
              ]}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              <Text maxFontSizeMultiplier={1.3} style={[styles.bodyText, { color: c.textSecondary, fontFamily: scriptFontFamily(language, '400') }]}>{content.body}</Text>
              {card.originalVerse && (
                <View style={[styles.verseContainer, { backgroundColor: c.verseBg, borderColor: c.verseBorder }]}>
                  <Text maxFontSizeMultiplier={1.3} style={[styles.verseScriptLabel, { color: c.textMuted }]}>
                    {card.originalVerse.script}
                  </Text>
                  <Text maxFontSizeMultiplier={1.3} style={[styles.verseText, { color: c.accent, fontFamily: verseScriptFontFamily('400') }]}>
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
                <Text maxFontSizeMultiplier={1.3} style={[styles.takeawayLabel, { color: c.accent, fontFamily: scriptFontFamily(language, '700') }]}>{CHROME[language].feed.keyTakeaway}</Text>
              </View>
              <Text maxFontSizeMultiplier={1.3} style={[styles.takeawayText, { color: c.text, fontFamily: scriptFontFamily(language, '400') }]}>{content.takeaway}</Text>
            </View>
            <SourceLabel card={card} colors={c} />
            <AttributionFooter card={card} colors={c} language={language} />
          </View>
        </View>
      </Animated.View>

      {/* ─── Back face — original verse, only for chunked_verse cards ─── */}
      {canFlip && card.originalVerse && (
        <Animated.View
          style={[styles.face, backAnimatedStyle]}
          pointerEvents={isBack ? 'auto' : 'none'}
        >
          <View style={[styles.cardInner, styles.backInner, { paddingTop: 20, paddingBottom: insets.bottom + CARD_BOTTOM_PADDING }]}>
            <Text maxFontSizeMultiplier={1.3} style={[styles.backLabel, { color: c.accent }]}>{CHROME[language].feed.originalSource}</Text>
            <View style={[styles.titleDivider, { backgroundColor: c.accent }]} />
            <Text maxFontSizeMultiplier={1.3} style={[styles.backScriptLabel, { color: c.textMuted }]}>
              {card.originalVerse.script}
            </Text>
            <Text maxFontSizeMultiplier={1.3} style={[styles.backVerseText, { color: c.text, fontFamily: verseScriptFontFamily('400') }]}>
              {card.originalVerse.text}
            </Text>
            <Text maxFontSizeMultiplier={1.3} style={[styles.citationText, styles.backCitation, { color: c.textMuted }]}>
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
  // flexGrow (not flex) + justifyContent:'flex-start' — text starts right
  // after the divider (paddingVertical gives the breathing room) instead
  // of being vertically centered. Centering left a large, visually
  // awkward gap after the divider on medium-length cards (confirmed
  // against a real card: Ācārāṅga Sūtra / "All Living Beings Desire to
  // Live"). Doesn't affect overflow behavior — that's the bounded height
  // + ScrollView, not this axis — and has zero effect on long/stress
  // cards, where content already fills or exceeds the box (no leftover
  // space for either value to distribute differently). Only genuinely
  // sparse cards (isVerySparseBody) opt back into centering below, via
  // bodyScrollContentCentered — see that comment for why.
  bodyScrollContent: { flexGrow: 1, justifyContent: 'flex-start', paddingVertical: 12 },
  // Override for the isVerySparseBody case — flex-start on ~17-word
  // content dumps 100% of the leftover space below the text as one
  // large dead gap before the takeaway box (confirmed against the real
  // shortest card in the dataset, "The Path to Liberation"); centering
  // splits that same leftover space top/bottom, which reads as
  // intentional breathing room instead of a broken layout.
  bodyScrollContentCentered: { justifyContent: 'center' },
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
  // Sits directly below SourceLabel's citation, right-aligned to match it —
  // reads as one continuous "source info" block rather than two unrelated
  // rows. -6 pulls it closer to the citation than bottomSection's gap:12
  // default, since these two rows are conceptually one unit.
  attributionFooter: { alignItems: 'flex-end', gap: 4, marginTop: -6 },
  attributionText: { fontSize: 11, textAlign: 'right', paddingRight: 4 },
  readOriginalText: { fontSize: 12, fontWeight: '700', textAlign: 'right', paddingRight: 4, textDecorationLine: 'underline' },
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
