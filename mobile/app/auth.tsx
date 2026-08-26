import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Eye, EyeOff, X } from 'lucide-react-native';

import { useThemeStore } from '../src/store/useThemeStore';
import { useFeedStore } from '../src/store/useFeedStore';
import { useAuthStore } from '../src/store/useAuthStore';
import { Colors } from '../src/theme';
import { CHROME } from '../src/i18n/chrome';
import { scriptFontFamily } from '../src/utils/fonts';

type Mode = 'signin' | 'signup';

export default function AuthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useThemeStore((s) => s.theme);
  const colors = Colors[theme];
  const language = useFeedStore((s) => s.language);
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);
  const t = CHROME[language];

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignUp = mode === 'signup';

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);
    const result = isSignUp ? await signUp(email.trim(), password) : await signIn(email.trim(), password);
    setIsSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={[styles.root, { backgroundColor: colors.bg }]}
        contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        style={[styles.closeButton, { top: insets.top + 16 }]}
        accessibilityLabel="Close and go back"
        accessibilityRole="button"
      >
        <X size={22} color={colors.text} />
      </Pressable>

      <Text style={[styles.title, { color: colors.text, fontFamily: scriptFontFamily(language, '700') }]}>
        {isSignUp ? t.auth.signUpTitle : t.auth.signInTitle}
      </Text>

      <Text style={[styles.label, { color: colors.textSecondary, fontFamily: scriptFontFamily(language, '400') }]}>
        {t.auth.emailLabel}
      </Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder={t.auth.emailPlaceholder}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
      />

      <Text style={[styles.label, { color: colors.textSecondary, fontFamily: scriptFontFamily(language, '400') }]}>
        {t.auth.passwordLabel}
      </Text>
      <View style={[styles.inputWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder={t.auth.passwordPlaceholder}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={!showPassword}
          style={[styles.inputInner, { color: colors.text }]}
        />
        <Pressable
          onPress={() => setShowPassword((v) => !v)}
          hitSlop={8}
          accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          accessibilityRole="button"
        >
          {showPassword
            ? <EyeOff size={18} color={colors.textMuted} />
            : <Eye size={18} color={colors.textMuted} />}
        </Pressable>
      </View>

      {error && (
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
      )}

      <Pressable
        onPress={handleSubmit}
        disabled={isSubmitting || !email || !password}
        style={[styles.submitButton, {
          backgroundColor: colors.accent,
          opacity: isSubmitting || !email || !password ? 0.6 : 1,
        }]}
      >
        {isSubmitting ? (
          <ActivityIndicator color={theme === 'dark' ? '#0A0A0F' : '#FFFFFF'} />
        ) : (
          <Text style={[styles.submitText, { color: theme === 'dark' ? '#0A0A0F' : '#FFFFFF' }]}>
            {isSignUp ? t.auth.signUpButton : t.auth.signInButton}
          </Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => {
          setError(null);
          setMode(isSignUp ? 'signin' : 'signup');
        }}
        style={styles.switchButton}
      >
        <Text style={[styles.switchText, { color: colors.accent, fontFamily: scriptFontFamily(language, '500') }]}>
          {isSignUp ? t.auth.switchToSignIn : t.auth.switchToSignUp}
        </Text>
      </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  closeButton: { position: 'absolute', right: 20, zIndex: 10, padding: 4 },
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5, marginBottom: 28, marginTop: 52 },
  label: { fontSize: 12.5, fontWeight: '600', marginBottom: 6, marginTop: 14 },
  // password field with eye toggle
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 46 },
  inputInner: { flex: 1, fontSize: 15 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 46, fontSize: 15 },
  errorText: { fontSize: 13, marginTop: 14, lineHeight: 18 },
  submitButton: { marginTop: 28, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  submitText: { fontSize: 15, fontWeight: '700' },
  switchButton: { marginTop: 18, alignItems: 'center' },
  switchText: { fontSize: 13 },
});
