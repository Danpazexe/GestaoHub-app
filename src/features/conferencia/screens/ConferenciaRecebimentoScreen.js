import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import HapticFeedback from 'react-native-haptic-feedback';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import ScreenLayout, {
  createHeaderActionsTemplate,
  createHeaderTitleTemplate,
  createScreenHeaderTemplate,
} from '../../../components/ScreenLayout';
import { readStoredUserSummary } from '../../../services/userSessionStorageService';
import ConferenciaBonusCard from '../components/ConferenciaBonusCard';
import ConferenciaItemRow from '../components/ConferenciaItemRow';
import {
  finalizeConferenciaRecebimento,
  listConferenciaRecebimentos,
} from '../services/conferenciaRecordsService';
import {
  buildConferenceResultSummary,
  finishRemoteConferenciaBonus,
  listRemoteConferenciaBonusQueue,
  loadRemoteConferenciaBonusItems,
  syncRemoteConferenciaBonusProgress,
} from '../services/conferenciaBonusQueueService';
import {
  buildConferenceEvent,
  computeTotals,
  normalizeKey,
  pluralize,
} from '../services/conferenciaCore';
import { useConferenciaRecebimentoDrafts } from '../hooks/useConferenciaRecebimentoDrafts';
import { hasConferenceCatalog } from '../services/conferenciaCatalogService';
import { conferenciaRecebimentoTheme } from '../../../theme/domains/conferencia';

// ─── Highlight duration for scanned item (ms) ────────────────────────────────
const HIGHLIGHT_DURATION = 2200;

