import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import HapticFeedback from 'react-native-haptic-feedback';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import ScreenLayout, {
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
const HEADER_SUPPLIER_MAX = 34;
const truncateText = (value, max = HEADER_SUPPLIER_MAX) => {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

// ─── Compact summary bar shown during active conference ───────────────────────
const CompactSummaryBar = ({ invoice, supplier, pendingCount, doneCount, divergenceCount, colors, styles }) => (
  <View style={styles.compactBar}>
    <View style={styles.compactBarLeft}>
      <View style={styles.compactHeaderRow}>
        <Text style={styles.compactLabel}>NF</Text>
        <Text style={styles.compactInvoice} numberOfLines={1}>{invoice || '-'}</Text>
      </View>
      <Text style={styles.compactSupplier} numberOfLines={1}>{supplier}</Text>
    </View>
    <View style={styles.compactPills}>
      <View style={[styles.miniPill, { backgroundColor: colors.goldSoft, borderColor: 'rgba(245,158,11,0.22)' }]}>
        <Text style={[styles.miniPillText, { color: colors.warm }]}>{pendingCount}</Text>
        <Text style={[styles.miniPillCaption, { color: colors.warm }]}>pend.</Text>
        <MaterialIcons name="schedule" size={11} color={colors.warm} />
      </View>
      <View style={[styles.miniPill, { backgroundColor: colors.successSoft, borderColor: 'rgba(16,185,129,0.22)' }]}>
        <Text style={[styles.miniPillText, { color: colors.success }]}>{doneCount}</Text>
        <Text style={[styles.miniPillCaption, { color: colors.success }]}>ok</Text>
        <MaterialIcons name="check-circle-outline" size={11} color={colors.success} />
      </View>
      {divergenceCount > 0 && (
        <View style={[styles.miniPill, { backgroundColor: colors.dangerSoft, borderColor: 'rgba(220,38,38,0.22)' }]}>
          <Text style={[styles.miniPillText, { color: colors.danger }]}>{divergenceCount}</Text>
          <Text style={[styles.miniPillCaption, { color: colors.danger }]}>div.</Text>
          <MaterialIcons name="error-outline" size={11} color={colors.danger} />
        </View>
      )}
    </View>
  </View>
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
        <View style={[styles.sectionIconWrap, styles.sectionIconScan]}>
          <MaterialIcons name="qr-code-scanner" size={16} color="#ffffff" />
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
  const codeInputRef = useRef(null);

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
    });
  }, [navigation, isDarkMode, colors.primary, started, invoice, supplier]);

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

  const loadRemoteQueue = useCallback(async () => {
    try {
      const queue = await listRemoteConferenciaBonusQueue();
      setRemoteQueue(Array.isArray(queue) ? queue : []);
    } catch {
      setRemoteQueue([]);
    }
  }, []);

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
      loadRemoteQueue();
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

    [...draftsQueue, ...remoteQueueItems].forEach((item) => {
      const key = normalizeInvoice(item?.invoice || '');
      if (!key) return;
      const existing = mergedMap.get(key);
      if (!existing || (item.source === 'draft' && existing.source !== 'draft')) {
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

  const buildDraftPayload = useCallback((itemsValue = items) => ({
    invoice: invoice.trim(),
    supplier: supplier.trim(),
    conferente: conferente.trim(),
    remoteQueueId: activeRemoteQueueId || null,
    items: Array.isArray(itemsValue) ? itemsValue : [],
    updatedAt: new Date().toISOString(),
  }), [invoice, supplier, conferente, items, activeRemoteQueueId]);

  // ── Item lists ──
  const itemsToCheck = useMemo(() => {
    const key = String(lastScanned || '').trim();
    return items
      .filter((i) => i.checkedQty < i.expectedQty)
      .slice()
      .sort((a, b) => {
        const aHit = key && (a.code === key || a.ean === key) ? 1 : 0;
        const bHit = key && (b.code === key || b.ean === key) ? 1 : 0;
        if (aHit !== bHit) return bHit - aHit;
        const aRead = a.checkedQty > 0 ? 1 : 0;
        const bRead = b.checkedQty > 0 ? 1 : 0;
        if (aRead !== bRead) return bRead - aRead;
        return String(a.description).localeCompare(String(b.description));
      });
  }, [items, lastScanned]);

  const itemsChecked = useMemo(
    () => items.filter((i) => i.checkedQty >= i.expectedQty),
    [items],
  );

  const divergenceCount = useMemo(
    () => items.filter((i) => Number(i.checkedQty || 0) !== Number(i.expectedQty || 0)).length,
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

    if (draft) {
      const remoteMatch = remoteQueue.find((entry) => normalizeInvoice(entry?.invoice || '') === key);
      resumeDraft({
        ...draft,
        remoteQueueId: remoteMatch?.id || item?.remoteQueueId || null,
      });
      return;
    }

    if (item?.source === 'remote') {
      loadRemoteConferenciaBonusItems(item.id)
        .then(async (remoteItems) => {
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
          loadRemoteQueue();
        })
        .catch(() => {
          Alert.alert('Erro', 'Nao foi possivel carregar os itens da NF importada.');
        });
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
  }, [drafts, finalizedStatusByInvoice, normalizeInvoice, resumeDraft, startConference, operatorName, loadRemoteQueue]);

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
      Alert.alert('Item já completo', 'Quantidade desse item já foi totalmente conferida.');
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
    const hasDivergence = Number(item.checkedQty || 0) !== Number(item.expectedQty || 0);
    Alert.alert(
      'Ajustar leitura',
      `${item.code}${item.ean ? ` / ${item.ean}` : ''}\n${item.description}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        canUndo ? { text: 'Desfazer 1', onPress: () => updateItemReadCount(item.id, (item.checkedQty || 0) - 1) } : null,
        canUndo ? { text: 'Zerar leituras', style: 'destructive', onPress: () => updateItemReadCount(item.id, 0) } : null,
        hasDivergence ? { text: 'Abrir tratativa', onPress: () => navigation.navigate('EspelhoRecebimentoScreen', { prefill: buildTratativaPrefill(item) }) } : null,
      ].filter(Boolean),
    );
  }, [updateItemReadCount, buildTratativaPrefill, navigation]);

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
        await finishRemoteConferenciaBonus(activeRemoteQueueId);
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
      Alert.alert(
        'Fechar com divergência?',
        `Existem ${nowTotals.divergences} ${label} com divergência. Deseja realmente finalizar assim?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Finalizar', style: 'destructive', onPress: persistConference },
        ],
      );
      return;
    }
    persistConference();
  }, [items, persistConference]);

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
            <View style={[styles.sectionIconWrap, { backgroundColor: colors.warm }]}>
              <MaterialIcons name="inventory-2" size={18} color="#ffffff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Fila do painel</Text>
            </View>
          </View>
          {remoteLinkedDrafts.length > 0 && (
            <View style={styles.draftRow}>
              {remoteLinkedDrafts.slice(0, 3).map((draft) => (
                <Pressable
                  key={`${draft.remoteQueueId}-${draft.invoice}`}
                  style={styles.draftChip}
                  onPress={() => resumeDraft(draft)}
                >
                  <MaterialIcons name="restore" size={14} color={colors.primary} />
                  <Text style={styles.draftChipText}>{draft.invoice}</Text>
                </Pressable>
              ))}
            </View>
          )}
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
          data={queueFiltered}
          keyExtractor={(item) => String(item.id)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          ListHeaderComponent={queueHeader}
          renderItem={({ item }) => (
            <ConferenciaBonusCard
              item={item}
              colors={colors}
              status={finalizedStatusByInvoice.get(normalizeInvoice(item.invoice))
                || draftStatusByInvoice.get(normalizeInvoice(item.invoice))
                || item.status
                || 'nao_iniciado'}
              onPress={() => handleQueueCardPress(item)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.card}>
              <Text style={styles.emptyText}>Nenhum bônus remoto disponível na fila.</Text>
            </View>
          }
        />
      </ScreenLayout>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER — active conference
  // ─────────────────────────────────────────────────────────────────────────────
  const listData = ['scan', 'toCheck', 'checked'];

  return (
    <ScreenLayout isDarkMode={isDarkMode} lightBackground={colors.background} darkBackground={colors.background} contentStyle={styles.content}>
      {/* ── Compact sticky bar ── */}
      <CompactSummaryBar
        invoice={invoice}
        supplier={supplier}
        pendingCount={itemsToCheck.length}
        doneCount={itemsChecked.length}
        divergenceCount={divergenceCount}
        colors={colors}
        styles={styles}
      />

      <FlatList
        data={listData}
        keyExtractor={(k) => k}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          // ── Scan card ──
          if (item === 'scan') {
            return (
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
            );
          }

          // ── Pending items ──
          if (item === 'toCheck') {
            return (
              <View style={styles.card}>
                <SectionDivider
                  label="A conferir"
                  count={itemsToCheck.length}
                  accent={colors.pendingAccent}
                  colors={colors}
                  styles={styles}
                />
                {itemsToCheck.length === 0 ? (
                  <View style={styles.emptyState}>
                    <MaterialIcons name="check-circle" size={32} color={colors.success} />
                    <Text style={[styles.emptyText, { marginTop: 8 }]}>Todos os itens conferidos!</Text>
                  </View>
                ) : (
                  itemsToCheck.map((row) => (
                    <ConferenciaItemRow
                      key={row.id}
                      row={row}
                      colors={colors}
                      lastScanned={lastScanned}
                      lastScannedAt={lastScannedAt}
                      highlightDuration={HIGHLIGHT_DURATION}
                    onLongPress={handleItemLongPress}
                    onEdit={handleItemEdit}
                    onClear={handleItemClear}
                    doneColor={colors.success}
                    variant="pending"
                  />
                  ))
                )}
              </View>
            );
          }

          // ── Checked items ──
          return (
            <View style={styles.card}>
              <SectionDivider
                label="Conferidos"
                count={itemsChecked.length}
                accent={colors.doneAccent}
                colors={colors}
                styles={styles}
              />
              {itemsChecked.length === 0 ? (
                <Text style={styles.emptyText}>Nenhum item totalmente conferido ainda.</Text>
              ) : (
                itemsChecked.map((row) => (
                  <ConferenciaItemRow
                    key={row.id}
                    row={row}
                    colors={colors}
                    lastScanned={lastScanned}
                    lastScannedAt={lastScannedAt}
                    highlightDuration={HIGHLIGHT_DURATION}
                    onLongPress={handleItemLongPress}
                    onEdit={handleItemEdit}
                    onClear={handleItemClear}
                    doneColor={colors.success}
                    variant="done"
                  />
                ))
              )}

              {itemsChecked.length > 0 || itemsToCheck.length === 0 ? (
                <Pressable style={styles.finishButton} onPress={saveConference}>
                  <MaterialIcons name="check-circle" size={20} color="#fff" />
                  <Text style={styles.finishButtonText}>Finalizar conferência</Text>
                </Pressable>
              ) : null}
            </View>
          );
        }}
      />
    </ScreenLayout>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const getStyles = (colors) =>
  StyleSheet.create({
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
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 12,
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
      marginBottom: 10,
    },
    scanCardTitle: { color: colors.text, fontSize: 14, fontWeight: '900', flex: 1 },
    lastScannedBadge: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
      maxWidth: 140,
    },
    codeInputRow: { flexDirection: 'row', gap: 10 },
    codeInput: { flex: 1, marginBottom: 0 },
    scanIconButton: {
      width: 52,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.primary,
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
    cardTitle: { fontSize: 17, fontWeight: '900', color: colors.text, marginBottom: 8 },
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
      borderLeftColor: colors.warm,
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
  });

export default ConferenciaRecebimentoScreen;
