import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const getStyles = (colors) =>
  StyleSheet.create({
    bonusCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 10,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 2,
    },
    bonusTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    bonusTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '900',
    },
    bonusSub: {
      marginTop: 2,
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '800',
    },
    badge: {
      backgroundColor: colors.surface2,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },
    badgeText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '900',
    },
    bonusMetaRow: {
      marginTop: 10,
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
    metaPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.surface2,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    metaText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '800',
    },
  });

export const ConferenciaBonusCard = ({ item, colors, onPress }) => {
  const styles = getStyles(colors);

  return (
    <Pressable onPress={onPress} style={styles.bonusCard}>
      <View style={styles.bonusTopRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.bonusTitle} numberOfLines={1}>{item.supplierName}</Text>
          <Text style={styles.bonusSub} numberOfLines={1}>NF {item.invoice}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.lines} itens</Text>
        </View>
      </View>

      <View style={styles.bonusMetaRow}>
        <View style={styles.metaPill}>
          <MaterialIcons name="person" size={14} color={colors.textMuted} />
          <Text style={styles.metaText}>Cód: {item.supplierCode}</Text>
        </View>
        <View style={styles.metaPill}>
          <MaterialIcons name="schedule" size={14} color={colors.textMuted} />
          <Text style={styles.metaText}>
            {item.createdAt ? new Date(item.createdAt).toLocaleString('pt-BR') : '-'}
          </Text>
        </View>
      </View>
    </Pressable>
  );
};

export default ConferenciaBonusCard;
