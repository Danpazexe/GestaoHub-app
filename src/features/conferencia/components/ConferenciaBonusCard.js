import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

/**
 * ConferenciaBonusCard
 *
 * Props
 * ─────
 * item   – { id, invoice, supplierName, supplierCode, lines, createdAt, status? }
 * colors – paleta do tema (conferenciaRecebimentoTheme + runtime dark/light)
 * onPress – callback ao tocar
 */
const ConferenciaBonusCard = ({ item, colors, onPress, status }) => {
  const linesCount = Number(item.lines) || 0;
  const formattedDate = item.createdAt
    ? new Date(item.createdAt).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null;

  const resolvedStatus = status || item.status;
  const isDraft = resolvedStatus === 'draft' || resolvedStatus === 'em_conferencia';
  const isFinished = resolvedStatus === 'finalizada';

  const s = makeStyles(colors);

  return (
    <View style={s.wrapper}>
      <Pressable
        style={({ pressed }) => [s.card, pressed && s.cardPressed]}
        onPress={onPress}
        hitSlop={6}
        android_ripple={{ color: colors.primary + '18', borderless: false }}
      >
        {/* ── Left accent bar ── */}
        <View style={[s.accentBar, isDraft && s.accentBarDraft, isFinished && s.accentBarFinished]} />

        {/* ── Content ── */}
        <View style={s.body}>

          {/* Top row: supplier name + item count badge */}
          <View style={s.topRow}>
            <Text style={s.supplierName} numberOfLines={1}>
              {item.supplierName || '—'}
            </Text>
            <View style={[s.badge, isDraft && s.badgeDraft, isFinished && s.badgeFinished]}>
              <Text style={[s.badgeText, isDraft && s.badgeTextDraft, isFinished && s.badgeTextFinished]}>
                {linesCount} {linesCount === 1 ? 'item' : 'itens'}
              </Text>
            </View>
          </View>

          {/* NF number */}
          <Text style={s.invoiceLabel}>
            NF <Text style={s.invoiceValue}>{item.invoice || '—'}</Text>
          </Text>

          {/* Meta row: supplier code + date */}
          <View style={s.metaRow}>
            {item.supplierCode ? (
              <View style={s.metaChip}>
                <MaterialIcons name="person-outline" size={12} color={colors.textMuted} />
                <Text style={s.metaText}>Cód. {item.supplierCode}</Text>
              </View>
            ) : null}
            {formattedDate ? (
              <View style={s.metaChip}>
                <MaterialIcons name="schedule" size={12} color={colors.textMuted} />
                <Text style={s.metaText}>{formattedDate}</Text>
              </View>
            ) : null}
          </View>

          {/* Divider */}
          <View style={s.divider} />

          {/* CTA row */}
          <View style={s.ctaRow}>
            <Text style={[s.ctaLabel, isDraft && s.ctaLabelDraft, isFinished && s.ctaLabelFinished]}>
              {isFinished ? 'Conferência finalizada' : isDraft ? 'Continuar conferência' : 'Iniciar conferência'}
            </Text>
            <MaterialIcons
              name="arrow-forward"
              size={16}
              color={isFinished ? colors.success : isDraft ? colors.warning : colors.primary}
            />
          </View>
        </View>
      </Pressable>
    </View>
  );
};

const makeStyles = (colors) =>
  StyleSheet.create({
    wrapper: {
      marginBottom: 10,
      borderRadius: 18,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 2,
    },
    card: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    cardPressed: {
      opacity: 0.92,
    },

    // ── Accent bar ──
    accentBar: {
      width: 4,
      backgroundColor: colors.sky || colors.primary,
      borderTopLeftRadius: 18,
      borderBottomLeftRadius: 18,
    },
    accentBarDraft: {
      backgroundColor: colors.warning,
    },
    accentBarFinished: {
      backgroundColor: colors.success,
    },

    // ── Body ──
    body: {
      flex: 1,
      paddingHorizontal: 14,
      paddingTop: 13,
      paddingBottom: 11,
    },

    // ── Top row ──
    topRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: 3,
    },
    supplierName: {
      flex: 1,
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
      lineHeight: 21,
    },
    badge: {
      backgroundColor: (colors.sky || colors.primary) + '18',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      alignSelf: 'flex-start',
    },
    badgeDraft: {
      backgroundColor: colors.warning + '20',
    },
    badgeFinished: {
      backgroundColor: colors.success + '18',
    },
    badgeText: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.sky || colors.primary,
    },
    badgeTextDraft: {
      color: colors.warning,
    },
    badgeTextFinished: {
      color: colors.success,
    },

    // ── Invoice ──
    invoiceLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
      marginBottom: 8,
    },
    invoiceValue: {
      fontWeight: '800',
      color: colors.text,
    },

    // ── Meta chips ──
    metaRow: {
      flexDirection: 'row',
      gap: 6,
      flexWrap: 'wrap',
      marginBottom: 10,
    },
    metaChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.surface2,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    metaText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
    },

    // ── Divider ──
    divider: {
      height: 1,
      backgroundColor: colors.divider,
      marginBottom: 10,
    },

    // ── CTA ──
    ctaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    ctaLabel: {
      fontSize: 12,
      fontWeight: '900',
      color: colors.sky || colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    ctaLabelDraft: {
      color: colors.warning,
    },
    ctaLabelFinished: {
      color: colors.success,
    },
  });

export default ConferenciaBonusCard;
