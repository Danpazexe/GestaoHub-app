import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Animatable from 'react-native-animatable';
import HapticFeedback from 'react-native-haptic-feedback';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import ScreenLayout, {
  createHeaderActionsTemplate,
  createHeaderTitleTemplate,
  createScreenHeaderTemplate,
} from '../../../components/ScreenLayout';
import ConferenciaBonusCard from '../components/ConferenciaBonusCard';
import ConferenciaItemRow from '../components/ConferenciaItemRow';
import { finalizeConferenciaSaida, listConferenciaSaidas } from '../services/conferenciaRecordsService';
import { readStoredUserName } from '../../../services/userSessionStorageService';
import {
  buildConferenceEvent,
  computeTotals,
  normalizeKey,
  pluralize,
} from '../services/conferenciaCore';
import {
  buildConferenceResultSummary,
  finishRemoteConferenciaSaidaBonus,
  listRemoteConferenciaSaidaBonusQueue,
  loadRemoteConferenciaSaidaBonusItems,
  syncRemoteConferenciaSaidaBonusProgress,
} from '../services/conferenciaSaidaBonusQueueService';
import { useConferenciaSaidaDrafts } from '../hooks/useConferenciaSaidaDrafts';
import { conferenciaSaidaTheme } from '../../../theme/domains/conferencia';

// Status "terminais": bônus de saída já encerrado (conferido / saída dada) não
// aparece para o conferente — fica só no painel do admin.
const TERMINAL_BONUS_STATUSES = ['finalizada', 'saida_realizada'];
const isTerminalBonusStatus = (status) => TERMINAL_BONUS_STATUSES.includes(String(status || '').trim());

// Aba (A conferir / Conferido) — contagem por itens, cego-safe.
const TabButton = ({ label, count, active, onPress, colors, styles }) => (
  <Pressable
    onPress={onPress}
    style={[styles.tabButton, active && styles.tabButtonActive]}
    accessibilityRole="tab"
    accessibilityState={{ selected: active }}
    accessibilityLabel={`${label}, ${count} ${count === 1 ? 'item' : 'itens'}`}
  >
    <Text style={[styles.tabButtonText, { color: active ? colors.primary : colors.textMuted }]}>{label}</Text>
    <View style={[styles.tabBadge, { backgroundColor: active ? colors.primary : colors.slateSoft }]}>
      <Text style={[styles.tabBadgeText, { color: active ? '#ffffff' : colors.textMuted }]}>{count}</Text>
    </View>
  </Pressable>
);

// Linha de leitura com pulse ao bipar — idêntica à da conferência de recebimento.
const ScanInputRow = ({ codeInputRef, manualCode, setManualCode, onSubmit, onOpenScanner, colors, styles, lastScanned }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const prevScanned = useRef('');

  useEffect(() => {
    if (lastScanned && lastScanned !== prevScanned.current) {
      prevScanned.current = lastScanned;
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.94, duration: 80, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 120, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]).start();
    }
  }, [lastScanned, pulseAnim]);

  return (
    <View style={styles.scanCard}>
      <View style={styles.scanCardHeader}>
        <View style={[styles.sectionIconWrap, { backgroundColor: colors.primary, width: 30, height: 30, borderRadius: 10 }]}>
          <MaterialIcons name="qr-code-scanner" size={15} color="#ffffff" />
        </View>
        <Text style={styles.scanCardTitle}>Leitura</Text>
        {lastScanned ? (
          <Text style={styles.lastScannedBadge} numberOfLines={1}>↩ {lastScanned}</Text>
        ) : null}
      </View>
      <Animated.View style={[styles.codeInputRow, { transform: [{ scale: pulseAnim }] }]}>
        <TextInput
          ref={codeInputRef}
          style={[styles.input, styles.codeInput]}
          placeholder="Código — pressione Enter"
          placeholderTextColor={colors.textMuted}
          value={manualCode}
          onChangeText={setManualCode}
          onSubmitEditing={onSubmit}
          returnKeyType="done"
          blurOnSubmit={false}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable
          style={styles.scanIconButton}
          onPress={onOpenScanner}
          accessibilityLabel="Abrir câmera para bipagem"
        >
          <MaterialIcons name="photo-camera" size={20} color="#ffffff" />
        </Pressable>
      </Animated.View>
    </View>
  );
};

