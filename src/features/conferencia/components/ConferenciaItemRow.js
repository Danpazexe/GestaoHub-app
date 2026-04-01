import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const getStyles = (colors) =>
  StyleSheet.create({
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    itemRowHot: {
      backgroundColor: colors.successSoft,
      borderRadius: 12,
      paddingHorizontal: 10,
      marginHorizontal: -4,
    },
    itemLeft: {
      flex: 1,
    },
    itemCode: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '800',
      marginBottom: 2,
    },
    itemDesc: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '800',
    },
    itemMetaRow: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
      marginTop: 6,
      alignItems: 'center',
    },
    itemTag: {
      backgroundColor: colors.chipBg,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    itemTagText: {
      color: colors.text,
      fontSize: 11,
      fontWeight: '900',
    },
    itemMetaText: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
    },
    itemQty: {
      fontSize: 13,
      fontWeight: '900',
    },
  });

export const ConferenciaItemRow = ({
  row,
  colors,
  lastScanned,
  lastScannedAt,
  onLongPress,
  doneColor,
}) => {
  const styles = getStyles(colors);
  const isHot = lastScanned && (row.code === lastScanned || row.ean === lastScanned) && (Date.now() - lastScannedAt) < 2500;
  const done = row.checkedQty >= row.expectedQty && row.checkedQty > 0;
  const meta = row.lastMeta || null;

  return (
    <Pressable
      onLongPress={() => onLongPress(row)}
      style={[styles.itemRow, isHot && styles.itemRowHot]}
    >
      <View style={styles.itemLeft}>
        <Text style={styles.itemCode}>{row.code}{row.ean ? ` / ${row.ean}` : ''}</Text>
        <Text style={styles.itemDesc} numberOfLines={1}>{row.description}</Text>
        {meta ? (
          <View style={styles.itemMetaRow}>
            <View style={styles.itemTag}>
              <Text style={styles.itemTagText}>{meta.packagingLabel || 'UN'} x{meta.packagingFactor || 1}</Text>
            </View>
            {meta.lote ? <Text style={styles.itemMetaText}>Lote: {meta.lote}</Text> : null}
            {meta.validade ? <Text style={styles.itemMetaText}>Val: {meta.validade}</Text> : null}
          </View>
        ) : null}
      </View>
      <Text style={[styles.itemQty, { color: done ? doneColor : colors.text }]}>
        Lido: {row.checkedQty}
      </Text>
    </Pressable>
  );
};

export default ConferenciaItemRow;
