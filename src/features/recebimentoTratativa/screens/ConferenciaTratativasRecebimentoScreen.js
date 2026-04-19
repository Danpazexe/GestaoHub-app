import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-toast-message';
import ScreenLayout, {
  createHeaderActionsTemplate,
  createHeaderTitleTemplate,
  createScreenHeaderTemplate,
} from '../../../components/ScreenLayout';
import {
  ACTION_OPTIONS,
  STATUS_OPTIONS,
  formatSelectionSummary,
  normalizeSelectionValues,
  TRATATIVA_THEME,
  formatDatePt,
  formatDateTimePt,
  getActionMeta,
  getOccurrenceMeta,
  getStatusMeta,
} from '../constants/tratativaOptions';
import {
  listTratativaCases,
  updateTratativaStatus,
} from '../services/tratativaCaseService';
import { shareTratativaCasePdf } from '../services/tratativaPdfService';

const ConferenciaTratativasRecebimentoScreen = ({ navigation, isDarkMode }) => {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [sharingId, setSharingId] = useState(null);

  const openNewCase = useCallback(() => {
    navigation.navigate('EspelhoRecebimentoScreen');
  }, [navigation]);

  const loadCases = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }

    try {
      const loadedCases = await listTratativaCases();
      setCases(Array.isArray(loadedCases) ? loadedCases : []);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCases();
    }, [loadCases]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCases({ silent: true });
    setRefreshing(false);
  }, [loadCases]);

  useEffect(() => {
    navigation.setOptions({
      ...createScreenHeaderTemplate({
        isDarkMode,
        lightHeaderColor: TRATATIVA_THEME.primary,
        darkHeaderColor: TRATATIVA_THEME.primaryDark,
        tintColor: TRATATIVA_THEME.white,
        titleSize: 18,
        titleWeight: '700',
      }),
      headerTitle: () =>
        createHeaderTitleTemplate({
          title: 'Tratativas receb.',
          subtitle: 'Recebimento e devolucoes',
          iconName: 'assignment-turned-in',
          tintColor: TRATATIVA_THEME.white,
        }),
      headerRight: () =>
        createHeaderActionsTemplate({
          isDarkMode,
          actions: [
            {
              key: 'refresh',
              iconName: 'refresh',
              onPress: onRefresh,
              iconColor: TRATATIVA_THEME.white,
              iconSize: 20,
            },
            {
              key: 'new-case',
              iconName: 'add',
              onPress: openNewCase,
              iconColor: TRATATIVA_THEME.white,
              iconSize: 22,
            },
          ],
        }),
    });
  }, [isDarkMode, navigation, onRefresh, openNewCase]);

  const filteredCases = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return cases.filter((item) => {
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesAction = actionFilter === 'all' || item.resolution_type === actionFilter;
      const matchesQuery = !query
        || item.doc_number?.toLowerCase().includes(query)
        || item.supplier_code?.toLowerCase().includes(query)
        || item.origin_invoice_number?.toLowerCase().includes(query)
        || item.return_invoice_number?.toLowerCase().includes(query)
        || item.product_snapshot?.descricao?.toLowerCase().includes(query)
        || item.product_snapshot?.fornecedor?.toLowerCase().includes(query)
        || item.reason?.toLowerCase().includes(query)
        || item.occurrence_type?.toLowerCase().includes(query);
      return matchesStatus && matchesAction && matchesQuery;
    });
  }, [actionFilter, cases, searchText, statusFilter]);

  const summary = useMemo(() => ({
    total: filteredCases.length,
    abertas: filteredCases.filter((item) => item.status === 'ABERTA').length,
    andamento: filteredCases.filter((item) => item.status === 'EM ANDAMENTO').length,
    encerradas: filteredCases.filter((item) => item.status === 'ENCERRADA').length,
  }), [filteredCases]);

  const handleCancel = useCallback((caseItem) => {
    Alert.alert(
      'Cancelar tratativa',
      'O espelho sera marcado como cancelado, sem alterar o historico ja registrado.',
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Cancelar tratativa',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateTratativaStatus(caseItem, 'CANCELADA');
              await loadCases({ silent: true });
            } catch (error) {
              Toast.show({
                type: 'error',
                text1: 'Falha ao cancelar',
                text2: error?.message || 'Nao foi possivel atualizar a tratativa.',
              });
            }
          },
        },
      ],
    );
  }, [loadCases]);

  const handleShare = useCallback(async (caseItem) => {
    setSharingId(caseItem.id);
    try {
      await shareTratativaCasePdf(caseItem);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Falha ao exportar PDF',
        text2: error?.message || 'Nao foi possivel gerar o documento.',
      });
    } finally {
      setSharingId(null);
    }
  }, []);

  const renderFilterPill = (label, value, selectedValue, onPress, color) => (
    <TouchableOpacity
      key={value}
      onPress={() => onPress(value)}
      style={[
        styles.filterPill,
        {
          backgroundColor: selectedValue === value ? color : (isDarkMode ? '#2b3350' : '#ffffff'),
          borderColor: selectedValue === value ? color : (isDarkMode ? TRATATIVA_THEME.borderDark : TRATATIVA_THEME.border),
        },
      ]}
    >
      <Text style={[styles.filterPillText, { color: selectedValue === value ? '#ffffff' : (isDarkMode ? TRATATIVA_THEME.textDark : TRATATIVA_THEME.text) }]}>{label}</Text>
    </TouchableOpacity>
  );

  const renderItem = ({ item }) => {
    const statusMeta = getStatusMeta(item.status);
    const actionMeta = getActionMeta(item.resolution_type);
    const occurrenceMeta = getOccurrenceMeta(item.occurrence_type);
    const reasonsSummary = formatSelectionSummary(
      normalizeSelectionValues(item.reasons, item.reason),
      { maxItems: 2 },
    );
    const quantityLabel = item.occurrence_type === 'falta' ? 'Falta' : 'Qtd';
    const quantityValue = item.occurrence_type === 'falta'
      ? item.affected_quantity
      : (item.affected_quantity || item.received_quantity);

    return (
      <View style={[styles.caseCard, { backgroundColor: isDarkMode ? TRATATIVA_THEME.cardDark : TRATATIVA_THEME.card, borderColor: isDarkMode ? TRATATIVA_THEME.borderDark : TRATATIVA_THEME.border }]}>
        <View style={styles.caseCardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.caseDoc, { color: isDarkMode ? TRATATIVA_THEME.textDark : TRATATIVA_THEME.text }]}>{item.doc_number}</Text>
            <Text style={[styles.caseTitle, { color: isDarkMode ? TRATATIVA_THEME.textDark : TRATATIVA_THEME.text }]} numberOfLines={2}>
              {item.product_snapshot?.descricao || 'Mercadoria sem descricao'}
            </Text>
            <Text style={[styles.caseSub, { color: isDarkMode ? TRATATIVA_THEME.textMutedDark : TRATATIVA_THEME.textMuted }]}>
              Forn. {item.supplier_code || 's/cod'} | {item.product_snapshot?.fornecedor || 'Fornecedor nao informado'} | NF {item.origin_invoice_number || 'nao informada'}
            </Text>
            <Text style={[styles.caseSub, { color: isDarkMode ? TRATATIVA_THEME.textMutedDark : TRATATIVA_THEME.textMuted }]}>
              Atualizado em {formatDateTimePt(item.updated_at)}
            </Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: statusMeta.background }]}>
            <Text style={[styles.statusBadgeText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={[styles.metaChip, { backgroundColor: `${actionMeta.color}18` }]}>
            <MaterialIcons name={actionMeta.icon} size={16} color={actionMeta.color} />
            <Text style={[styles.metaChipText, { color: actionMeta.color }]}>{actionMeta.label}</Text>
          </View>
          <View style={[styles.metaChip, { backgroundColor: `${occurrenceMeta.color}18` }]}>
            <MaterialIcons name={occurrenceMeta.icon} size={16} color={occurrenceMeta.color} />
            <Text style={[styles.metaChipText, { color: occurrenceMeta.color }]}>{occurrenceMeta.label}</Text>
          </View>
          <View style={[styles.metaChip, { backgroundColor: isDarkMode ? '#334155' : '#eef2f7' }]}>
            <MaterialIcons name="tag" size={16} color={isDarkMode ? '#d6dbf1' : TRATATIVA_THEME.secondary} />
            <Text style={[styles.metaChipText, { color: isDarkMode ? '#d6dbf1' : TRATATIVA_THEME.secondary }]}>{quantityLabel} {quantityValue || 0}</Text>
          </View>
          <View style={[styles.metaChip, { backgroundColor: isDarkMode ? '#334155' : '#eef2f7' }]}>
            <MaterialIcons name="event" size={16} color={isDarkMode ? '#d6dbf1' : TRATATIVA_THEME.secondary} />
            <Text style={[styles.metaChipText, { color: isDarkMode ? '#d6dbf1' : TRATATIVA_THEME.secondary }]}>{formatDatePt(item.expected_end_at)}</Text>
          </View>
          {item.return_invoice_number ? (
            <View style={[styles.metaChip, { backgroundColor: isDarkMode ? '#334155' : '#eef2f7' }]}>
              <MaterialIcons name="receipt-long" size={16} color={isDarkMode ? '#d6dbf1' : TRATATIVA_THEME.secondary} />
              <Text style={[styles.metaChipText, { color: isDarkMode ? '#d6dbf1' : TRATATIVA_THEME.secondary }]}>NF dev. {item.return_invoice_number}</Text>
            </View>
          ) : null}
          {item.pending_remote_sync ? (
            <View style={[styles.metaChip, { backgroundColor: '#fff4cf' }]}>
              <MaterialIcons name="sync-problem" size={16} color="#b45309" />
              <Text style={[styles.metaChipText, { color: '#b45309' }]}>Pendente sync</Text>
            </View>
          ) : null}
        </View>

        <Text style={[styles.reasonText, { color: isDarkMode ? TRATATIVA_THEME.textDark : TRATATIVA_THEME.text }]}>
          Motivos: <Text style={{ fontWeight: '800' }}>{reasonsSummary}</Text>
        </Text>
        {item.return_invoice_number ? (
          <Text style={[styles.reasonText, styles.reasonSpacing, { color: isDarkMode ? TRATATIVA_THEME.textDark : TRATATIVA_THEME.text }]}>
            NF devolução: <Text style={{ fontWeight: '800' }}>{item.return_invoice_number}</Text>
          </Text>
        ) : null}

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: isDarkMode ? '#2b3350' : '#f8fafc', borderColor: isDarkMode ? TRATATIVA_THEME.borderDark : TRATATIVA_THEME.border }]}
            onPress={() => navigation.navigate('EspelhoRecebimentoScreen', { caseId: item.id })}
          >
            <MaterialIcons name="open-in-new" size={18} color={TRATATIVA_THEME.secondary} />
            <Text style={[styles.actionText, { color: isDarkMode ? TRATATIVA_THEME.textDark : TRATATIVA_THEME.text }]}>Abrir</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: isDarkMode ? '#2b3350' : '#f8fafc', borderColor: isDarkMode ? TRATATIVA_THEME.borderDark : TRATATIVA_THEME.border }]}
            onPress={() => handleShare(item)}
          >
            {sharingId === item.id ? (
              <ActivityIndicator size="small" color={TRATATIVA_THEME.primary} />
            ) : (
              <>
                <MaterialIcons name="picture-as-pdf" size={18} color={TRATATIVA_THEME.primary} />
                <Text style={[styles.actionText, { color: isDarkMode ? TRATATIVA_THEME.textDark : TRATATIVA_THEME.text }]}>PDF</Text>
              </>
            )}
          </TouchableOpacity>

          {item.status !== 'CANCELADA' ? (
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => handleCancel(item)}
            >
              <MaterialIcons name="cancel" size={18} color="#ffffff" />
              <Text style={[styles.actionText, { color: '#ffffff' }]}>Cancelar</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <ScreenLayout
      isDarkMode={isDarkMode}
      lightBackground={TRATATIVA_THEME.background}
      darkBackground={TRATATIVA_THEME.backgroundDark}
      contentStyle={styles.container}
    >
      <FlatList
        data={filteredCases}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TRATATIVA_THEME.primary} />}
        contentContainerStyle={filteredCases.length === 0 ? styles.emptyContainer : styles.listContent}
        ListHeaderComponent={
          <View>
            <View style={[styles.searchShell, { backgroundColor: isDarkMode ? TRATATIVA_THEME.cardDark : TRATATIVA_THEME.card, borderColor: isDarkMode ? TRATATIVA_THEME.borderDark : TRATATIVA_THEME.border }]}>
              <MaterialIcons name="search" size={22} color={isDarkMode ? TRATATIVA_THEME.textMutedDark : TRATATIVA_THEME.textMuted} />
              <TextInput
                value={searchText}
                onChangeText={setSearchText}
                placeholder="Buscar NF, fornecedor ou item"
                placeholderTextColor={isDarkMode ? '#8b96ba' : '#98a2b3'}
                style={[styles.searchInput, { color: isDarkMode ? TRATATIVA_THEME.textDark : TRATATIVA_THEME.text }]}
              />
            </View>

            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, { backgroundColor: isDarkMode ? TRATATIVA_THEME.cardDark : TRATATIVA_THEME.card }]}>
                <Text style={styles.summaryLabel}>Total</Text>
                <Text style={[styles.summaryValue, { color: isDarkMode ? TRATATIVA_THEME.textDark : TRATATIVA_THEME.text }]}>{summary.total}</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: isDarkMode ? TRATATIVA_THEME.cardDark : TRATATIVA_THEME.card }]}>
                <Text style={styles.summaryLabel}>Abertas</Text>
                <Text style={[styles.summaryValue, { color: '#d97706' }]}>{summary.abertas}</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: isDarkMode ? TRATATIVA_THEME.cardDark : TRATATIVA_THEME.card }]}>
                <Text style={styles.summaryLabel}>Em andamento</Text>
                <Text style={[styles.summaryValue, { color: '#1e7fc5' }]}>{summary.andamento}</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: isDarkMode ? TRATATIVA_THEME.cardDark : TRATATIVA_THEME.card }]}>
                <Text style={styles.summaryLabel}>Encerradas</Text>
                <Text style={[styles.summaryValue, { color: '#059669' }]}>{summary.encerradas}</Text>
              </View>
            </View>

            <Text style={[styles.sectionLabel, { color: isDarkMode ? TRATATIVA_THEME.textMutedDark : TRATATIVA_THEME.textMuted }]}>Filtrar por status</Text>
            <View style={styles.filterRow}>
              {renderFilterPill('Todos', 'all', statusFilter, setStatusFilter, TRATATIVA_THEME.primary)}
              {STATUS_OPTIONS.map((item) => renderFilterPill(item.label, item.key, statusFilter, setStatusFilter, item.color))}
            </View>

            <Text style={[styles.sectionLabel, { color: isDarkMode ? TRATATIVA_THEME.textMutedDark : TRATATIVA_THEME.textMuted }]}>Filtrar por desfecho</Text>
            <View style={styles.filterRow}>
              {renderFilterPill('Todos', 'all', actionFilter, setActionFilter, TRATATIVA_THEME.secondary)}
              {ACTION_OPTIONS.map((item) => renderFilterPill(item.label, item.key, actionFilter, setActionFilter, item.color))}
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={TRATATIVA_THEME.primary} />
          ) : (
            <View style={styles.emptyState}>
              <MaterialIcons name="assignment-late" size={44} color={TRATATIVA_THEME.textMuted} />
              <Text style={[styles.emptyTitle, { color: isDarkMode ? TRATATIVA_THEME.textDark : TRATATIVA_THEME.text }]}>Nenhum espelho encontrado</Text>
              <Text style={[styles.emptySubtitle, { color: isDarkMode ? TRATATIVA_THEME.textMutedDark : TRATATIVA_THEME.textMuted }]}>
                Crie um espelho avulso para registrar avaria, falta, troca, devolução ou descarte no recebimento.
              </Text>
              <TouchableOpacity style={styles.emptyCta} onPress={openNewCase}>
                <MaterialIcons name="add" size={18} color="#ffffff" />
                <Text style={styles.emptyCtaText}>Novo espelho</Text>
              </TouchableOpacity>
            </View>
          )
        }
      />
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 28,
  },
  emptyContainer: {
    flexGrow: 1,
    padding: 16,
  },
  searchShell: {
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  summaryCard: {
    flexBasis: '48%',
    borderRadius: 18,
    padding: 14,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#98a2b3',
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 4,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  caseCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
  },
  caseCardHeader: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  caseDoc: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  caseTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  caseSub: {
    marginTop: 4,
    fontSize: 12,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  metaChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  reasonText: {
    fontSize: 13,
    marginBottom: 6,
  },
  reasonSpacing: {
    marginBottom: 14,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  actionButton: {
    minWidth: 100,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cancelButton: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '800',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  emptyCta: {
    marginTop: 18,
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 16,
    backgroundColor: TRATATIVA_THEME.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptyCtaText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});

export default ConferenciaTratativasRecebimentoScreen;
