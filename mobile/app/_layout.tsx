import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View } from 'react-native';
import { useThemeStore } from '../src/store/useThemeStore';
import { useFeedStore } from '../src/store/useFeedStore';
import { useAuthStore } from '../src/store/useAuthStore';
import { Colors } from '../src/theme';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { useScriptFonts } from '../src/utils/fonts';

export default function RootLayout() {
  const theme = useThemeStore((state) => state.theme);
  const loadTheme = useThemeStore((state) => state.loadTheme);
  const loadLanguage = useFeedStore((state) => state.loadLanguage);
  const initAuth = useAuthStore((state) => state.init);
  const colors = Colors[theme];
  const scriptFontsLoaded = useScriptFonts();

  useEffect(() => {
    loadTheme();
    loadLanguage();
    initAuth();
  }, [loadTheme, loadLanguage, initAuth]);

  // Hold a blank frame (in the current theme's background) rather than
  // flashing Devanagari/Gujarati text in the system font before the
  // bundled Noto Sans weights are ready.
  if (!scriptFontsLoaded) {
    return <View style={[styles.container, { backgroundColor: colors.bg }]} />;
  }

  return (
    <GestureHandlerRootView style={[styles.container, { backgroundColor: colors.bg }]}>
      <SafeAreaProvider>
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
        <View style={[styles.container, { backgroundColor: colors.bg }]}>
          <ErrorBoundary>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="auth" options={{ headerShown: false, presentation: 'modal' }} />
            </Stack>
          </ErrorBoundary>
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