// Status "terminais": bônus que já encerrou o ciclo (conferido / entrada dada)
// não aparece para o conferente — fica só no painel do admin.
const TERMINAL_BONUS_STATUSES = ['finalizada', 'entrada_realizada'];
const isTerminalBonusStatus = (status) => TERMINAL_BONUS_STATUSES.includes(status);
const HEADER_SUPPLIER_MAX = 34;
const truncateText = (value, max = HEADER_SUPPLIER_MAX) => {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

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

// ─── Animated scan input row ──────────────────────────────────────────────────
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

// ─── Section divider with label ───────────────────────────────────────────────
const SectionDivider = ({ label, count, accent, colors, styles }) => (
  <View style={[styles.sectionDivider, { borderLeftColor: accent }]}>
    <Text style={[styles.sectionDividerText, { color: accent }]}>{label}</Text>
    <View style={[styles.sectionDividerBadge, { backgroundColor: accent + '22' }]}>
      <Text style={[styles.sectionDividerCount, { color: accent }]}>{count}</Text>
    </View>
  </View>
);

// ─── Main screen ──────────────────────────────────────────────────────────────
const ConferenciaRecebimentoScreen = ({ navigation, route, isDarkMode }) => {
  const [supplier, setSupplier] = useState('');
  const [invoice, setInvoice] = useState('');
  const [conferente, setConferente] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [started, setStarted] = useState(false);
  const [items, setItems] = useState([]);
  const [lastScanned, setLastScanned] = useState('');
  const [lastScannedAt, setLastScannedAt] = useState(0);
  const [operatorName, setOperatorName] = useState('');
  const [finalizedReceipts, setFinalizedReceipts] = useState([]);
  const [bonusQuery, setBonusQuery] = useState('');
  const [catalogAvailable, setCatalogAvailable] = useState(false);
  const [remoteQueue, setRemoteQueue] = useState([]);
  const [activeRemoteQueueId, setActiveRemoteQueueId] = useState(null);
  const [queueLoading, setQueueLoading] = useState(false);
  const [openingQueueId, setOpeningQueueId] = useState(null);
  const [finalizedInfo, setFinalizedInfo] = useState(null);
  const [tab, setTab] = useState(0); // 0 = A conferir, 1 = Conferido
  // Largura/altura REAIS do pager (descontam padding + safe-area). Derivar de
  // windowWidth desalinharia o snap em landscape/notch.
  const [pagerSize, setPagerSize] = useState({ width: 0, height: 0 });
  const codeInputRef = useRef(null);
  const pagerRef = useRef(null);

  const goToTab = (index) => {
    setTab(index);
    pagerRef.current?.scrollToOffset({ offset: index * pagerSize.width, animated: true });
  };

  // Re-sincroniza o offset quando a largura muda (rotação/teclado) — senão a
  // viewport fica num offset que não corresponde mais a uma aba inteira.
  useEffect(() => {
    if (pagerSize.width > 0) {
      pagerRef.current?.scrollToOffset({ offset: tab * pagerSize.width, animated: false });
    }
  }, [pagerSize.width]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus recovery — re-focus input whenever screen comes to foreground during active conference
  useEffect(() => {
    if (!started) return;
    const unsub = navigation.addListener('focus', () => {
      setTimeout(() => codeInputRef.current?.focus?.(), 150);
    });
    return unsub;
  }, [navigation, started]);

  const colors = useMemo(() => {
    const base = conferenciaRecebimentoTheme;
    const dark = !!isDarkMode;
    return {
      primary: base.primary,
      secondary: base.secondary,
      accentText: base.text,
      background: dark ? '#1f2438' : base.background || '#f0fdfa',
      surface: dark ? '#262d47' : '#ffffff',
      surface2: dark ? '#2b3350' : '#f7f7f8',
      text: dark ? '#f3f5ff' : '#2f333a',
      textMuted: dark ? '#aab1cf' : 'rgba(64,68,76,0.78)',
      border: dark ? '#3a4265' : 'rgba(64,68,76,0.18)',
      divider: dark ? 'rgba(255,255,255,0.10)' : 'rgba(64,68,76,0.14)',
      inputBg: dark ? '#202846' : '#ffffff',
      chipBg: dark ? 'rgba(255,255,255,0.06)' : 'rgba(15,118,110,0.08)',
      onPrimary: '#ffffff',
      shadow: '#000000',
      success: '#059669',
      successSoft: dark ? 'rgba(16,185,129,0.16)' : 'rgba(16,185,129,0.12)',
      danger: '#dc2626',
      dangerSoft: dark ? 'rgba(220,38,38,0.16)' : 'rgba(220,38,38,0.10)',
      warning: '#f59e0b',
      warm: dark ? '#fb923c' : '#ea580c',
      berry: dark ? '#f472b6' : '#be185d',
      sky: dark ? '#38bdf8' : '#0369a1',
      goldSoft: dark ? 'rgba(251,191,36,0.18)' : 'rgba(245,158,11,0.14)',
      slateSoft: dark ? 'rgba(148,163,184,0.16)' : 'rgba(100,116,139,0.10)',
      // Pending section accent — warm orange
      pendingAccent: dark ? '#fb923c' : '#ea580c',
      // Done section accent — green
      doneAccent: dark ? '#34d399' : '#059669',
    };
  }, [isDarkMode]);

  const styles = useMemo(() => getStyles(colors), [colors]);
  const normalizeInvoice = normalizeKey;
  const {
    drafts,
    loadDrafts,
    upsertDraftDebounced,
    upsertDraftImmediate,
    removeByKey,
    findByKey,
  } = useConferenciaRecebimentoDrafts();

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
          title: started ? `NF ${invoice.trim() || '-'}` : 'Recebimento',
          subtitle: started
            ? truncateText(supplier.trim() || 'Fornecedor nao informado')
            : 'Bônus para conferir',
          iconName: 'inventory',
          tintColor: '#ffffff',
        }),
      // Botão "Atualizar" no header (estilo Produtos), só na fila (não-iniciado).
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
    // handleRefreshQueue é estável (useCallback) — referenciado por closure,
    // fora das deps de propósito (evita TDZ e re-render desnecessário).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, isDarkMode, colors.primary, started, invoice, supplier, queueLoading]);

  // ── Scanner return ──
  useEffect(() => {
    if (!route.params?.scannedCode || !started) return;
    const scanned = String(route.params.scannedCode).trim();
    navigation.setParams({ scannedCode: undefined, scannedQty: undefined });
    beginScanFlow(scanned, 1);
  }, [route.params?.scannedCode, started]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!route.params?.scanConfirm) return;
    const payload = route.params.scanConfirm;
    navigation.setParams({ scanConfirm: undefined });
    applyScanPayload(payload);
  }, [route.params?.scanConfirm, navigation]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadRemoteQueue = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setQueueLoading(true);
    try {
      const queue = await listRemoteConferenciaBonusQueue();
      setRemoteQueue(Array.isArray(queue) ? queue : []);
    } catch {
      setRemoteQueue([]);
    } finally {
      if (!silent) setQueueLoading(false);
    }
  }, []);

  const handleRefreshQueue = useCallback(() => {
    loadDrafts();
    loadRemoteQueue();
    listConferenciaRecebimentos()
      .then((list) => setFinalizedReceipts(Array.isArray(list) ? list : []))
      .catch(() => {});
  }, [loadDrafts, loadRemoteQueue]);

  // ── Operator load ──
  useEffect(() => {
    let active = true;
    readStoredUserSummary()
      .then((s) => { if (active) setOperatorName(s?.name || ''); })
      .catch(() => { if (active) setOperatorName(''); });
    return () => { active = false; };
  }, []);

  // ── Drafts ──
  useEffect(() => {
    loadDrafts();
    listConferenciaRecebimentos()
      .then((list) => setFinalizedReceipts(Array.isArray(list) ? list : []))
      .catch(() => setFinalizedReceipts([]));
    hasConferenceCatalog()
      .then(setCatalogAvailable)
      .catch(() => setCatalogAvailable(false));
    loadRemoteQueue();

    const unsub = navigation.addListener('focus', () => {
      loadDrafts();
      listConferenciaRecebimentos()
        .then((list) => setFinalizedReceipts(Array.isArray(list) ? list : []))
        .catch(() => setFinalizedReceipts([]));
      hasConferenceCatalog()
        .then(setCatalogAvailable)
        .catch(() => setCatalogAvailable(false));
      loadRemoteQueue({ silent: true });
    });
    return unsub;
  }, [navigation, loadDrafts, loadRemoteQueue]);

  const queueItems = useMemo(() => {
    const remoteByInvoice = new Map(
      remoteQueue.map((item) => [normalizeInvoice(item?.invoice || ''), item]),
    );

    const remoteQueueItems = remoteQueue.map((item) => ({
      ...item,
      source: 'remote',
    }));

    const draftsQueue = drafts
      .map((draft) => {
        const invoiceKey = normalizeInvoice(draft?.invoice || '');
        const remoteMatch = remoteByInvoice.get(invoiceKey);
        const remoteQueueId = draft?.remoteQueueId || remoteMatch?.id || null;
        const hasProgress = Array.isArray(draft?.items)
          ? draft.items.some((entry) => Number(entry?.checkedQty || 0) > 0)
          : false;

        if (!invoiceKey || !remoteQueueId) {
          return null;
        }

        return {
          id: `draft-${invoiceKey}`,
          remoteQueueId,
          supplierCode: '',
          supplierName: draft?.supplier || remoteMatch?.supplierName || 'Fornecedor nao informado',
          invoice: draft?.invoice || '',
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
      const key = normalizeInvoice(item?.invoice || '');
      if (!key) return;
      const existing = mergedMap.get(key);
      if (!existing) {
        mergedMap.set(key, item);
        return;
      }
      // Um bônus terminal no servidor (finalizado/entrada dada) vence qualquer
      // rascunho local stale (senão um rascunho antigo manteria o card aberto).
      if (isTerminalRemote(existing)) return;
      if (isTerminalRemote(item)) {
        mergedMap.set(key, item);
        return;
      }
      if (item.source === 'draft' && existing.source !== 'draft') {
        mergedMap.set(key, item);
      }
    });

    return [...mergedMap.values()].sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
    );
  }, [drafts, normalizeInvoice, remoteQueue]);

  const remoteLinkedDrafts = useMemo(
    () => drafts.filter((draft) => Boolean(draft?.remoteQueueId)),
    [drafts],
  );

  const queueFiltered = useMemo(() => {
    const q = String(bonusQuery || '').trim().toLowerCase();
    if (!q) return queueItems;
    return queueItems.filter((b) =>
      `${b.invoice} ${b.supplierName} ${b.supplierCode}`.toLowerCase().includes(q),
    );
  }, [queueItems, bonusQuery]);

  const queueSummary = useMemo(() => ({
    totalBonuses: queueFiltered.length,
    totalItems: queueFiltered.reduce((s, b) => s + (Number(b.lines) || 0), 0),
    drafts: queueFiltered.filter((item) => item.source === 'draft').length,
  }), [queueFiltered]);
  const draftStatusByInvoice = useMemo(() => {
    const map = new Map();

    drafts.forEach((draft) => {
      const key = normalizeInvoice(draft?.invoice || '');
      if (!key) return;
      const hasProgress = Array.isArray(draft?.items)
        ? draft.items.some((item) => Number(item?.checkedQty || 0) > 0)
        : false;
      map.set(key, hasProgress ? 'em_conferencia' : 'nao_iniciado');
    });

    return map;
  }, [drafts, normalizeInvoice]);

  useEffect(() => {
    const linkedDrafts = drafts.filter((draft) => draft?.remoteQueueId);
    if (!linkedDrafts.length) {
      return;
    }

    linkedDrafts.forEach((draft) => {
      const checkedItems = Array.isArray(draft?.items)
        ? draft.items.filter((item) => Number(item?.checkedQty || 0) > 0).length
        : 0;
      const checkedQty = Array.isArray(draft?.items)
        ? draft.items.reduce((sum, item) => sum + Number(item?.checkedQty || 0), 0)
        : 0;

      syncRemoteConferenciaBonusProgress(draft.remoteQueueId, {
        checkedItems,
        checkedQty,
      });
    });
  }, [drafts]);
  const finalizedStatusByInvoice = useMemo(() => {
    const map = new Map();

    finalizedReceipts.forEach((record) => {
      const key = normalizeInvoice(record?.invoice || '');
      if (!key) return;
      map.set(key, 'finalizada');
    });

    return map;
  }, [finalizedReceipts, normalizeInvoice]);

  // Status efetivo do card. Terminal (local OU remoto) vence o rascunho local —
  // um rascunho stale não pode mascarar um bônus já encerrado no servidor.
  const resolveCardStatus = useCallback((item) => {
    const key = normalizeInvoice(item?.invoice || '');
    if (finalizedStatusByInvoice.get(key) === 'finalizada') return 'finalizada';
    if (isTerminalBonusStatus(item?.status)) return item.status;
    return draftStatusByInvoice.get(key) || item?.status || 'nao_iniciado';
  }, [finalizedStatusByInvoice, draftStatusByInvoice, normalizeInvoice]);

  // Conferência CONCLUÍDA sai da lista do conferente — finalizados passam a
  // existir só para o admin no painel web (que pode reabrir). O operador vê
  // apenas bônus em aberto (em andamento primeiro, depois não iniciados).
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
    let finished = 0;
    queueFiltered.forEach((item) => {
      if (isTerminalBonusStatus(resolveCardStatus(item))) finished += 1;
      else open += 1;
    });
    return { total: queueFiltered.length, open, finished };
  }, [queueFiltered, resolveCardStatus]);

  const buildDraftPayload = useCallback((itemsValue = items) => ({
    invoice: invoice.trim(),
    supplier: supplier.trim(),
    conferente: conferente.trim(),
    remoteQueueId: activeRemoteQueueId || null,
    items: Array.isArray(itemsValue) ? itemsValue : [],
    updatedAt: new Date().toISOString(),
  }), [invoice, supplier, conferente, items, activeRemoteQueueId]);

  // ── Item lists ──
  // Conferência CEGA: as abas separam por "ainda não contei" (checkedQty===0)
  // vs "já contei" (checkedQty>0) — sem revelar a quantidade esperada.
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

  // Semântica de FECHAMENTO: todo item com checked != expected (item nunca
  // tocado conta como falta). Revelado só no aviso de finalizar / pós-fechamento.
  const divergentItems = useMemo(
    () => items.filter((i) => Number(i.checkedQty || 0) !== Number(i.expectedQty || 0)),
    [items],
  );

  // ── Actions ──
  const startConference = useCallback(async ({ supplierOverride, invoiceOverride } = {}) => {
    const supplierValue = String(supplierOverride ?? supplier).trim();
    const invoiceValue = String(invoiceOverride ?? invoice).trim();
    if (!supplierValue || !invoiceValue) {
      Alert.alert('Dados obrigatórios', 'Informe fornecedor e número da nota.');
      return;
    }
    try {
      const draft = await findByKey(normalizeInvoice(invoiceValue));
      if (draft) {
        setSupplier(draft.supplier || '');
        setInvoice(draft.invoice || '');
        setConferente(draft.conferente || '');
        setItems(Array.isArray(draft.items) ? draft.items : []);
        setStarted(true);
        return;
      }
    } catch { /* new conference */ }
    setSupplier(supplierValue);
    setInvoice(invoiceValue);
    Alert.alert(
      'Sem carga real da NF',
      catalogAvailable
        ? 'Para iniciar nova conferencia de recebimento, conecte uma fonte real dos itens da NF.'
        : 'Nao ha catalogo real carregado no app. Importe a base real e conecte a origem da NF.',
    );
  }, [supplier, invoice, findByKey, normalizeInvoice, catalogAvailable]);

  const resumeDraft = useCallback((draft) => {
    setActiveRemoteQueueId(draft?.remoteQueueId || null);
    setSupplier(draft.supplier || '');
    setInvoice(draft.invoice || '');
    setConferente(draft.conferente || '');
    setItems(Array.isArray(draft.items) ? draft.items : []);
    setStarted(true);
  }, []);

  const handleQueueCardPress = useCallback((item) => {
    const key = normalizeInvoice(item?.invoice || '');
    const finalizedStatus = finalizedStatusByInvoice.get(key);
    const draft = drafts.find((entry) => normalizeInvoice(entry?.invoice || '') === key);

    // Finalizado (local ou remoto) vem ANTES do rascunho: se o bônus já foi
    // finalizado no servidor, um rascunho local stale não deve reabri-lo vazio.
    const isFinalized = finalizedStatus === 'finalizada' || item?.status === 'finalizada';
    if (isFinalized) {
      setFinalizedInfo({
        invoice: item?.invoice || '-',
        supplier: item?.supplierName || '',
        conferente: item?.assignedUserName || '',
      });
      return;
    }

    if (draft) {
      const remoteMatch = remoteQueue.find((entry) => normalizeInvoice(entry?.invoice || '') === key);
      resumeDraft({
        ...draft,
        remoteQueueId: remoteMatch?.id || item?.remoteQueueId || null,
      });
      return;
    }

    if (item?.source === 'remote') {
      if (openingQueueId) return; // evita toque duplo enquanto carrega
      const openRemote = () => {
        setOpeningQueueId(item.id);
        loadRemoteConferenciaBonusItems(item.id)
          .then((remoteItems) => {
            if (!Array.isArray(remoteItems) || remoteItems.length === 0) {
              Alert.alert('NF sem itens', 'O XML foi importado, mas nao gerou itens para conferencia.');
              return;
            }

            setActiveRemoteQueueId(item.id);
            setSupplier(item?.supplierName || '');
            setInvoice(item?.invoice || '');
            setConferente(operatorName || '');
            setItems(remoteItems);
            setStarted(true);
            loadRemoteQueue({ silent: true });
          })
          .catch(() => {
            Alert.alert(
              'Erro ao carregar',
              'Não foi possível carregar os itens da NF importada.',
              [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Tentar de novo', onPress: openRemote },
              ],
            );
          })
          .finally(() => setOpeningQueueId(null));
      };
      openRemote();
      return;
    }

    if (finalizedStatus === 'finalizada') {
      Alert.alert(
        'Conferência finalizada',
        `A NF ${item?.invoice || '-'} ja foi finalizada no app.`,
      );
      return;
    }

    startConference({
      supplierOverride: item?.supplierName,
      invoiceOverride: item?.invoice,
    });
  }, [drafts, finalizedStatusByInvoice, normalizeInvoice, resumeDraft, startConference, operatorName, loadRemoteQueue, openingQueueId]);

  const openScanner = useCallback(() => {
    if (!started) {
      Alert.alert('Inicie primeiro', 'Inicie a conferência antes de bipar.');
      return;
    }
    navigation.navigate('BarcodeScannerScreen', {
      targetScreen: 'ConferenciaRecebimentoScreen',
      paramName: 'scannedCode',
    });
  }, [started, navigation]);

  const findItemForScan = useCallback((value) => {
    const key = String(value || '').trim();
    if (!key) return null;
    for (const it of items) {
      const opts = Array.isArray(it.packagingOptions) ? it.packagingOptions : [];
      const hit = opts.find((o) => (o?.ean && key === o.ean) || (o?.dun && key === o.dun));
      if (hit) return { item: it, opt: hit, matchType: 'pack' };
      if (key === it.code) return { item: it, opt: null, matchType: 'code' };
      if (it.ean && key === it.ean) return { item: it, opt: null, matchType: 'ean' };
      if (it.dun && key === it.dun) return { item: it, opt: null, matchType: 'dun' };
    }
    return null;
  }, [items]);

  const beginScanFlow = useCallback((value, qty = 1) => {
    const amount = Math.max(1, Number(qty) || 1);
    const match = findItemForScan(value);
    if (!match?.item) {
      HapticFeedback.trigger('notificationError', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });
      Alert.alert('Código fora da nota', `Código ${value} não pertence a esta conferência.`);
      return;
    }
    const remaining = (Number(match.item.expectedQty) || 0) - (Number(match.item.checkedQty) || 0);
    if (remaining <= 0) {
      handleItemAlreadyFull(match.item);
      return;
    }
    navigation.navigate('ConferenciaScanScreen', {
      context: 'recebimento',
      targetScreen: 'ConferenciaRecebimentoScreen',
      itemId: match.item.id,
      scannedValue: String(value || '').trim(),
      initialQty: amount,
      initialPackagingId: match.matchType === 'code' ? 'un' : (match.opt?.id || null),
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

  const applyScanPayload = useCallback((payload) => {
    let overflow = false;
    let full = false;
    let nextItemsSnapshot = null;
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
      nextItemsSnapshot = nextItems;
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
    if (started && invoice.trim() && nextItemsSnapshot) {
      upsertDraftImmediate(buildDraftPayload(nextItemsSnapshot));
    }
    if (activeRemoteQueueId && nextItemsSnapshot) {
      const checkedItems = nextItemsSnapshot.filter((item) => Number(item?.checkedQty || 0) > 0).length;
      const checkedQty = nextItemsSnapshot.reduce((sum, item) => sum + Number(item?.checkedQty || 0), 0);
      syncRemoteConferenciaBonusProgress(activeRemoteQueueId, {
        checkedItems,
        checkedQty,
      });
    }
    // Re-focus input after scan payload is applied
    setTimeout(() => codeInputRef.current?.focus?.(), 80);
  }, [activeRemoteQueueId, buildDraftPayload, invoice, started, upsertDraftImmediate]);

  const updateItemReadCount = useCallback((itemId, nextCount) => {
    const next = Math.max(0, Number(nextCount) || 0);
    setItems((prev) => {
      const nextItems = prev.map((item) => item.id === itemId ? { ...item, checkedQty: next } : item);
      if (started && invoice.trim()) {
        upsertDraftImmediate(buildDraftPayload(nextItems));
      }
      if (activeRemoteQueueId) {
        const checkedItems = nextItems.filter((item) => Number(item?.checkedQty || 0) > 0).length;
        const checkedQty = nextItems.reduce((sum, item) => sum + Number(item?.checkedQty || 0), 0);
        syncRemoteConferenciaBonusProgress(activeRemoteQueueId, {
          checkedItems,
          checkedQty,
        });
      }
      return nextItems;
    });
  }, [activeRemoteQueueId, buildDraftPayload, invoice, started, upsertDraftImmediate]);

  const clearItemReads = useCallback((itemId) => {
    setItems((prev) => {
      const nextItems = prev.map((item) => (
        item.id === itemId
          ? { ...item, checkedQty: 0, lastMeta: null, reads: [] }
          : item
      ));
      if (started && invoice.trim()) {
        upsertDraftImmediate(buildDraftPayload(nextItems));
      }
      if (activeRemoteQueueId) {
        const checkedItems = nextItems.filter((item) => Number(item?.checkedQty || 0) > 0).length;
        const checkedQty = nextItems.reduce((sum, item) => sum + Number(item?.checkedQty || 0), 0);
        syncRemoteConferenciaBonusProgress(activeRemoteQueueId, {
          checkedItems,
          checkedQty,
        });
      }
      return nextItems;
    });
  }, [activeRemoteQueueId, buildDraftPayload, invoice, started, upsertDraftImmediate]);

  // Desfaz a ÚLTIMA leitura do item: remove o read e subtrai exatamente o
  // effectiveQty dele (não um -1 cego), reapontando o lastMeta para o anterior.
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
        const nextLastMeta = reads.length > 0 ? reads[reads.length - 1] : null;
        return { ...it, checkedQty: nextChecked, reads, lastMeta: nextLastMeta };
      });
      if (started && invoice.trim()) {
        upsertDraftImmediate(buildDraftPayload(nextItems));
      }
      if (activeRemoteQueueId) {
        const checkedItems = nextItems.filter((item) => Number(item?.checkedQty || 0) > 0).length;
        const checkedQty = nextItems.reduce((sum, item) => sum + Number(item?.checkedQty || 0), 0);
        syncRemoteConferenciaBonusProgress(activeRemoteQueueId, { checkedItems, checkedQty });
      }
      return nextItems;
    });
  }, [activeRemoteQueueId, buildDraftPayload, invoice, started, upsertDraftImmediate]);

  // Ajuste rápido inline (+/-). Opera sobre reads para manter o invariante
  // checkedQty == soma(reads.effectiveQty) — do qual undoLastRead e a edição da
  // última leitura dependem: o '+' registra uma leitura manual de 1 unidade; o
  // '-' consome 1 unidade do fim (quebra uma leitura de embalagem em avulsa se
  // preciso). Clampa em [0, expectedQty] para não criar overflow por toque.
  const handleItemAdjust = useCallback((item, delta) => {
    if (!item?.id) return;
    const step = Number(delta || 0);
    const current = Number(item.checkedQty || 0);
    const expected = Number(item.expectedQty || 0);
    const willChange = (step > 0 && current < expected) || (step < 0 && current > 0);
    if (!willChange) {
      HapticFeedback.trigger('notificationWarning', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });
      return;
    }
    HapticFeedback.trigger('impactLight', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });

    setItems((prev) => {
      const nextItems = prev.map((it) => {
        if (it.id !== item.id) return it;
        let checked = Number(it.checkedQty || 0);
        let reads = Array.isArray(it.reads) ? [...it.reads] : [];

        if (step > 0) {
          if (checked >= Number(it.expectedQty || 0)) return it;
          reads.push({
            at: new Date().toISOString(),
            scannedValue: '',
            lote: '',
            validade: '',
            embalagem: '',
            packagingId: 'un',
            packagingLabel: 'UN',
            packagingFactor: 1,
            qty: 1,
            effectiveQty: 1,
            manual: true,
            ean: it.ean || '',
            dun: it.dun || '',
          });
          checked += 1;
        } else {
          if (checked <= 0) return it;
          checked -= 1;
          if (reads.length > 0) {
            const last = reads[reads.length - 1];
            const lastEff = Math.max(1, Number(last?.effectiveQty || 1));
            if (lastEff <= 1) {
              reads.pop();
            } else {
              reads[reads.length - 1] = {
                ...last,
                effectiveQty: lastEff - 1,
                qty: lastEff - 1,
                packagingId: 'un',
                packagingLabel: 'UN',
                packagingFactor: 1,
                manual: true,
              };
            }
          }
        }

        reads = reads.slice(-50);
        return { ...it, checkedQty: checked, reads, lastMeta: reads.length > 0 ? reads[reads.length - 1] : null };
      });

      if (started && invoice.trim()) {
        upsertDraftImmediate(buildDraftPayload(nextItems));
      }
      if (activeRemoteQueueId) {
        const checkedItems = nextItems.filter((i) => Number(i?.checkedQty || 0) > 0).length;
        const checkedQty = nextItems.reduce((s, i) => s + Number(i?.checkedQty || 0), 0);
        syncRemoteConferenciaBonusProgress(activeRemoteQueueId, { checkedItems, checkedQty });
      }
      return nextItems;
    });
  }, [activeRemoteQueueId, buildDraftPayload, invoice, started, upsertDraftImmediate]);

  const openEditItem = useCallback((item) => {
    if (!item?.id || Number(item.checkedQty || 0) <= 0) {
      return;
    }

    const lastRead = Array.isArray(item.reads) && item.reads.length > 0
      ? item.reads[item.reads.length - 1]
      : null;

    navigation.navigate('ConferenciaScanScreen', {
      context: 'recebimento',
      targetScreen: 'ConferenciaRecebimentoScreen',
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

  // Scan de item já completo: em vez de um beco sem saída, oferece desfazer a
  // última leitura ou corrigi-la — sem precisar zerar tudo.
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

  const buildTratativaPrefill = useCallback((item) => {
    const latestRead = Array.isArray(item.reads) && item.reads.length > 0
      ? item.reads[item.reads.length - 1] : null;
    const expectedQty = Number(item.expectedQty || 0);
    const checkedQty = Number(item.checkedQty || 0);
    const shortageQty = Math.max(expectedQty - checkedQty, 0);
    const overflowQty = Math.max(checkedQty - expectedQty, 0);
    return {
      supplier_code: '',
      origin_invoice_number: invoice.trim(),
      occurrence_type: shortageQty > 0 ? 'falta' : 'avaria',
      resolution_type: shortageQty > 0 ? 'tratativa' : 'devolucao',
      status: shortageQty > 0 ? 'ABERTA' : 'EM ANDAMENTO',
      opened_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
      expected_quantity: expectedQty,
      received_quantity: checkedQty,
      affected_quantity: shortageQty || overflowQty,
      reasons: shortageQty > 0
        ? ['Falta no recebimento', 'Divergencia de quantidade']
        : ['Mercadoria avariada no recebimento'],
      observation: [
        `Gerado a partir da conferencia de recebimento da NF ${invoice.trim() || '-'}.`,
        latestRead?.lote ? `Lote: ${latestRead.lote}.` : null,
        latestRead?.validade ? `Validade: ${latestRead.validade}.` : null,
      ].filter(Boolean).join(' '),
      product_snapshot: {
        codprod: item.code,
        codauxiliar: item.ean || '',
        descricao: item.description,
        fornecedor: supplier.trim(),
        quantidade_original: checkedQty,
        lote: latestRead?.lote || '',
        validade: latestRead?.validade || '',
        imageUrl: '',
        imagePath: '',
      },
    };
  }, [invoice, supplier]);

  const handleItemLongPress = useCallback((item) => {
    const canUndo = (item.checkedQty || 0) > 0;
    // "Abrir tratativa" fica sempre disponível (não gatilhamos por divergência,
    // que numa conferência cega revelaria que o item diverge).
    Alert.alert(
      'Ajustar leitura',
      `${item.code}${item.ean ? ` / ${item.ean}` : ''}\n${item.description}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        canUndo ? { text: 'Desfazer última', onPress: () => undoLastRead(item.id) } : null,
        canUndo ? { text: 'Zerar leituras', style: 'destructive', onPress: () => updateItemReadCount(item.id, 0) } : null,
        { text: 'Abrir tratativa', onPress: () => navigation.navigate('EspelhoRecebimentoScreen', { prefill: buildTratativaPrefill(item) }) },
      ].filter(Boolean),
    );
  }, [updateItemReadCount, undoLastRead, buildTratativaPrefill, navigation]);

  const handleItemEdit = useCallback((item) => {
    openEditItem(item);
  }, [openEditItem]);

  const handleItemClear = useCallback((item) => {
    if (!item?.id || Number(item.checkedQty || 0) <= 0) {
      return;
    }

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
    // Focus is recovered inside beginScanFlow → applyScanPayload path,
    // but handle direct no-match path too:
    setTimeout(() => codeInputRef.current?.focus?.(), 120);
  }, [manualCode, beginScanFlow]);

  const persistConference = useCallback(async () => {
    if (!started || items.length === 0) return;
    const nowTotals = computeTotals(items);
    const payload = {
      id: `rec-${Date.now()}`,
      type: 'recebimento',
      createdAt: new Date().toISOString(),
      supplier: supplier.trim(),
      invoice: invoice.trim(),
      conferente: conferente.trim() || operatorName,
      remote_queue_id: activeRemoteQueueId || null,
      source_type: activeRemoteQueueId ? 'remote_bonus' : 'local_only',
      sync_status: 'local_only',
      pending_remote_sync: false,
      items,
      totals: nowTotals,
      timeline: [
        buildConferenceEvent({
          type: 'conference_finished',
          actor: conferente.trim() || operatorName,
          payload: {
            invoice: invoice.trim(),
            supplier: supplier.trim(),
            divergences: nowTotals.divergences,
            items: items.length,
          },
          createdAt: new Date().toISOString(),
        }),
      ],
    };
    try {
      const divergences = items
        .filter((item) => item.checkedQty !== item.expectedQty)
        .map((item) => ({
          id: `div-rec-${payload.id}-${item.id}`,
          source: 'recebimento',
          status: 'pendente',
          createdAt: payload.createdAt,
          supplier: payload.supplier,
          invoice: payload.invoice,
          code: item.code,
          description: item.description,
          expectedQty: item.expectedQty,
          checkedQty: item.checkedQty,
          diff: item.checkedQty - item.expectedQty,
          sync_status: 'local_only',
          reads: item.reads || [],
          lastMeta: item.lastMeta || null,
          suggested_tratativa_prefill: buildTratativaPrefill(item),
        }));
      await finalizeConferenciaRecebimento(payload, divergences);
      if (activeRemoteQueueId) {
        // Sobe o resultado completo (esperado x conferido por item) para o admin
        // ver porcentagem, itens e divergências no painel.
        await finishRemoteConferenciaBonus(activeRemoteQueueId, buildConferenceResultSummary(items));
        await loadRemoteQueue();
      }
      await removeByKey(payload.invoice);
      Alert.alert('Conferência finalizada', `Pendentes: ${nowTotals.pendingItems}. Divergências: ${nowTotals.divergences}.`);
      setStarted(false);
      setItems([]);
      setLastScanned('');
      setActiveRemoteQueueId(null);
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar a conferência.');
    }
  }, [started, items, supplier, invoice, conferente, operatorName, buildTratativaPrefill, removeByKey, activeRemoteQueueId, loadRemoteQueue]);

  const saveConference = useCallback(() => {
    const nowTotals = computeTotals(items);
    if (nowTotals.divergences > 0) {
      const label = pluralize(nowTotals.divergences, 'item', 'itens');
      const detail = divergentItems.slice(0, 6).map((it) => {
        const diff = Number(it.checkedQty || 0) - Number(it.expectedQty || 0);
        const sign = diff > 0 ? `+${diff}` : `${diff}`;
        const desc = String(it.description || '').slice(0, 26);
        return `• ${it.code} ${desc} (${it.checkedQty}/${it.expectedQty}, ${sign})`;
      }).join('\n');
      const more = divergentItems.length > 6 ? `\n… e mais ${divergentItems.length - 6}.` : '';
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
  }, [items, divergentItems, persistConference]);

  // ── Voltar dentro do bônus retorna à fila (não sai do módulo) ──
  // O rascunho é persistido na hora para o card poder retomar de onde parou.
  const exitToQueue = useCallback(() => {
    if (invoice.trim()) {
      upsertDraftImmediate({
        invoice: invoice.trim(),
        supplier: supplier.trim(),
        conferente: conferente.trim(),
        remoteQueueId: activeRemoteQueueId || null,
        items,
        updatedAt: new Date().toISOString(),
      });
    }
    setStarted(false);
    setItems([]);
    setLastScanned('');
    setActiveRemoteQueueId(null);
  }, [invoice, supplier, conferente, activeRemoteQueueId, items, upsertDraftImmediate]);

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (!started) return;   // na fila: deixa sair normalmente para os módulos
      e.preventDefault();     // no bônus ativo: não desmonta a tela…
      exitToQueue();          // …apenas volta para a fila do painel
    });
    return unsub;
  }, [navigation, started, exitToQueue]);

  // ── Draft auto-save ──
  useEffect(() => {
    if (!started || !invoice.trim()) return;
    upsertDraftDebounced({
      invoice: invoice.trim(),
      supplier: supplier.trim(),
      conferente: conferente.trim(),
      remoteQueueId: activeRemoteQueueId || null,
      items,
      updatedAt: new Date().toISOString(),
    });
  }, [started, invoice, supplier, conferente, items, activeRemoteQueueId, upsertDraftDebounced]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER — not-started (queue view)
  // ─────────────────────────────────────────────────────────────────────────────
  if (!started) {
    const queueHeader = (
      <>
        <View style={styles.searchCard}>
          <View style={styles.sectionTopRow}>
            <View style={[styles.sectionIconWrap, { backgroundColor: colors.primary }]}>
              <MaterialIcons name="inventory-2" size={18} color="#ffffff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Fila do painel</Text>
              <Text style={styles.cardSubtitle}>
                {queueCounts.open === 0
                  ? 'Nenhum bônus para conferir'
                  : `${queueCounts.open} bônus para conferir`}
              </Text>
            </View>
          </View>
          <View style={styles.searchShell}>
            <MaterialIcons name="search" size={20} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por NF ou fornecedor"
              placeholderTextColor={colors.textMuted}
              value={bonusQuery}
              onChangeText={setBonusQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
          </View>
        </View>
      </>
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
              item={item}
              colors={colors}
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
                <Text style={styles.emptyText}>Nenhum bônus remoto disponível na fila.</Text>
              </View>
            )
          }
        />
        {openingQueueId ? (
          <View style={styles.openingOverlay} pointerEvents="auto">
            <View style={styles.openingCard}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.openingText}>Abrindo conferência…</Text>
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
                  <MaterialIcons name="inventory-2" size={13} color={colors.primary} />
                  <Text style={styles.finNfChipText}>NF {finalizedInfo?.invoice}</Text>
                </View>
                {finalizedInfo?.supplier ? (
                  <Text style={styles.finSupplier} numberOfLines={2}>{finalizedInfo.supplier}</Text>
                ) : null}
                {finalizedInfo?.conferente ? (
                  <View style={styles.finMetaRow}>
                    <MaterialIcons name="person" size={14} color={colors.textMuted} />
                    <Text style={styles.finMetaText}>Finalizada por {finalizedInfo.conferente}</Text>
                  </View>
                ) : null}
                <Text style={styles.finBody}>
                  As contagens não ficam armazenadas no bônus para reabrir. Consulte o histórico/divergências para os detalhes.
                </Text>
                <Pressable
                  style={styles.finButton}
                  onPress={() => setFinalizedInfo(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Entendi"
                >
                  <Text style={styles.finButtonText}>Entendi</Text>
                </Pressable>
              </Pressable>
            </Animatable.View>
          </Pressable>
        </Modal>
      </ScreenLayout>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER — active conference
  // ─────────────────────────────────────────────────────────────────────────────
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
      onAdjust={handleItemAdjust}
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
      {/* NF + fornecedor já estão no header; contagem nas abas. Sem barra de
          resumo redundante. */}
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

      {/* ── Abas A conferir / Conferido ── */}
      <View style={styles.tabBar}>
        <TabButton label="A conferir" count={notCountedItems.length} active={tab === 0} onPress={() => goToTab(0)} colors={colors} styles={styles} />
        <TabButton label="Conferido" count={countedItems.length} active={tab === 1} onPress={() => goToTab(1)} colors={colors} styles={styles} />
      </View>

      {/* ── Pager com swipe entre as abas ── */}
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
                      items.length === 0 ? 'Sem itens nesta conferência.' : 'Tudo já foi contado ao menos uma vez. Veja a aba Conferido.',
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
          // Fallback: se ainda não medimos, mostra a aba ativa direto (sem swipe)
          renderTabPage(
            tab === 0 ? notCountedItems : countedItems,
            tab === 0 ? 'inventory' : 'qr-code-scanner',
            tab === 0
              ? (items.length === 0 ? 'Sem itens nesta conferência.' : 'Tudo já foi contado ao menos uma vez. Veja a aba Conferido.')
              : 'Nenhum item contado ainda. Bipe um código para começar.',
          )
        )}
      </View>

      {countedItems.length > 0 ? (
        <Pressable style={styles.finishButton} onPress={saveConference}>
          <MaterialIcons name="check-circle" size={20} color="#fff" />
          <Text style={styles.finishButtonText}>Finalizar conferência</Text>
        </Pressable>
      ) : null}
     </KeyboardAvoidingView>
    </ScreenLayout>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const getStyles = (colors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    content: { flex: 1, paddingHorizontal: 16, paddingTop: 10 },
    scrollContent: { paddingBottom: 32 },

    // ── Compact bar ──
    compactBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 10,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.07,
      shadowRadius: 10,
      elevation: 2,
    },
    compactBarLeft: { flex: 1, marginRight: 10 },
    compactHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 1 },
    compactLabel: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    compactInvoice: { color: colors.text, fontSize: 16, fontWeight: '900', lineHeight: 19, flexShrink: 1 },
    compactSupplier: { color: colors.textMuted, fontSize: 12, fontWeight: '700', lineHeight: 16 },
    compactPills: { flexDirection: 'row', gap: 6, alignItems: 'center' },
    miniPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderWidth: 1,
    },
    miniPillText: { fontSize: 12, fontWeight: '900' },
    miniPillCaption: { fontSize: 10, fontWeight: '800' },

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
    scanCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    scanCardTitle: { color: colors.text, fontSize: 13.5, fontWeight: '900', flex: 1 },
    lastScannedBadge: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
      maxWidth: 140,
    },
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

    // ── Section divider ──
    sectionDivider: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderLeftWidth: 3,
      paddingLeft: 10,
      marginBottom: 12,
    },
    sectionDividerText: { fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
    sectionDividerBadge: {
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
      minWidth: 26,
      alignItems: 'center',
    },
    sectionDividerCount: { fontSize: 12, fontWeight: '900' },

    // ── Empty state ──
    emptyState: { alignItems: 'center', paddingVertical: 20 },

    // ── Cards / layout ──
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
    summaryCard: {
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
    summaryHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    summaryIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    summaryTitle: { color: colors.text, fontSize: 22, lineHeight: 28, fontWeight: '900' },
    summarySubtitle: { marginTop: 4, color: colors.textMuted, fontSize: 13, lineHeight: 19, fontWeight: '700' },
    statusRow: { marginTop: 12, flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderWidth: 1,
    },
    statusPillIdle: { backgroundColor: colors.slateSoft, borderColor: colors.border },
    statusPillPending: { backgroundColor: colors.goldSoft, borderColor: 'rgba(245,158,11,0.20)' },
    statusPillActive: { backgroundColor: 'rgba(14,165,233,0.10)', borderColor: 'rgba(14,165,233,0.18)' },
    statusPillText: { fontSize: 11, fontWeight: '900', color: colors.textMuted },
    // ── Draft chips ──
    draftRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 10 },
    draftChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.chipBg,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    draftChipText: { color: colors.text, fontSize: 12, fontWeight: '800' },

    // ── Misc ──
    cardTitle: { fontSize: 17, fontWeight: '900', color: colors.text, marginBottom: 2 },
    cardSubtitle: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
    clearDraftsBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.dangerSoft,
      backgroundColor: colors.dangerSoft,
    },
    clearDraftsText: { color: colors.danger, fontSize: 12, fontWeight: '800' },
    searchSubtitle: { color: colors.textMuted, fontSize: 12, lineHeight: 18, fontWeight: '700', marginBottom: 10 },
    sectionTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 4 },
    sectionIconWrap: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
    inputLabel: { fontSize: 11, fontWeight: '800', color: colors.textMuted, marginBottom: 5 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBg,
      color: colors.text,
      borderRadius: 14,
      paddingHorizontal: 13,
      paddingVertical: 12,
      marginBottom: 10,
      fontSize: 15,
      fontWeight: '700',
    },
    helperText: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 6 },
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
      minHeight: 42,
    },
    searchInput: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '700', paddingVertical: 0 },
    primaryButton: {
      borderRadius: 14,
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      marginTop: 4,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.14,
      shadowRadius: 16,
      elevation: 4,
    },
    primaryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '900' },
    emptyText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
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

    // ── Loading / opening (#8) ──
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
    tabButtonActive: {
      backgroundColor: colors.primary + '14',
    },
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
  });

export default ConferenciaRecebimentoScreen;
