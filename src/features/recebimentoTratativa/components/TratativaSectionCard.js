import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TRATATIVA_THEME } from '../constants/tratativaOptions';

const TratativaSectionCard = ({ title, subtitle, children, isDarkMode = false }) => {
  return (
    <View style={[styles.card, { backgroundColor: isDarkMode ? TRATATIVA_THEME.cardDark : TRATATIVA_THEME.card, borderColor: isDarkMode ? TRATATIVA_THEME.borderDark : TRATATIVA_THEME.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDarkMode ? TRATATIVA_THEME.textDark : TRATATIVA_THEME.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: isDarkMode ? TRATATIVA_THEME.textMutedDark : TRATATIVA_THEME.textMuted }]}>{subtitle}</Text>
        ) : null}
      </View>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  header: {
    marginBottom: 14,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
});

export default TratativaSectionCard;

