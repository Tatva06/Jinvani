import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../theme';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

// Intentionally not read from useThemeStore — an error boundary must stay
// renderable even if something upstream (including the store) is what's
// broken, so it uses a fixed palette rather than depending on app state.
const colors = Colors.dark;

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Unhandled error caught by ErrorBoundary:', error, info.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <View style={[styles.root, { backgroundColor: colors.bg }]}>
          <Text style={[styles.title, { color: colors.text }]}>Something went wrong</Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            This screen ran into a problem and couldn&apos;t continue.
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: colors.accent, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={this.reset}
          >
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  title: { fontSize: 20, fontWeight: '700' },
  message: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  button: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  buttonText: { color: '#0A0A0F', fontWeight: '700', fontSize: 14 },
});
