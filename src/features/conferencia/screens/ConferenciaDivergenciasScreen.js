import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import ScreenLayout, {
  createHeaderActionsTemplate,
  createHeaderTitleTemplate,
  createScreenHeaderTemplate,
} from '../../../components/ScreenLayout';
import { CORESCONFERENCIADIVERG } from '../../../components/coresAuth';
import { EmptyState } from '../../../components/states';
import { listConferenciaDivergencias } from '../services/conferenciaRecordsService';

const ConferenciaDivergenciasScreen = ({ navigation, isDarkMode }) => {
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState('pendente');
  const [refreshing, setRefreshing] = useState(false);

  const colors = useMemo(() => {
    const base = CORESCONFERENCIADIVERG;
    const dark = !!isDarkMode;
    return {
      primary: base.primary,
      secondary: base.secondary,
      background: dark ? '#1f2438' : base.background || '#ecfeff',
      surface: dark ? '#262d47' : '#ffffff',
      surface2: dark ? '#2b3350' : '#f7f7f8',
      text: dark ? '#f3f5ff' : '#2f333a',
      textMuted: dark ? '#aab1cf' : 'rgba(64,68,76,0.78)',
      border: dark ? '#3a4265' : 'rgba(64,68,76,0.18)',
      divider: dark ? 'rgba(255,255,255,0.10)' : 'rgba(64,68,76,0.14)',
      inputBg: dark ? '#202846' : '#ffffff',
      onPrimary: '#ffffff',
      shadow: '#000000',
      danger: '#dc2626',
      dangerSoft: dark ? 'rgba(220,38,38,0.14)' : 'rgba(220,38,38,0.08)',
      success: '#059669',
      successSoft: dark ? 'rgba(16,185,129,0.14)' : 'rgba(16,185,129,0.10)',
      warning: '#f59e0b',
    };
  }, [isDarkMode]);

  const styles = useMemo(() => getStyles(colors), [colors]);

  const loadDivergencias = useCallback(async () => {
    try { setList(await listConferenciaDivergencias()); }
    catch { setList([]); }
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      ...createScreenHeaderTemplate({
        isDarkMode,
        lightHeaderColor: colors.primary,
        darkHeaderColor: colors.primary,
        tintColor: '#ffffff',
      }),
      headerTitle: () =>
        createHeaderTitleTemplate({
          title: 'Divergências',
          subtitle: 'Auditoria e tratativas',
          iconName: 'rule',
          tintColor: '#ffffff',
        }),
      headerRight: () =>
        createHeaderActionsTemplate({
          actions: [{
            key: 'refresh-divergencias',
            iconName: 'refresh',
            accessibilityLabel: 'Atualizar',
            onPress: async () => {
              setRefreshing(true);
              await loadDivergencias();
              setRefreshing(false);
            },
          }],
          isDarkMode,
        }),
    });
  }, [navigation, isDarkMode, colors.primary, loadDivergencias]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDivergencias();
    setRefreshing(false);
  }, [loadDivergencias]);

  useFocusEffect(useCallback(() => { loadDivergencias(); }, [loadDivergencias]));

  const filtered = useMemo(() =>
    filter === 'todos' ? list : list.filter((i) => i.status === filter),
    [list, filter],
  );

  const stats = useMemo(() => ({
    pendente: list.filter((i) => i.status === 'pendente').length,
    resolvida: list.filter((i) => i.status === 'resolvida').length,
    total: list.length,
  }), [list]);

  const FILTERS = [
    { key: 'pendente', label: 'Pendentes' },
    { key: 'resolvida', label: 'Resolvidas' },
    { key: 'todos', label: 'Todos' },
  ];

  const header = useMemo(() => (
    <>
      {/* Metrics */}
      <View style={styles.metricsRow}>
        <View style={[styles.metricCard, { borderTopColor: colors.danger }]}>
          <Text style={styles.metricLabel}>Pendentes</Text>
          <Text style={[styles.metricValue, { color: colors.danger }]}>{stats.pendente}</Text>
        </View>
        <View style={[styles.metricCard, { borderTopColor: colors.success }]}>
          <Text style={styles.metricLabel}>Resolvidas</Text>
          <Text style={[styles.metricValue, { color: colors.success }]}>{stats.resolvida}</Text>
        </View>
        <View style={[styles.metricCard, { borderTopColor: colors.primary }]}>
          <Text style={styles.metricLabel}>Total</Text>
          <Text style={[styles.metricValue, { color: colors.primary }]}>{stats.total}</Text>
        </View>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {FILTERS.map(({ key, label }) => (
          <Pressable
            key={key}
            onPress={() => setFilter(key)}
            style={[
              styles.filterButton,
              filter === key && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
          >
            <Text style={[styles.filterButtonText, filter === key && { color: colors.onPrimary }]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {filtered.length === 0 ? null : (
        <Text style={styles.listCountLabel}>{filtered.length} registro{filtered.length !== 1 ? 's' : ''}</Text>
      )}
    </>
  ), [styles, colors, stats, filter, filtered.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ScreenLayout
      isDarkMode={isDarkMode}
      lightBackground={colors.background}
      darkBackground={colors.background}
      contentStyle={styles.content}
    >
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        ListHeaderComponent={header}
        renderItem={({ item }) => {
          const isPending = item.status !== 'resolvida';
          const accentColor = isPending ? colors.danger : colors.success;
          const accentSoft = isPending ? colors.dangerSoft : colors.successSoft;
          const sourceLabel = item.source === 'recebimento' ? 'Recebimento' : 'Saída';
          const diffLabel = item.diff > 0 ? `+${item.diff}` : String(item.diff ?? 0);

          return (
            <View style={[styles.itemCard, { borderLeftColor: accentColor }]}>
              {/* Header */}
              <View style={styles.itemHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{item.code}</Text>
                  <Text style={styles.itemDesc} numberOfLines={1}>{item.description}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: accentSoft, borderColor: accentColor + '44' }]}>
                  <MaterialIcons
                    name={isPending ? 'error-outline' : 'check-circle-outline'}
                    size={12}
                    color={accentColor}
                  />
                  <Text style={[styles.statusBadgeText, { color: accentColor }]}>
                    {isPending ? 'Pendente' : 'Resolvida'}
                  </Text>
                </View>
              </View>

              {/* Qty row */}
              <View style={styles.qtyRow}>
                <View style={styles.qtyPill}>
                  <Text style={styles.qtyPillLabel}>Esperado</Text>
                  <Text style={styles.qtyPillValue}>{item.expectedQty}</Text>
                </View>
                <View style={styles.qtyPill}>
                  <Text style={styles.qtyPillLabel}>Conferido</Text>
                  <Text style={styles.qtyPillValue}>{item.checkedQty}</Text>
                </View>
                <View style={[styles.qtyPill, { backgroundColor: accentSoft, borderColor: accentColor + '33' }]}>
                  <Text style={styles.qtyPillLabel}>Diferença</Text>
                  <Text style={[styles.qtyPillValue, { color: accentColor }]}>{diffLabel}</Text>
                </View>
              </View>

              {/* Meta */}
              <View style={styles.itemMetaRow}>
                <View style={styles.metaChip}>
                  <MaterialIcons name={item.source === 'recebimento' ? 'arrow-downward' : 'arrow-upward'} size={11} color={colors.textMuted} />
                  <Text style={styles.metaChipText}>{sourceLabel}</Text>
                </View>
                {item.invoice ? (
                  <View style={styles.metaChip}>
                    <Text style={styles.metaChipText}>NF {item.invoice}</Text>
                  </View>
                ) : null}
                {item.orderCode ? (
                  <View style={styles.metaChip}>
                    <Text style={styles.metaChipText}>Pedido {item.orderCode}</Text>
                  </View>
                ) : null}
                {item.sync_status === 'local_only' ? (
                  <View style={styles.metaChip}>
                    <MaterialIcons name="cloud-off" size={11} color={colors.textMuted} />
                    <Text style={styles.metaChipText}>Local</Text>
                  </View>
                ) : null}
              </View>

              {/* Resolution note */}
              {!isPending && item.resolvedAt ? (
                <Text style={[styles.resolutionText, { color: colors.success }]}>
                  Resolvida em {new Date(item.resolvedAt).toLocaleString('pt-BR')}
                  {item.resolutionNote ? ` · ${item.resolutionNote}` : ''}
                </Text>
              ) : null}

              {/* Actions */}
              <View style={styles.actionRow}>
                {item.source === 'recebimento' && item.suggested_tratativa_prefill ? (
                  <Pressable
                    style={[styles.actionButton, { backgroundColor: colors.primary }]}
                    onPress={() => navigation.navigate('EspelhoRecebimentoScreen', { prefill: item.suggested_tratativa_prefill })}
                  >
                    <MaterialIcons name="open-in-new" size={14} color="#ffffff" />
                    <Text style={[styles.actionButtonText, { color: '#ffffff' }]}>Abrir tratativa</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  style={[styles.actionButton, styles.actionButtonSecondary]}
                  onPress={() =>
                    Alert.alert(
                      'Detalhes da divergência',
                      [
                        `Código: ${item.code || '-'}`,
                        `Descrição: ${item.description || '-'}`,
                        `Esperado: ${item.expectedQty ?? '-'}`,
                        `Conferido: ${item.checkedQty ?? '-'}`,
                        `Diferença: ${item.diff ?? '-'}`,
                      ].join('\n'),
                    )
                  }
                >
                  <MaterialIcons name="info-outline" size={14} color={colors.textMuted} />
                  <Text style={[styles.actionButtonText, { color: colors.textMuted }]}>Detalhes</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="rule"
            title="Nenhuma divergência"
            message={filter === 'todos'
              ? 'Não há registros de divergências.'
              : `Nenhuma divergência com status "${filter}".`}
          />
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      />
    </ScreenLayout>
  );
};

const getStyles = (colors) =>
  StyleSheet.create({
    content: { flex: 1, paddingHorizontal: 16, paddingTop: 14 },
    scrollContent: { paddingBottom: 32 },

    // ── Metrics ──
    metricsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    metricCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderTopWidth: 3,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    metricLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '800', textTransform: 'uppercase' },
    metricValue: { marginTop: 6, fontSize: 22, fontWeight: '900' },

    // ── Filter tabs ──
    filterRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    filterButton: {
      flex: 1,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
    },
    filterButtonText: { color: colors.text, fontWeight: '800', fontSize: 12 },

    listCountLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 8,
    },

    // ── Item card ──
    itemCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 4,
      borderRadius: 16,
      padding: 14,
      marginBottom: 10,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
      elevation: 2,
    },
    itemHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: 10,
    },
    itemTitle: { color: colors.text, fontWeight: '900', fontSize: 14 },
    itemDesc: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginTop: 2 },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    statusBadgeText: { fontSize: 11, fontWeight: '900' },

    // ── Qty row ──
    qtyRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
    qtyPill: {
      flex: 1,
      backgroundColor: colors.surface2,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    qtyPillLabel: { fontSize: 10, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase' },
    qtyPillValue: { fontSize: 15, fontWeight: '900', color: colors.text, marginTop: 3 },

    // ── Meta chips ──
    itemMetaRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 10 },
    metaChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.surface2,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: colors.border,
    },
    metaChipText: { fontSize: 11, fontWeight: '700', color: colors.textMuted },

    resolutionText: { fontSize: 11, fontWeight: '700', marginBottom: 10 },

    // ── Actions ──
    actionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    actionButtonSecondary: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface2,
    },
    actionButtonText: { fontSize: 12, fontWeight: '800' },
  });

export default ConferenciaDivergenciasScreen;
