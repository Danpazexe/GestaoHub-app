import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../theme/ThemeContext';

// Estado de erro padronizado COM ação de "tentar de novo" (hoje as telas só
// mostram um toast e deixam a lista vazia/obsoleta, sem retry).
const ErrorState = ({
  title = 'Algo deu errado',
  message = 'Não foi possível carregar agora. Verifique a conexão e tente de novo.',
  retryLabel = 'Tentar de novo',
  onRetry,
  style,
}) => {
  const { colors, spacing, typography } = useTheme();

  return (
    <View
      style={[styles.container, { padding: spacing.section }, style]}
      accessibilityRole="summary"
    >
      <View style={[styles.iconWrap, { backgroundColor: 'rgba(239,68,68,0.10)' }]}>
        <MaterialIcons name="error-outline" size={34} color={colors.error} />
      </View>
      <Text style={[typography.title, styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[typography.body, styles.message, { color: colors.textMuted }]}>{message}</Text>
      {onRetry ? (
        <TouchableOpacity
          style={[styles.retry, { borderColor: colors.border }]}
          onPress={onRetry}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={retryLabel}
        >
          <MaterialIcons name="refresh" size={18} color={colors.text} />
          <Text style={[styles.retryText, { color: colors.text }]}>{retryLabel}</Text>
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
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { textAlign: 'center', marginBottom: 6 },
  message: { textAlign: 'center', maxWidth: 300, marginBottom: 20 },
  retry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  retryText: { fontSize: 15, fontWeight: '700' },
});

export default ErrorState;