// ─── Main screen ──────────────────────────────────────────────────────────────
const ConferenciaSaidaScreen = ({ navigation, route, isDarkMode }) => {
  const [orderCode, setOrderCode] = useState('');
  const [separador, setSeparador] = useState('');
  const [embalador, setEmbalador] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [started, setStarted] = useState(false);
  const [items, setItems] = useState([]);
  const [lastScanned, setLastScanned] = useState('');
  const [lastScannedAt, setLastScannedAt] = useState(0);
  const [tab, setTab] = useState(0); // 0 = A conferir, 1 = Conferido
  const [pagerSize, setPagerSize] = useState({ width: 0, height: 0 });

  // Fila remota (bônus de saída montados no painel)
  const [remoteQueue, setRemoteQueue] = useState([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [openingQueueId, setOpeningQueueId] = useState(null);
  const [activeRemoteQueueId, setActiveRemoteQueueId] = useState(null);
  const [finalizedInfo, setFinalizedInfo] = useState(null);
  const [finalizedSaidas, setFinalizedSaidas] = useState([]); // backstop local de pedidos já finalizados
  const [orderScan, setOrderScan] = useState(''); // bipar/digitar o pedido para entrar

  const codeInputRef = useRef(null);
  const pagerRef = useRef(null);
  const orderScanRef = useRef(null);

  const goToTab = (index) => {
    setTab(index);
    pagerRef.current?.scrollToOffset({ offset: index * pagerSize.width, animated: true });
  };

  useEffect(() => {
    if (pagerSize.width > 0) {
      pagerRef.current?.scrollToOffset({ offset: tab * pagerSize.width, animated: false });
    }
  }, [pagerSize.width]); // eslint-disable-line react-hooks/exhaustive-deps

  const colors = useMemo(() => {
    const base = conferenciaSaidaTheme;
    const dark = !!isDarkMode;
    return {
      primary: base.primary,
      secondary: base.secondary,
      accentText: base.text,
      background: dark ? '#1f2438' : base.background || '#eef2ff',
      surface: dark ? '#262d47' : '#ffffff',
      surface2: dark ? '#2b3350' : '#f7f7f8',
      text: dark ? '#f3f5ff' : '#2f333a',
      textMuted: dark ? '#aab1cf' : 'rgba(64,68,76,0.78)',
      border: dark ? '#3a4265' : 'rgba(64,68,76,0.18)',
      divider: dark ? 'rgba(255,255,255,0.10)' : 'rgba(64,68,76,0.14)',
      inputBg: dark ? '#202846' : '#ffffff',
      chipBg: dark ? 'rgba(255,255,255,0.06)' : 'rgba(67,56,202,0.08)',
      onPrimary: '#ffffff',
      shadow: '#000000',
      success: '#059669',
      successSoft: dark ? 'rgba(16,185,129,0.16)' : 'rgba(16,185,129,0.12)',
      danger: '#dc2626',
      dangerSoft: dark ? 'rgba(220,38,38,0.16)' : 'rgba(220,38,38,0.10)',
      warning: '#f59e0b',
      sky: dark ? '#818cf8' : '#4f46e5',
      goldSoft: dark ? 'rgba(251,191,36,0.18)' : 'rgba(245,158,11,0.14)',
      slateSoft: dark ? 'rgba(148,163,184,0.16)' : 'rgba(100,116,139,0.10)',
      pendingAccent: dark ? '#fb923c' : '#ea580c',
      doneAccent: dark ? '#34d399' : '#059669',
    };
  }, [isDarkMode]);

  const styles = useMemo(() => getStyles(colors), [colors]);
  const draftApi = useConferenciaSaidaDrafts();
  // Desestrutura as funções ESTÁVEIS (useCallback) — depender do objeto draftApi
  // inteiro nos effects causa loop: ele troca de identidade a cada mudança de
  // rascunho, e os effects que chamam loadDrafts() mudam o rascunho.
  const { drafts, loadDrafts, upsertDraftImmediate, upsertDraftDebounced, removeByKey } = draftApi;

  // Focus recovery on screen focus during active conference
  useEffect(() => {
    if (!started) return;
    const unsub = navigation.addListener('focus', () => {
      setTimeout(() => codeInputRef.current?.focus?.(), 150);
    });
    return unsub;
  }, [navigation, started]);

  const loadRemoteQueue = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setQueueLoading(true);
    try {
      const queue = await listRemoteConferenciaSaidaBonusQueue();
      setRemoteQueue(Array.isArray(queue) ? queue : []);
    } catch {
      setRemoteQueue([]);
    } finally {
      if (!silent) setQueueLoading(false);
    }
  }, []);

  const loadFinalizedSaidas = useCallback(() => {
    listConferenciaSaidas()
      .then((list) => setFinalizedSaidas(Array.isArray(list) ? list : []))
      .catch(() => setFinalizedSaidas([]));
  }, []);

  const handleRefreshQueue = useCallback(() => {
    loadDrafts();
    loadRemoteQueue();
    loadFinalizedSaidas();
  }, [loadDrafts, loadRemoteQueue, loadFinalizedSaidas]);

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
          title: started && orderCode ? orderCode : 'Conferência de saída',
          subtitle: started ? 'Conferência cega em andamento' : 'Pedidos para conferir',
          iconName: 'local-shipping',
          tintColor: '#ffffff',
        }),
      headerRight: started
        ? undefined
        : () => createHeaderActionsTemplate({
            isDarkMode,
            actions: [
              {
                key: 'refresh-queue',
                iconName: 'sync',
                accessibilityLabel: 'Atualizar fila',
                onPress: () => handleRefreshQueue(),
                isActive: queueLoading,
                iconColor: '#ffffff',
                iconSize: 20,
              },
            ],
          }),
    });
    // handleRefreshQueue é estável o suficiente; fora das deps de propósito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, isDarkMode, colors.primary, started, orderCode, queueLoading]);

  useEffect(() => {
    const loadLoggedUser = async () => {
      try {
        const name = await readStoredUserName('');
        if (name) { setSeparador(name); setEmbalador(name); }
      } catch { /* ignore */ }
    };
    loadLoggedUser();
  }, []);

  // ── Itens bipados durante a conferência ──
  useEffect(() => {
    if (!route.params?.scannedCode || !started) return;
    const scanned = String(route.params.scannedCode).trim();
    navigation.setParams({ scannedCode: undefined, scannedQty: undefined });
    beginScanFlow(scanned, 1);
  }, [route.params?.scannedCode, started]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pedido bipado na fila (câmera) → entra no bônus ──
  useEffect(() => {
    if (!route.params?.scannedOrderCode || started) return;
    const scanned = String(route.params.scannedOrderCode).trim();
    navigation.setParams({ scannedOrderCode: undefined });
    enterBonusByCode(scanned);
  }, [route.params?.scannedOrderCode, started]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!route.params?.scanConfirm) return;
    const payload = route.params.scanConfirm;
    navigation.setParams({ scanConfirm: undefined });
    applyScanPayload(payload);
  }, [route.params?.scanConfirm, navigation]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadDrafts();
    loadRemoteQueue();
    loadFinalizedSaidas();
    const unsub = navigation.addListener('focus', () => {
      loadDrafts();
      loadRemoteQueue({ silent: true });
      loadFinalizedSaidas();
    });
    return unsub;
  }, [navigation, loadDrafts, loadRemoteQueue, loadFinalizedSaidas]); // eslint-disable-line react-hooks/exhaustive-deps

  // Conferência CEGA: abas por "ainda não contei" (checkedQty===0) vs "já
  // contei" (checkedQty>0) — sem revelar a quantidade esperada.
  const notCountedItems = useMemo(
    () => items
      .filter((i) => Number(i.checkedQty || 0) === 0)
      .slice()
      .sort((a, b) => String(a.description).localeCompare(String(b.description))),
    [items],
  );

  const countedItems = useMemo(() => {
    const key = String(lastScanned || '').trim();
    return items
      .filter((i) => Number(i.checkedQty || 0) > 0)
      .slice()
      .sort((a, b) => {
        const aHit = key && (a.code === key || a.ean === key) ? 1 : 0;
        const bHit = key && (b.code === key || b.ean === key) ? 1 : 0;
        if (aHit !== bHit) return bHit - aHit;
        const aAt = a.lastMeta?.at || '';
        const bAt = b.lastMeta?.at || '';
        if (aAt !== bAt) return aAt < bAt ? 1 : -1;
        return String(a.description).localeCompare(String(b.description));
      });
  }, [items, lastScanned]);

  // ── Fila: merge remoto + rascunhos (chave = order_code) ──
  const queueItems = useMemo(() => {
    const remoteByOrder = new Map(
      remoteQueue.map((item) => [normalizeKey(item?.orderCode || ''), item]),
    );

    const remoteQueueItems = remoteQueue.map((item) => ({ ...item, source: 'remote' }));

    const draftsQueue = drafts
      .map((draft) => {
        const orderKey = normalizeKey(draft?.orderCode || '');
        const remoteMatch = remoteByOrder.get(orderKey);
        const remoteQueueId = draft?.remoteQueueId || remoteMatch?.id || null;
        const hasProgress = Array.isArray(draft?.items)
          ? draft.items.some((entry) => Number(entry?.checkedQty || 0) > 0)
          : false;

        if (!orderKey || !remoteQueueId) return null;

        return {
          id: `draft-${orderKey}`,
          remoteQueueId,
          orderCode: draft?.orderCode || '',
          customerName: remoteMatch?.customerName || '',
          customerCode: remoteMatch?.customerCode || '',
          createdAt: draft?.updatedAt || draft?.createdAt || remoteMatch?.createdAt || new Date().toISOString(),
          lines: Array.isArray(draft?.items) ? draft.items.length : Number(remoteMatch?.lines || 0),
          status: hasProgress ? 'em_conferencia' : 'nao_iniciado',
          source: 'draft',
        };
      })
      .filter(Boolean);

    const mergedMap = new Map();
    const isTerminalRemote = (entry) => entry?.source === 'remote' && isTerminalBonusStatus(entry?.status);

    [...draftsQueue, ...remoteQueueItems].forEach((item) => {
      const key = normalizeKey(item?.orderCode || '');
      if (!key) return;
      const existing = mergedMap.get(key);
      if (!existing) { mergedMap.set(key, item); return; }
      if (isTerminalRemote(existing)) return;
      if (isTerminalRemote(item)) { mergedMap.set(key, item); return; }
      if (item.source === 'draft' && existing.source !== 'draft') {
        mergedMap.set(key, item);
      }
    });

    return [...mergedMap.values()].sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
    );
  }, [drafts, remoteQueue]);

  const draftStatusByOrder = useMemo(() => {
    const map = new Map();
    drafts.forEach((draft) => {
      const key = normalizeKey(draft?.orderCode || '');
      if (!key) return;
      const hasProgress = Array.isArray(draft?.items)
        ? draft.items.some((item) => Number(item?.checkedQty || 0) > 0)
        : false;
      map.set(key, hasProgress ? 'em_conferencia' : 'nao_iniciado');
    });
    return map;
  }, [drafts]);

  // Sincroniza progresso dos rascunhos vinculados (mostra "em conferência" no painel).
  useEffect(() => {
    const linkedDrafts = drafts.filter((draft) => draft?.remoteQueueId);
    if (!linkedDrafts.length) return;
    linkedDrafts.forEach((draft) => {
      const checkedItems = Array.isArray(draft?.items)
        ? draft.items.filter((item) => Number(item?.checkedQty || 0) > 0).length
        : 0;
      const checkedQty = Array.isArray(draft?.items)
        ? draft.items.reduce((sum, item) => sum + Number(item?.checkedQty || 0), 0)
        : 0;
      syncRemoteConferenciaSaidaBonusProgress(draft.remoteQueueId, { checkedItems, checkedQty });
    });
  }, [drafts]);

  // Backstop: pedidos já finalizados localmente (mesmo que o finish remoto tenha
  // falhado offline) não podem ser mascarados por um rascunho stale.
  const finalizedStatusByOrder = useMemo(() => {
    const map = new Map();
    finalizedSaidas.forEach((record) => {
      const key = normalizeKey(record?.orderCode || '');
      if (key) map.set(key, 'finalizada');
    });
    return map;
  }, [finalizedSaidas]);

  const resolveCardStatus = useCallback((item) => {
    const key = normalizeKey(item?.orderCode || '');
    if (finalizedStatusByOrder.get(key) === 'finalizada') return 'finalizada';
    if (isTerminalBonusStatus(item?.status)) return item.status;
    return draftStatusByOrder.get(key) || item?.status || 'nao_iniciado';
  }, [finalizedStatusByOrder, draftStatusByOrder]);

  const queueFiltered = useMemo(() => {
    const q = String(orderScan || '').trim().toLowerCase();
    if (!q) return queueItems;
    return queueItems.filter((b) =>
      `${b.orderCode} ${b.customerName} ${b.customerCode}`.toLowerCase().includes(q),
    );
  }, [queueItems, orderScan]);

  // Conferência concluída sai da lista do conferente — finalizados ficam só no
  // painel do admin. Em conferência primeiro, depois não iniciados.
  const sortedQueue = useMemo(() => {
    const openOnly = queueFiltered.filter((item) => !isTerminalBonusStatus(resolveCardStatus(item)));
    const rank = (item) => (resolveCardStatus(item) === 'em_conferencia' ? 0 : 1);
    return openOnly.sort((a, b) => {
      const diff = rank(a) - rank(b);
      if (diff !== 0) return diff;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  }, [queueFiltered, resolveCardStatus]);

  const queueCounts = useMemo(() => {
    let open = 0;
    queueItems.forEach((item) => {
      if (!isTerminalBonusStatus(resolveCardStatus(item))) open += 1;
    });
    return { open };
  }, [queueItems, resolveCardStatus]);

  const resumeDraft = useCallback((draft, remoteQueueId) => {
    setActiveRemoteQueueId(remoteQueueId || draft?.remoteQueueId || null);
    setOrderCode(draft.orderCode || '');
    setSeparador(draft.separador || separador);
    setEmbalador(draft.embalador || embalador);
    setItems(Array.isArray(draft.items) ? draft.items : []);
    setStarted(true);
  }, [separador, embalador]);

  const openRemoteBonus = useCallback((item) => {
    if (openingQueueId) return;
    setOpeningQueueId(item.id);
    loadRemoteConferenciaSaidaBonusItems(item.id)
      .then((remoteItems) => {
        if (!Array.isArray(remoteItems) || remoteItems.length === 0) {
          Alert.alert('Pedido sem itens', 'Esse bônus de saída foi montado, mas não gerou itens para conferência.');
          return;
        }
        setActiveRemoteQueueId(item.id);
        setOrderCode(item.orderCode || '');
        setItems(remoteItems);
        setStarted(true);
        setOrderScan('');
        loadRemoteQueue({ silent: true });
      })
      .catch(() => {
        Alert.alert(
          'Erro ao carregar',
          'Não foi possível carregar os itens do pedido.',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Tentar de novo', onPress: () => openRemoteBonus(item) },
          ],
        );
      })
      .finally(() => setOpeningQueueId(null));
  }, [openingQueueId, loadRemoteQueue]);

  const handleQueueCardPress = useCallback((item) => {
    const key = normalizeKey(item?.orderCode || '');

    // Finalizado (remoto OU local) vence o rascunho stale (não reabre vazio).
    if (isTerminalBonusStatus(item?.status) || finalizedStatusByOrder.get(key) === 'finalizada') {
      setFinalizedInfo({
        orderCode: item?.orderCode || '-',
        customerName: item?.customerName || '',
        conferente: item?.assignedUserName || '',
      });
      return;
    }

    const draft = drafts.find((entry) => normalizeKey(entry?.orderCode || '') === key);
    if (draft) {
      const remoteMatch = remoteQueue.find((entry) => normalizeKey(entry?.orderCode || '') === key);
      resumeDraft(draft, remoteMatch?.id || item?.remoteQueueId || null);
      return;
    }

    if (item?.source === 'remote') {
      openRemoteBonus(item);
    }
  }, [drafts, remoteQueue, resumeDraft, openRemoteBonus, finalizedStatusByOrder]);

  // Bipar/digitar o número do pedido → entra no bônus correspondente (Winthor 3854).
  const enterBonusByCode = useCallback((rawCode) => {
    const key = normalizeKey(rawCode || '');
    if (!key) return;
    const exact = sortedQueue.find((item) => normalizeKey(item?.orderCode || '') === key);
    // Sem match exato: só entra no único card SE o código bipado fizer parte do
    // pedido dele (evita bipar um código errado e cair no único bônus da fila).
    const partialUnique = !exact && sortedQueue.length === 1
      && normalizeKey(sortedQueue[0]?.orderCode || '').includes(key)
      ? sortedQueue[0]
      : null;
    const target = exact || partialUnique;
    if (!target) {
      HapticFeedback.trigger('notificationError', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });
      Alert.alert('Pedido não encontrado', `O pedido "${String(rawCode).trim()}" não está na fila de saída.`);
      return;
    }
    handleQueueCardPress(target);
  }, [sortedQueue, handleQueueCardPress]);

  const handleOrderScanSubmit = useCallback(() => {
    const code = orderScan.trim();
    if (!code) return;
    enterBonusByCode(code);
  }, [orderScan, enterBonusByCode]);

  const openOrderScanner = useCallback(() => {
    navigation.navigate('BarcodeScannerScreen', {
      targetScreen: 'ConferenciaSaidaScreen',
      paramName: 'scannedOrderCode',
    });
  }, [navigation]);

  const openScanner = useCallback(() => {
    if (!started) {
      Alert.alert('Inicie primeiro', 'Entre em um pedido antes de bipar.');
      return;
    }
    navigation.navigate('BarcodeScannerScreen', {
      targetScreen: 'ConferenciaSaidaScreen',
      paramName: 'scannedCode',
    });
  }, [started, navigation]);

  const findItemForScan = useCallback((value) => {
    const key = String(value || '').trim();
    if (!key) return null;
    for (const it of items) {
      const opts = Array.isArray(it.packagingOptions) ? it.packagingOptions : [];
      const hit = opts.find((o) => (o?.ean && key === o.ean) || (o?.dun && key === o.dun));
      if (hit) return { item: it, opt: hit };
      if (key === it.code || (it.ean && key === it.ean) || (it.dun && key === it.dun)) {
        return { item: it, opt: null };
      }
    }
    return null;
  }, [items]);

  const beginScanFlow = useCallback((value, qty = 1) => {
    const amount = Math.max(1, Number(qty) || 1);
    const match = findItemForScan(value);
    if (!match?.item) {
      HapticFeedback.trigger('notificationError', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });
      Alert.alert('Código fora do pedido', `Código ${value} não pertence a este pedido.`);
      return;
    }
    const remaining = (Number(match.item.expectedQty) || 0) - (Number(match.item.checkedQty) || 0);
    if (remaining <= 0) {
      handleItemAlreadyFull(match.item);
      return;
    }
    navigation.navigate('ConferenciaScanScreen', {
      context: 'saida',
      targetScreen: 'ConferenciaSaidaScreen',
      itemId: match.item.id,
      scannedValue: String(value || '').trim(),
      initialQty: amount,
      initialPackagingId: match.opt?.id || null,
      item: {
        id: match.item.id,
        code: match.item.code,
        description: match.item.description,
        ean: match.item.ean,
        dun: match.item.dun,
        packagingOptions: match.item.packagingOptions,
        lastMeta: match.item.lastMeta,
      },
    });
  }, [findItemForScan, navigation]);

  // Persiste o rascunho na hora e sincroniza o progresso remoto (admin vê em
  // tempo real). Imediato — não depende do debounce, que poderia perder a última
  // leitura num crash.
  const persistItemsNow = useCallback((nextItems) => {
    if (!Array.isArray(nextItems)) return;
    if (started && orderCode.trim()) {
      upsertDraftImmediate({
        orderCode: orderCode.trim(),
        separador: separador.trim(),
        embalador: embalador.trim(),
        remoteQueueId: activeRemoteQueueId || null,
        items: nextItems,
        updatedAt: new Date().toISOString(),
      });
    }
    if (activeRemoteQueueId) {
      const checkedItems = nextItems.filter((i) => Number(i?.checkedQty || 0) > 0).length;
      const checkedQty = nextItems.reduce((s, i) => s + Number(i?.checkedQty || 0), 0);
      syncRemoteConferenciaSaidaBonusProgress(activeRemoteQueueId, { checkedItems, checkedQty });
    }
  }, [started, orderCode, separador, embalador, activeRemoteQueueId, upsertDraftImmediate]);

  const applyScanPayload = useCallback((payload) => {
    let overflow = false;
    let full = false;
    let nextSnapshot = null;
    const nowIso = new Date().toISOString();
    const scannedValue = String(payload?.scannedValue || '').trim();
    const effectiveQty = Math.max(1, Number(payload?.effectiveQty) || 1);
    const qty = Math.max(1, Number(payload?.qty) || 1);
    const factor = Math.max(1, Number(payload?.factor) || 1);
    const packaging = payload?.packaging || null;
    const itemId = String(payload?.itemId || '');
    const editMode = String(payload?.editMode || '').trim();

    setItems((prev) => {
      const nextItems = prev.map((it) => {
        if (it.id !== itemId) return it;
        const meta = {
          at: nowIso,
          scannedValue,
          lote: String(payload?.lote || '').trim(),
          validade: String(payload?.validade || '').trim(),
          embalagem: String(payload?.embalagem || '').trim(),
          packagingId: packaging?.id || 'un',
          packagingLabel: packaging?.label || 'UN',
          packagingFactor: Number(factor) || 1,
          qty: Number(qty) || 1,
          effectiveQty,
          ean: packaging?.ean || it.ean || '',
          dun: packaging?.dun || it.dun || '',
        };
        const currentReads = Array.isArray(it.reads) ? [...it.reads] : [];

        // Correção da última leitura: troca o read no lugar (não acumula).
        if (editMode === 'last_read' && currentReads.length > 0) {
          const lastRead = currentReads[currentReads.length - 1] || null;
          const previousQty = Number(lastRead?.effectiveQty || 0);
          const nextCheckedQty = (Number(it.checkedQty) || 0) - previousQty + effectiveQty;
          if (nextCheckedQty < 0 || nextCheckedQty > (Number(it.expectedQty) || 0)) {
            overflow = true;
            return it;
          }
          currentReads[currentReads.length - 1] = meta;
          return { ...it, checkedQty: nextCheckedQty, lastMeta: meta, reads: currentReads.slice(-50) };
        }

        const remaining = (Number(it.expectedQty) || 0) - (Number(it.checkedQty) || 0);
        if (remaining <= 0) { full = true; return it; }
        if (effectiveQty > remaining) { overflow = true; return it; }
        const nextReads = [...currentReads, meta].slice(-50);
        return { ...it, checkedQty: (Number(it.checkedQty) || 0) + effectiveQty, lastMeta: meta, reads: nextReads };
      });
      nextSnapshot = nextItems;
      return nextItems;
    });

    if (overflow) {
      HapticFeedback.trigger('notificationError', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });
      Alert.alert('Quantidade inválida', 'A quantidade informada excede o saldo disponível.');
      return;
    }
    if (full) {
      Alert.alert('Item já completo', 'Quantidade desse item já foi totalmente conferida.');
      return;
    }

    HapticFeedback.trigger('impactLight', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });
    setLastScanned(scannedValue);
    setLastScannedAt(Date.now());
    setManualCode('');
    persistItemsNow(nextSnapshot);
    setTimeout(() => codeInputRef.current?.focus?.(), 80);
  }, [persistItemsNow]);

  const updateItemReadCount = useCallback((itemId, nextCount) => {
    const next = Math.max(0, Number(nextCount) || 0);
    setItems((prev) => {
      const nextItems = prev.map((i) => i.id === itemId ? { ...i, checkedQty: next } : i);
      persistItemsNow(nextItems);
      return nextItems;
    });
  }, [persistItemsNow]);

  // Desfaz a ÚLTIMA leitura: remove o read e subtrai exatamente o effectiveQty
  // dele (não um -1 cego), reapontando o lastMeta.
  const undoLastRead = useCallback((itemId) => {
    setItems((prev) => {
      const nextItems = prev.map((it) => {
        if (it.id !== itemId) return it;
        const reads = Array.isArray(it.reads) ? [...it.reads] : [];
        if (reads.length === 0) {
          return { ...it, checkedQty: Math.max(0, Number(it.checkedQty || 0) - 1) };
        }
        const last = reads.pop();
        const dec = Math.max(1, Number(last?.effectiveQty || 1));
        const nextChecked = Math.max(0, Number(it.checkedQty || 0) - dec);
        return { ...it, checkedQty: nextChecked, reads, lastMeta: reads.length > 0 ? reads[reads.length - 1] : null };
      });
      persistItemsNow(nextItems);
      return nextItems;
    });
  }, [persistItemsNow]);

  // Limpa todas as leituras do item (zera contagem, lastMeta e reads).
  const clearItemReads = useCallback((itemId) => {
    setItems((prev) => {
      const nextItems = prev.map((item) => (
        item.id === itemId ? { ...item, checkedQty: 0, lastMeta: null, reads: [] } : item
      ));
      persistItemsNow(nextItems);
      return nextItems;
    });
  }, [persistItemsNow]);

  // Corrigir a última leitura: reabre a tela de leitura com editMode='last_read'.
  const openEditItem = useCallback((item) => {
    if (!item?.id || Number(item.checkedQty || 0) <= 0) return;
    const lastRead = Array.isArray(item.reads) && item.reads.length > 0
      ? item.reads[item.reads.length - 1]
      : null;
    navigation.navigate('ConferenciaScanScreen', {
      context: 'saida',
      targetScreen: 'ConferenciaSaidaScreen',
      itemId: item.id,
      scannedValue: String(lastRead?.scannedValue || item.ean || item.code || '').trim(),
      initialQty: Math.max(1, Number(lastRead?.qty) || 1),
      initialPackagingId: lastRead?.packagingId || null,
      item: {
        id: item.id,
        code: item.code,
        description: item.description,
        ean: item.ean,
        dun: item.dun,
        packagingOptions: item.packagingOptions,
        lastMeta: item.lastMeta,
      },
      editMode: 'last_read',
    });
  }, [navigation]);

  // Scan de item já completo: oferece desfazer ou corrigir a última leitura.
  const handleItemAlreadyFull = useCallback((item) => {
    HapticFeedback.trigger('notificationWarning', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });
    Alert.alert(
      'Item já atingiu a contagem',
      `${item.code}${item.ean ? ` / ${item.ean}` : ''}\n${item.description}\n\nEste item já atingiu a quantidade prevista. Deseja desfazer a última leitura ou corrigi-la?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Desfazer última', onPress: () => undoLastRead(item.id) },
        { text: 'Corrigir última', onPress: () => openEditItem(item) },
      ],
    );
  }, [undoLastRead, openEditItem]);

  const handleItemLongPress = useCallback((item) => {
    const canUndo = (item.checkedQty || 0) > 0;
    Alert.alert(
      'Ajustar leitura',
      `${item.code}${item.ean ? ` / ${item.ean}` : ''}\n${item.description}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        canUndo ? { text: 'Desfazer última', onPress: () => undoLastRead(item.id) } : null,
        canUndo ? { text: 'Zerar leituras', style: 'destructive', onPress: () => updateItemReadCount(item.id, 0) } : null,
      ].filter(Boolean),
    );
  }, [updateItemReadCount, undoLastRead]);

  const handleItemEdit = useCallback((item) => {
    openEditItem(item);
  }, [openEditItem]);

  const handleItemClear = useCallback((item) => {
    if (!item?.id || Number(item.checkedQty || 0) <= 0) return;
    Alert.alert(
      'Limpar item conferido',
      `Remover todas as leituras de ${item.description}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Limpar', style: 'destructive', onPress: () => clearItemReads(item.id) },
      ],
    );
  }, [clearItemReads]);

  const handleCodeSubmit = useCallback(() => {
    const code = manualCode.trim();
    if (!code) return;
    setManualCode('');
    beginScanFlow(code, 1);
    setTimeout(() => codeInputRef.current?.focus?.(), 120);
  }, [manualCode, beginScanFlow]);

  const persistConference = useCallback(async () => {
    if (!started || items.length === 0) return;
    const nowTotals = computeTotals(items);
    const payload = {
      id: `saida-${Date.now()}`,
      type: 'saida',
      createdAt: new Date().toISOString(),
      orderCode: orderCode.trim(),
      separador: separador.trim(),
      embalador: embalador.trim(),
      remote_queue_id: activeRemoteQueueId || null,
      sync_status: 'local_only',
      pending_remote_sync: false,
      items,
      totals: nowTotals,
      timeline: [
        buildConferenceEvent({
          type: 'conference_finished',
          actor: embalador.trim() || separador.trim(),
          payload: { orderCode: orderCode.trim(), divergences: nowTotals.divergences, items: items.length },
        }),
      ],
    };
    try {
      const divergences = items
        .filter((i) => i.checkedQty !== i.expectedQty)
        .map((i) => ({
          id: `div-sai-${payload.id}-${i.id}`,
          source: 'saida',
          status: 'pendente',
          createdAt: payload.createdAt,
          orderCode: payload.orderCode,
          code: i.code,
          description: i.description,
          expectedQty: i.expectedQty,
          checkedQty: i.checkedQty,
          diff: i.checkedQty - i.expectedQty,
          sync_status: 'local_only',
          reads: i.reads || [],
          lastMeta: i.lastMeta || null,
        }));
      await finalizeConferenciaSaida(payload, divergences);
      if (activeRemoteQueueId) {
        // Sobe o resultado completo (esperado x conferido) para o admin ver no painel.
        const remoteFinished = await finishRemoteConferenciaSaidaBonus(activeRemoteQueueId, buildConferenceResultSummary(items));
        if (!remoteFinished) {
          // Finalizado localmente; o backstop local impede reabrir até o remoto sincronizar.
          console.warn('[conferencia] Finish remoto da saída falhou; mantido local até reconciliar.');
        }
        await loadRemoteQueue();
      }
      await removeByKey(payload.orderCode);
      // Atualiza o backstop local na hora (pedido recém-finalizado não reaparece).
      loadFinalizedSaidas();
      Alert.alert('Conferência finalizada', `Pendentes: ${nowTotals.pendingItems}. Divergências: ${nowTotals.divergences}.`);
      setStarted(false);
      setItems([]);
      setLastScanned('');
      setActiveRemoteQueueId(null);
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar a conferência.');
    }
  }, [started, items, orderCode, separador, embalador, activeRemoteQueueId, removeByKey, loadRemoteQueue, loadFinalizedSaidas]);

  const saveConference = useCallback(() => {
    const nowTotals = computeTotals(items);
    if (nowTotals.divergences > 0) {
      const label = pluralize(nowTotals.divergences, 'item', 'itens');
      const divergent = items.filter((i) => Number(i.checkedQty || 0) !== Number(i.expectedQty || 0));
      const detail = divergent.slice(0, 6).map((it) => {
        const diff = Number(it.checkedQty || 0) - Number(it.expectedQty || 0);
        const sign = diff > 0 ? `+${diff}` : `${diff}`;
        const desc = String(it.description || '').slice(0, 26);
        return `• ${it.code} ${desc} (${it.checkedQty}/${it.expectedQty}, ${sign})`;
      }).join('\n');
      const more = divergent.length > 6 ? `\n… e mais ${divergent.length - 6}.` : '';
      Alert.alert(
        'Fechar com divergência?',
        `${nowTotals.divergences} ${label} com divergência:\n${detail}${more}\n\nFinalizar assim?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Finalizar', style: 'destructive', onPress: persistConference },
        ],
      );
      return;
    }
    persistConference();
  }, [items, persistConference]);

  // ── Voltar dentro do pedido retorna à fila (não sai do módulo) ──
  const exitToQueue = useCallback(() => {
    if (orderCode.trim()) {
      upsertDraftImmediate({
        orderCode: orderCode.trim(),
        separador: separador.trim(),
        embalador: embalador.trim(),
        remoteQueueId: activeRemoteQueueId || null,
        items,
        updatedAt: new Date().toISOString(),
      });
    }
    setStarted(false);
    setItems([]);
    setLastScanned('');
    setActiveRemoteQueueId(null);
  }, [orderCode, separador, embalador, activeRemoteQueueId, items, upsertDraftImmediate]);

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (!started) return;   // na fila: deixa sair normalmente para os módulos
      e.preventDefault();     // no pedido ativo: não desmonta a tela…
      exitToQueue();          // …apenas volta para a fila
    });
    return unsub;
  }, [navigation, started, exitToQueue]);

  useEffect(() => {
    if (!started || !orderCode.trim()) return;
    upsertDraftDebounced({
      orderCode: orderCode.trim(),
      separador: separador.trim(),
      embalador: embalador.trim(),
      remoteQueueId: activeRemoteQueueId || null,
      items,
      updatedAt: new Date().toISOString(),
    });
  }, [started, orderCode, separador, embalador, items, activeRemoteQueueId, upsertDraftDebounced]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Fila view (não iniciado) ──────────────────────────────────────────────
  if (!started) {
    const queueHeader = (
      <View style={styles.searchCard}>
        <View style={styles.sectionTopRow}>
          <View style={[styles.sectionIconWrap, { backgroundColor: colors.primary }]}>
            <MaterialIcons name="local-shipping" size={18} color="#ffffff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Fila de saída</Text>
            <Text style={styles.cardSubtitle}>
              {queueCounts.open === 0
                ? 'Nenhum pedido para conferir'
                : `${queueCounts.open} ${queueCounts.open === 1 ? 'pedido' : 'pedidos'} para conferir`}
            </Text>
          </View>
        </View>
        <View style={styles.searchShell}>
          <MaterialIcons name="qr-code-scanner" size={20} color={colors.primary} />
          <TextInput
            ref={orderScanRef}
            style={styles.searchInput}
            placeholder="Bipe ou digite o pedido"
            placeholderTextColor={colors.textMuted}
            value={orderScan}
            onChangeText={setOrderScan}
            onSubmitEditing={handleOrderScanSubmit}
            returnKeyType="go"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable style={styles.searchScanBtn} onPress={openOrderScanner} accessibilityLabel="Abrir câmera para bipar pedido">
            <MaterialIcons name="photo-camera" size={18} color="#ffffff" />
          </Pressable>
        </View>
      </View>
    );

    return (
      <ScreenLayout isDarkMode={isDarkMode} lightBackground={colors.background} darkBackground={colors.background} contentStyle={styles.content}>
        <FlatList
          data={sortedQueue}
          keyExtractor={(item) => String(item.id)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          ListHeaderComponent={queueHeader}
          renderItem={({ item }) => (
            <ConferenciaBonusCard
              item={{ ...item, invoice: item.orderCode, supplierName: item.customerName || 'Pedido de saída', supplierCode: item.customerCode }}
              colors={colors}
              codeLabel="Pedido"
              status={resolveCardStatus(item)}
              onPress={() => handleQueueCardPress(item)}
            />
          )}
          ListEmptyComponent={
            queueLoading ? (
              <View style={[styles.card, styles.queueLoadingCard]}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.emptyText, { marginTop: 10 }]}>Carregando fila…</Text>
              </View>
            ) : (
              <View style={styles.card}>
                <Text style={styles.emptyText}>Nenhum pedido de saída na fila. O painel monta os bônus para conferir.</Text>
              </View>
            )
          }
        />
        {openingQueueId ? (
          <View style={styles.openingOverlay} pointerEvents="auto">
            <View style={styles.openingCard}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.openingText}>Abrindo pedido…</Text>
            </View>
          </View>
        ) : null}

        {/* ── Modal: conferência finalizada ── */}
        <Modal
          visible={!!finalizedInfo}
          transparent
          animationType="fade"
          onRequestClose={() => setFinalizedInfo(null)}
        >
          <Pressable style={styles.finBackdrop} onPress={() => setFinalizedInfo(null)}>
            <Animatable.View animation="zoomIn" duration={220} easing="ease-out" useNativeDriver style={styles.finAnim}>
              <Pressable style={styles.finCard} onPress={() => {}}>
                <View style={styles.finIconWrap}>
                  <MaterialIcons name="check-circle" size={30} color={colors.doneAccent} />
                </View>
                <Text style={styles.finTitle}>Conferência finalizada</Text>
                <View style={styles.finNfChip}>
                  <MaterialIcons name="local-shipping" size={13} color={colors.primary} />
                  <Text style={styles.finNfChipText}>Pedido {finalizedInfo?.orderCode}</Text>
                </View>
                {finalizedInfo?.customerName ? (
                  <Text style={styles.finSupplier} numberOfLines={2}>{finalizedInfo.customerName}</Text>
                ) : null}
                {finalizedInfo?.conferente ? (
                  <View style={styles.finMetaRow}>
                    <MaterialIcons name="person" size={14} color={colors.textMuted} />
                    <Text style={styles.finMetaText}>Finalizada por {finalizedInfo.conferente}</Text>
                  </View>
                ) : null}
                <Text style={styles.finBody}>
                  Esse pedido já foi conferido. Consulte o painel/divergências para os detalhes.
                </Text>
                <Pressable style={styles.finButton} onPress={() => setFinalizedInfo(null)} accessibilityRole="button" accessibilityLabel="Entendi">
                  <Text style={styles.finButtonText}>Entendi</Text>
                </Pressable>
              </Pressable>
            </Animatable.View>
          </Pressable>
        </Modal>
      </ScreenLayout>
    );
  }

  // ─── Active conference view ────────────────────────────────────────────────
  const renderBlindRow = (row, index, arr) => (
    <ConferenciaItemRow
      key={row.id}
      row={row}
      colors={colors}
      lastScanned={lastScanned}
      lastScannedAt={lastScannedAt}
      isLast={index === arr.length - 1}
      blind
      onLongPress={handleItemLongPress}
      onEdit={handleItemEdit}
      onClear={handleItemClear}
      doneColor={colors.success}
    />
  );

  const renderTabPage = (pageItems, emptyIcon, emptyText) => (
    <ScrollView
      style={styles.tabScroll}
      contentContainerStyle={styles.tabListContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.card}>
        {pageItems.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name={emptyIcon} size={30} color={colors.textMuted} />
            <Text style={[styles.emptyText, { marginTop: 8, textAlign: 'center' }]}>{emptyText}</Text>
          </View>
        ) : (
          pageItems.map((row, index) => renderBlindRow(row, index, pageItems))
        )}
      </View>
    </ScrollView>
  );

  return (
    <ScreenLayout isDarkMode={isDarkMode} lightBackground={colors.background} darkBackground={colors.background} contentStyle={styles.content}>
     <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Pedido já está no header; contagem nas abas. Sem barra redundante. */}
      <ScanInputRow
        codeInputRef={codeInputRef}
        manualCode={manualCode}
        setManualCode={setManualCode}
        onSubmit={handleCodeSubmit}
        onOpenScanner={openScanner}
        colors={colors}
        styles={styles}
        lastScanned={lastScanned}
      />

      {/* Abas A conferir / Conferido */}
      <View style={styles.tabBar}>
        <TabButton label="A conferir" count={notCountedItems.length} active={tab === 0} onPress={() => goToTab(0)} colors={colors} styles={styles} />
        <TabButton label="Conferido" count={countedItems.length} active={tab === 1} onPress={() => goToTab(1)} colors={colors} styles={styles} />
      </View>

      {/* Pager com swipe */}
      <View
        style={styles.pagerWrap}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setPagerSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
        }}
      >
        {pagerSize.width > 0 && pagerSize.height > 0 ? (
          <FlatList
            ref={pagerRef}
            style={styles.flex}
            data={[0, 1]}
            keyExtractor={(p) => String(p)}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            getItemLayout={(_, index) => ({ length: pagerSize.width, offset: pagerSize.width * index, index })}
            onMomentumScrollEnd={(e) => {
              const i = Math.round(e.nativeEvent.contentOffset.x / pagerSize.width);
              if (i !== tab) setTab(i);
            }}
            renderItem={({ item: page }) => (
              <View style={{ width: pagerSize.width, height: pagerSize.height }}>
                {page === 0
                  ? renderTabPage(
                      notCountedItems,
                      'inventory',
                      items.length === 0 ? 'Sem itens neste pedido.' : 'Tudo já foi contado ao menos uma vez. Veja a aba Conferido.',
                    )
                  : renderTabPage(
                      countedItems,
                      'qr-code-scanner',
                      'Nenhum item contado ainda. Bipe um código para começar.',
                    )}
              </View>
            )}
          />
        ) : (
          renderTabPage(
            tab === 0 ? notCountedItems : countedItems,
            tab === 0 ? 'inventory' : 'qr-code-scanner',
            tab === 0
              ? (items.length === 0 ? 'Sem itens neste pedido.' : 'Tudo já foi contado ao menos uma vez. Veja a aba Conferido.')
              : 'Nenhum item contado ainda. Bipe um código para começar.',
          )
        )}
      </View>

      {countedItems.length > 0 ? (
        <Pressable style={styles.finishButton} onPress={saveConference}>
          <MaterialIcons name="check-circle" size={20} color="#ffffff" />
          <Text style={styles.finishButtonText}>Finalizar conferência</Text>
        </Pressable>
      ) : null}
     </KeyboardAvoidingView>
    </ScreenLayout>
  );
};

