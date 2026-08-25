import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Colors } from '../theme';
import { Language } from '../types';
import { scriptFontFamily } from '../utils/fonts';

export function SettingsRow({
  label,
  subtitle,
  icon,
  colors,
  right,
  language = 'en',
}: {
  label: string;
  subtitle?: string;
  icon: React.ReactNode;
  colors: (typeof Colors)['dark'];
  right?: React.ReactNode;
  language?: Language;
}) {
  return (
    <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.rowIcon, { backgroundColor: colors.accentMuted, borderColor: colors.accentBorder }]}>
        {icon}
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: colors.text, fontFamily: scriptFontFamily(language, '600') }]}>{label}</Text>
        {subtitle && (
          <Text style={[styles.rowSub, { color: colors.textSecondary, fontFamily: scriptFontFamily(language, '400') }]}>
            {subtitle}
          </Text>
        )}
      </View>
      {right ?? <ChevronRight size={16} color={colors.textMuted} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 10 },
  rowIcon: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 12, marginTop: 2 },
});
