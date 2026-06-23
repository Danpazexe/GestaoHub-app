import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../theme/ThemeContext';

// Estado vazio padronizado COM call-to-action (o design-system.md exige que telas
// vazias mantenham um próximo passo, em vez de só um texto sem saída).
const EmptyState = ({
  icon = 'inbox',
  title = 'Nada por aqui ainda',
  message,
  ctaLabel,
  onCtaPress,
  style,
}) => {
  const { colors, spacing, typography } = useTheme();

  return (
    <View
      style={[styles.container, { padding: spacing.section }, style]}
      accessibilityRole="summary"
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <MaterialIcons name={icon} size={34} color={colors.textMuted} />
      </View>
      <Text style={[typography.title, styles.title, { color: colors.text }]}>{title}</Text>
      {message ? (
        <Text style={[typography.body, styles.message, { color: colors.textMuted }]}>{message}</Text>
      ) : null}
      {ctaLabel && onCtaPress ? (
        <TouchableOpacity
          style={[styles.cta, { backgroundColor: colors.primary }]}
          onPress={onCtaPress}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
        >
          <Text style={[styles.ctaText, { color: colors.white }]}>{ctaLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { textAlign: 'center', marginBottom: 6 },
  message: { textAlign: 'center', maxWidth: 300, marginBottom: 20 },
  cta: {
    minHeight: 44,
    paddingHorizontal: 22,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontSize: 15, fontWeight: '700' },
});

export default EmptyState;