const getStyles = (colors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    content: { flex: 1, paddingHorizontal: 16, paddingTop: 10 },
    scrollContent: { paddingBottom: 32 },

    // ── Abas + pager (conferência cega) ──
    tabBar: {
      flexDirection: 'row',
      gap: 6,
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 4,
      marginBottom: 8,
    },
    tabButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 9,
      borderRadius: 10,
    },
    tabButtonActive: { backgroundColor: colors.primary + '14' },
    tabButtonText: { fontSize: 13, fontWeight: '900' },
    tabBadge: {
      minWidth: 22,
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabBadgeText: { fontSize: 11, fontWeight: '900' },
    pagerWrap: { flex: 1 },
    tabScroll: { flex: 1 },
    tabListContent: { paddingBottom: 12 },

    // ── Scan card ──
    scanCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 11,
      marginBottom: 10,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.07,
      shadowRadius: 14,
      elevation: 2,
    },
    scanCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    scanCardTitle: { color: colors.text, fontSize: 13.5, fontWeight: '900', flex: 1 },
    lastScannedBadge: { color: colors.textMuted, fontSize: 11, fontWeight: '700', maxWidth: 140 },
    codeInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    codeInput: { flex: 1, marginBottom: 0, paddingVertical: 10, fontSize: 14 },
    scanIconButton: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // ── Cards ──
    // Card da fila: mesmo visual do Recebimento (faixa de acento à esquerda).
    searchCard: {
      backgroundColor: colors.surface,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
      padding: 14,
      marginBottom: 14,
    },
    searchShell: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBg,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 4,
      minHeight: 46,
    },
    searchInput: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '700', paddingVertical: 0 },
    searchScanBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 14,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 18,
      elevation: 3,
    },
    sectionTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
    sectionIconWrap: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
    cardTitle: { fontSize: 17, fontWeight: '900', color: colors.text, marginBottom: 2 },
    cardSubtitle: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBg,
      color: colors.text,
      borderRadius: 14,
      paddingHorizontal: 13,
      paddingVertical: 10,
      marginBottom: 10,
      fontSize: 14,
      fontWeight: '700',
    },
    emptyText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
    emptyState: { alignItems: 'center', paddingVertical: 20 },
    queueLoadingCard: { alignItems: 'center', paddingVertical: 22 },
    openingOverlay: {
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(15,23,42,0.18)',
    },
    openingCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    openingText: { color: colors.text, fontSize: 13, fontWeight: '800' },
    finishButton: {
      borderRadius: 14,
      backgroundColor: colors.success,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      marginTop: 14,
    },
    finishButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '900' },

    // ── Modal: conferência finalizada ──
    finBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(15,23,42,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 28,
    },
    finAnim: { width: '100%', maxWidth: 360 },
    finCard: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: 24,
      paddingVertical: 22,
      paddingHorizontal: 22,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.16,
      shadowRadius: 22,
      elevation: 14,
    },
    finIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.successSoft,
      marginBottom: 12,
    },
    finTitle: { fontSize: 18, fontWeight: '900', color: colors.text, textAlign: 'center' },
    finNfChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: 10,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: colors.chipBg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    finNfChipText: { color: colors.primary, fontSize: 12.5, fontWeight: '900', letterSpacing: 0.3 },
    finSupplier: { marginTop: 8, fontSize: 13, fontWeight: '700', color: colors.textMuted, textAlign: 'center' },
    finMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
    finMetaText: { fontSize: 12.5, fontWeight: '700', color: colors.textMuted },
    finBody: { marginTop: 12, fontSize: 13, lineHeight: 19, color: colors.textMuted, textAlign: 'center' },
    finButton: {
      marginTop: 18,
      alignSelf: 'stretch',
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 13,
      alignItems: 'center',
    },
    finButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '900' },
  });

export default ConferenciaSaidaScreen;
