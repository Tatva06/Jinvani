import React from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, Bookmark, Info, LogIn, LogOut, MessageCircle, Moon, Share2, Sun, User as UserIcon } from 'lucide-react-native';

import { useThemeStore } from '../../src/store/useThemeStore';
import { useFeedStore } from '../../src/store/useFeedStore';
import { useSavedStore } from '../../src/store/useSavedStore';
import { useAuthStore } from '../../src/store/useAuthStore';
import { Colors } from '../../src/theme';
import { Language, SeedCard } from '../../src/types';
import { SettingsRow } from '../../src/components/SettingsRow';
import { TopicStrip } from '../../src/components/TopicStrip';
import { CHROME } from '../../src/i18n/chrome';
import { scriptFontFamily } from '../../src/utils/fonts';
import { resolveCardContent } from '../../src/utils/content';

// Placeholder — not a real, monitored inbox. Replace before shipping.
const FEEDBACK_EMAIL = 'feedback@jinvani.example';
// Placeholder — the app isn't published anywhere yet. Replace before shipping.
const SHARE_LINK = 'https://jinvani.example/app';

const LANGUAGES: { code: Language; label: string; nativeLabel: string }[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी' },
  { code: 'gu', label: 'Gujarati', nativeLabel: 'ગુજરાતી' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const colors = Colors[theme];

  const language = useFeedStore((s) => s.language);
  const setLanguage = useFeedStore((s) => s.setLanguage);
  const defaultTopic = useFeedStore((s) => s.defaultTopic);
  const setDefaultTopic = useFeedStore((s) => s.setDefaultTopic);
  const openSingleCard = useFeedStore((s) => s.openSingleCard);
  const savedCards = useSavedStore((s) => s.savedCards);
  const isLoadingSaved = useSavedStore((s) => s.isLoading);

  const user = useAuthStore((s) => s.user);
  const isInitializingAuth = useAuthStore((s) => s.isInitializing);
  const signOut = useAuthStore((s) => s.signOut);

  const t = CHROME[language];
  const isDark = theme === 'dark';
  const isLoggedIn = Boolean(user);

  const handleOpenSaved = (card: SeedCard) => {
    openSingleCard(card);
    router.push({ pathname: '/(tabs)', params: { focusCard: card.id } });
  };

  const handleShare = () => {
    Share.share({ message: `${t.profile.shareMessage} ${SHARE_LINK}` }).catch(() => {});
  };

  const handleFeedback = () => {
    Linking.openURL(`mailto:${FEEDBACK_EMAIL}?subject=Jinvani%20Feedback`).catch(() => {});
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: colors.text, fontFamily: scriptFontFamily(language, '700') }]}>
          {t.profile.title}
        </Text>

        {/* — Account (real Supabase Auth — entirely optional; everything
             below this section works fully logged out) — */}
        {!isInitializingAuth && (
          isLoggedIn ? (
            <>
              <SettingsRow
                label={t.profile.loggedInAs}
                subtitle={user?.email ?? ''}
                language={language}
                icon={<UserIcon size={18} color={colors.accent} />}
                colors={colors}
                right={<View />}
              />
              <Pressable onPress={() => signOut()}>
                <SettingsRow
                  label={t.profile.logoutButton}
                  language={language}
                  icon={<LogOut size={18} color={colors.accent} />}
                  colors={colors}
                />
              </Pressable>
            </>
          ) : (
            <Pressable onPress={() => router.push('/auth')} style={[styles.loginBox, { backgroundColor: colors.accentMuted, borderColor: colors.accentBorder }]}>
              <LogIn size={18} color={colors.accent} />
              <View style={styles.loginBoxText}>
                <Text style={[styles.loginPrompt, { color: colors.text, fontFamily: scriptFontFamily(language, '500') }]}>
                  {t.profile.loginPrompt}
                </Text>
                <Text style={[styles.loginButtonText, { color: colors.accent, fontFamily: scriptFontFamily(language, '700') }]}>
                  {t.profile.loginButton}
                </Text>
              </View>
            </Pressable>
          )
        )}

        {/* — Saved (real, cross-device — requires login) — */}
        {isLoggedIn && (
          <>
            <Text style={[styles.sectionHeader, { color: colors.accent, fontFamily: scriptFontFamily(language, '700') }]}>
              {t.profile.saved}
            </Text>
            {isLoadingSaved ? (
              <ActivityIndicator color={colors.accent} style={styles.savedLoading} />
            ) : savedCards.length === 0 ? (
              <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.emptyText, { color: colors.textMuted, fontFamily: scriptFontFamily(language, '400') }]}>
                  {t.profile.savedEmpty}
                </Text>
              </View>
            ) : (
              savedCards.map((card) => {
                const content = resolveCardContent(card.content, language);
                return (
                  <Pressable
                    key={card.id}
                    onPress={() => handleOpenSaved(card)}
                    style={[styles.savedRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    <Bookmark size={16} color={colors.accent} fill={colors.accent} />
                    <Text numberOfLines={1} style={[styles.savedRowText, { color: colors.text, fontFamily: scriptFontFamily(language, '500') }]}>
                      {content.title}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </>
        )}

        {/* — Personalize feed — device preference, works logged out — */}
        <Text style={[styles.sectionHeader, { color: colors.accent, fontFamily: scriptFontFamily(language, '700') }]}>
          {t.profile.personalizeFeed}
        </Text>
        <Text style={[styles.subLabel, { color: colors.textSecondary, fontFamily: scriptFontFamily(language, '400') }]}>
          {t.profile.defaultTopicLabel}
        </Text>
        <View style={styles.topicStripInline}>
          <TopicStrip
            activeTag={defaultTopic}
            onSelect={setDefaultTopic}
            language={language}
            themeMode={theme}
          />
        </View>

        {/* — Appearance — */}
        <Text style={[styles.sectionHeader, { color: colors.accent, fontFamily: scriptFontFamily(language, '700') }]}>
          {t.settings.appearance}
        </Text>
        <SettingsRow
          label={t.settings.darkMode}
          subtitle={isDark ? t.settings.currentlyDark : t.settings.currentlyLight}
          language={language}
          icon={isDark ? <Moon size={18} color={colors.accent} /> : <Sun size={18} color={colors.accent} />}
          colors={colors}
          right={
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={isDark ? '#0A0A0F' : '#FFFFFF'}
            />
          }
        />

        {/* — Language — */}
        <Text style={[styles.sectionHeader, { color: colors.accent, fontFamily: scriptFontFamily(language, '700') }]}>
          {t.settings.defaultLanguage}
        </Text>
        <View style={[styles.langGroup, { borderColor: colors.border }]}>
          {LANGUAGES.map((lang, idx) => {
            const active = language === lang.code;
            return (
              <Pressable
                key={lang.code}
                onPress={() => setLanguage(lang.code)}
                style={[styles.langRow, {
                  backgroundColor: active ? colors.accentMuted : colors.surface,
                  borderBottomColor: colors.border,
                  borderBottomWidth: idx < LANGUAGES.length - 1 ? 1 : 0,
                }]}
              >
                <View style={styles.langTexts}>
                  <Text style={[styles.langLabel, { color: colors.text }]}>{lang.nativeLabel}</Text>
                  <Text style={[styles.langSub, { color: colors.textSecondary }]}>{lang.label}</Text>
                </View>
                {active && <View style={[styles.activeIndicator, { backgroundColor: colors.accent }]} />}
              </Pressable>
            );
          })}
        </View>

        {/* — Notifications — */}
        <Text style={[styles.sectionHeader, { color: colors.accent, fontFamily: scriptFontFamily(language, '700') }]}>
          {t.settings.notifications}
        </Text>
        <SettingsRow
          label={t.settings.dailyReminder}
          subtitle={t.settings.dailyReminderSubtitle}
          language={language}
          icon={<Bell size={18} color={colors.accent} />}
          colors={colors}
          right={
            <Switch
              value={false}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor="#FFFFFF"
            />
          }
        />

        {/* — Share & Feedback — */}
        <Pressable onPress={handleShare}>
          <SettingsRow
            label={t.profile.shareApp}
            language={language}
            icon={<Share2 size={18} color={colors.accent} />}
            colors={colors}
          />
        </Pressable>

        <Pressable onPress={handleFeedback}>
          <SettingsRow
            label={t.profile.feedback}
            language={language}
            icon={<MessageCircle size={18} color={colors.accent} />}
            colors={colors}
          />
        </Pressable>

        {/* — About — */}
        <Text style={[styles.sectionHeader, { color: colors.accent, fontFamily: scriptFontFamily(language, '700') }]}>
          {t.settings.about}
        </Text>
        <SettingsRow
          label="Jinvani"
          subtitle={t.settings.appTagline}
          language={language}
          icon={<Info size={18} color={colors.accent} />}
          colors={colors}
          right={<Text style={[styles.version, { color: colors.textMuted }]}>v0.1.0</Text>}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5, marginBottom: 20 },
  sectionHeader: { fontSize: 11.5, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 10, marginTop: 4 },
  subLabel: { fontSize: 12.5, marginBottom: 10, marginTop: -4 },
  topicStripInline: { marginHorizontal: -20, marginBottom: 16 },
  loginBox: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 16 },
  loginBoxText: { flex: 1, gap: 4 },
  loginPrompt: { fontSize: 13, lineHeight: 18 },
  loginButtonText: { fontSize: 13, fontWeight: '700' },
  savedLoading: { marginBottom: 10 },
  emptyBox: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 10 },
  emptyText: { fontSize: 13 },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8 },
  savedRowText: { fontSize: 14, flex: 1 },
  langGroup: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 10 },
  langRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  langTexts: { flex: 1 },
  langLabel: { fontSize: 15, fontWeight: '600' },
  langSub: { fontSize: 12, marginTop: 2 },
  activeIndicator: { width: 8, height: 8, borderRadius: 4 },
  version: { fontSize: 13 },
});
