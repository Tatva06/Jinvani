import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';

import { Colors } from '../theme';
import { SCREEN_PADDING } from '../theme/spacing';

// Shown only during the very first feed fetch (see useFeedStore's
// hasLoadedOnce) — not a real card, so it deliberately doesn't reuse
// JinvaniCard's component/logic (nothing there applies to a placeholder
// with no data), but its block sizes mirror JinvaniCard's actual
// proportions (cardTitle/bodyText/takeawayBox) rather than arbitrary
// guesses, so the transition into real content doesn't visibly jump.
export function JinvaniCardSkeleton({
  themeMode,
  screenHeight,
}: {
  themeMode: 'dark' | 'light';
  screenHeight: number;
}) {
  const insets = useSafeAreaInsets();
  const c = Colors[themeMode];

  const pulse = useSharedValue(0.5);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  const Block = ({ style }: { style: object }) => (
    <Animated.View style={[{ backgroundColor: c.border, borderRadius: 6 }, style, pulseStyle]} />
  );

  return (
    <View
      style={[styles.card, { height: screenHeight, backgroundColor: c.bg }]}
      accessibilityLabel="Loading cards"
      accessibilityRole="progressbar"
    >
      <View style={[styles.cardInner, { paddingTop: 20, paddingBottom: insets.bottom + 180 }]}>
        {/* Top — mirrors deckBadge + cardIndexText */}
        <View style={styles.topSection}>
          <Block style={{ width: 110, height: 22, borderRadius: 20 }} />
          <Block style={{ width: 48, height: 14 }} />
        </View>

        {/* Title — mirrors cardTitle (2 lines) + titleDivider */}
        <View>
          <Block style={{ width: '85%', height: 25, marginBottom: 10 }} />
          <Block style={{ width: '55%', height: 25, marginBottom: 14 }} />
          <Block style={{ width: 36, height: 2, marginBottom: 18, borderRadius: 1 }} />
        </View>

        {/* Body — mirrors bodyText lines */}
        <View style={styles.bodyRegion}>
          <Block style={{ width: '100%', height: 16, marginBottom: 12 }} />
          <Block style={{ width: '100%', height: 16, marginBottom: 12 }} />
          <Block style={{ width: '90%', height: 16, marginBottom: 12 }} />
          <Block style={{ width: '70%', height: 16 }} />
        </View>

        {/* Bottom — mirrors takeawayBox */}
        <View style={[styles.takeawayBox, { borderColor: c.border }]}>
          <Block style={{ width: 90, height: 11, marginBottom: 10 }} />
          <Block style={{ width: '100%', height: 15.5, marginBottom: 8 }} />
          <Block style={{ width: '60%', height: 15.5 }} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', overflow: 'hidden' },
  cardInner: { flex: 1, paddingHorizontal: SCREEN_PADDING },
  topSection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  bodyRegion: { flex: 1, justifyContent: 'center' },
  takeawayBox: { borderWidth: 1, borderRadius: 16, padding: 15 },
});
