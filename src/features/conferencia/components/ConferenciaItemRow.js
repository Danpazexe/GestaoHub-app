import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const HIGHLIGHT_DURATION = 2400;

const getStyles = (colors) =>
  StyleSheet.create({
    // ── Base row ──
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 11,
      paddingHorizontal: 2,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    itemRowLast: {
      borderBottomWidth: 0,
    },

    // ── Hot highlight (item just scanned) ──
    itemRowHot: {
      backgroundColor: colors.successSoft,
      borderRadius: 12,
      paddingHorizontal: 10,
      marginHorizontal: -8,
      borderBottomWidth: 0,
    },

    // ── Left accent bar (pending vs done) ──
    accentBar: {
      width: 3,
      borderRadius: 2,
      alignSelf: 'stretch',
      minHeight: 36,
    },

    // ── Content ──
    itemLeft: {
      flex: 1,
    },
    itemCode: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '800',
      marginBottom: 2,
      letterSpacing: 0.2,
    },
    itemDesc: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '800',
      lineHeight: 19,
    },
    itemMetaRow: {
      flexDirection: 'row',
      gap: 6,
      flexWrap: 'wrap',
      marginTop: 6,
      alignItems: 'center',
    },
    itemTag: {
      backgroundColor: colors.chipBg,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: colors.border,
    },
    itemTagText: {
      color: colors.text,
      fontSize: 10,
      fontWeight: '900',
    },
    itemMetaText: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
    },
    itemActionsRow: {
      flexDirection: 'row',
      gap: 6,
      flexWrap: 'wrap',
      marginTop: 8,
      alignItems: 'center',
    },
    itemActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface2,
    },
    itemActionText: {
      color: colors.text,
      fontSize: 11,
      fontWeight: '800',
    },

    // ── Right: qty block ──
    qtyBlock: {
      alignItems: 'flex-end',
      gap: 3,
    },
    qtyMain: {
      fontSize: 15,
      fontWeight: '900',
    },
    qtyRemaining: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
    },
    qtyDoneIcon: {
      marginTop: 2,
    },
  });

export const ConferenciaItemRow = ({
  row,
  colors,
  lastScanned,
  lastScannedAt,
  onLongPress,
  onEdit,
  onClear,
  doneColor,
  isLast = false,
}) => {
  const styles = getStyles(colors);
  const highlightAnim = useRef(new Animated.Value(0)).current;
  const prevScannedAt = useRef(0);

  const done = row.checkedQty >= row.expectedQty && row.checkedQty > 0;
  const remaining = Math.max(0, (row.expectedQty || 0) - (row.checkedQty || 0));
  const isHot =
    lastScanned &&
    (row.code === lastScanned || row.ean === lastScanned) &&
    Date.now() - lastScannedAt < HIGHLIGHT_DURATION;

  // Animate highlight on new scan
  useEffect(() => {
    if (
      lastScanned &&
      (row.code === lastScanned || row.ean === lastScanned) &&
      lastScannedAt !== prevScannedAt.current &&
      lastScannedAt > 0
    ) {
      prevScannedAt.current = lastScannedAt;
      Animated.sequence([
        Animated.timing(highlightAnim, { toValue: 1, duration: 180, useNativeDriver: false }),
        Animated.delay(HIGHLIGHT_DURATION - 500),
        Animated.timing(highlightAnim, { toValue: 0, duration: 320, useNativeDriver: false }),
      ]).start();
    }
  }, [lastScanned, lastScannedAt, row.code, row.ean, highlightAnim]);

  const animatedBg = highlightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', colors.successSoft],
  });

  const meta = row.lastMeta || null;
  const pendingAccent = colors.pendingAccent || colors.warning || '#ea580c';
  const doneAccent = doneColor || colors.success;
  const accentColor = done ? doneAccent : pendingAccent;
  const canAdjust = Number(row.checkedQty || 0) > 0;

  return (
    <Pressable onLongPress={() => onLongPress?.(row)}>
      <Animated.View
        style={[
          styles.itemRow,
          isLast && styles.itemRowLast,
          isHot && styles.itemRowHot,
          { backgroundColor: animatedBg },
        ]}
      >
        {/* Left accent bar */}
        <View style={[styles.accentBar, { backgroundColor: accentColor + (done ? 'ff' : '99') }]} />

        {/* Content */}
        <View style={styles.itemLeft}>
          <Text style={styles.itemCode}>
            {row.code}{row.ean ? ` · ${row.ean}` : ''}
          </Text>
          <Text style={styles.itemDesc} numberOfLines={2}>
            {row.description}
          </Text>
          {meta ? (
            <View style={styles.itemMetaRow}>
              <View style={styles.itemTag}>
                <Text style={styles.itemTagText}>
                  {meta.packagingLabel || 'UN'} ×{meta.packagingFactor || 1}
                </Text>
              </View>
              {meta.lote ? (
                <Text style={styles.itemMetaText}>Lote: {meta.lote}</Text>
              ) : null}
              {meta.validade ? (
                <Text style={styles.itemMetaText}>Val: {meta.validade}</Text>
              ) : null}
            </View>
          ) : null}
          {canAdjust ? (
            <View style={styles.itemActionsRow}>
              <Pressable style={styles.itemActionButton} onPress={() => onEdit?.(row)}>
                <MaterialIcons name="edit" size={13} color={colors.primary} />
                <Text style={styles.itemActionText}>Editar</Text>
              </Pressable>
              <Pressable style={styles.itemActionButton} onPress={() => onClear?.(row)}>
                <MaterialIcons name="backspace" size={13} color={colors.danger} />
                <Text style={styles.itemActionText}>Limpar</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* Right: qty */}
        <View style={styles.qtyBlock}>
          <Text style={[styles.qtyMain, { color: done ? doneAccent : colors.text }]}>
            {row.checkedQty}<Text style={{ color: colors.textMuted, fontWeight: '600', fontSize: 12 }}>/{row.expectedQty}</Text>
          </Text>
          {!done && remaining > 0 ? (
            <Text style={styles.qtyRemaining}>−{remaining} restante{remaining !== 1 ? 's' : ''}</Text>
          ) : null}
          {done ? (
            <View style={styles.qtyDoneIcon}>
              <MaterialIcons name="check-circle" size={16} color={doneAccent} />
            </View>
          ) : null}
        </View>
      </Animated.View>
    </Pressable>
  );
};

export default ConferenciaItemRow;
