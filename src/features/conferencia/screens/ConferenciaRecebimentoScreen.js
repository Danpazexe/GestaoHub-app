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
  buildConferenceEvent,
  computeTotals,
  normalizeKey,
  pluralize,
} from '../services/conferenciaCore';
import { buildExpectedItemsEntrada } from '../mocks/conferenciaMock';
import { useConferenciaRecebimentoDrafts } from '../hooks/useConferenciaRecebimentoDrafts';
import { buildBonusRecebimentoList } from '../mocks/conferenciaBonusMock';
import { conferenciaRecebimentoTheme } from '../../../theme/domains/conferencia';

// ─── Highlight duration for scanned item (ms) ────────────────────────────────
const HIGHLIGHT_DURATION = 2200;

// ─── Compact summary bar shown during active conference ───────────────────────
const CompactSummaryBar = ({ invoice, supplier, pendingCount, doneCount, divergenceCount, colors, styles }) => (
  <View style={styles.compactBar}>
    <View style={styles.compactBarLeft}>
      <Text style={styles.compactInvoice} numberOfLines={1}>{invoice}</Text>
      <Text style={styles.compactSupplier} numberOfLines={1}>{supplier}</Text>
    </View>
    <View style={styles.compactPills}>
      <View style={[styles.miniPill, { backgroundColor: colors.goldSoft, borderColor: 'rgba(245,158,11,0.22)' }]}>
        <Text style={[styles.miniPillText, { color: colors.warm }]}>{pendingCount}</Text>
        <MaterialIcons name="schedule" size={11} color={colors.warm} />
      </View>
      <View style={[styles.miniPill, { backgroundColor: colors.successSoft, borderColor: 'rgba(16,185,129,0.22)' }]}>
        <Text style={[styles.miniPillText, { color: colors.success }]}>{doneCount}</Text>
        <MaterialIcons name="check-circle-outline" size={11} color={colors.success} />
      </View>
      {divergenceCount > 0 && (
        <View style={[styles.miniPill, { backgroundColor: colors.dangerSoft, borderColor: 'rgba(220,38,38,0.22)' }]}>
          <Text style={[styles.miniPillText, { color: colors.danger }]}>{divergenceCount}</Text>
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
          title: supplier.trim() ? supplier.trim() : 'Recebimento',
          subtitle: started && (invoice.trim() || supplier.trim())
            ? `NF ${invoice.trim() || '-'} • ${supplier.trim() || '-'}`
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

    const unsub = navigation.addListener('focus', () => {
      loadDrafts();
      listConferenciaRecebimentos()
        .then((list) => setFinalizedReceipts(Array.isArray(list) ? list : []))
        .catch(() => setFinalizedReceipts([]));
    });
    return unsub;
  }, [navigation, loadDrafts]);

  // ── Bonus list ──
  const bonusesAll = useMemo(() => buildBonusRecebimentoList(), []);
  const bonusesFiltered = useMemo(() => {
    const q = String(bonusQuery || '').trim().toLowerCase();
    if (!q) return bonusesAll;
    return bonusesAll.filter((b) =>
      `${b.invoice} ${b.supplierName} ${b.supplierCode}`.toLowerCase().includes(q),
    );
  }, [bonusesAll, bonusQuery]);

  const queueSummary = useMemo(() => ({
    totalBonuses: bonusesFiltered.length,
    totalItems: bonusesFiltered.reduce((s, b) => s + (Number(b.lines) || 0), 0),
    drafts: drafts.length,
  }), [bonusesFiltered, drafts.length]);
  const draftStatusByInvoice = useMemo(() => {
    const map = new Map();

    drafts.forEach((draft) => {
      const key = normalizeInvoice(draft?.invoice || '');
      if (!key) return;
      map.set(key, 'em_conferencia');
    });

    return map;
  }, [drafts, normalizeInvoice]);
  const finalizedStatusByInvoice = useMemo(() => {
    const map = new Map();

    finalizedReceipts.forEach((record) => {
      const key = normalizeInvoice(record?.invoice || '');
      if (!key) return;
      map.set(key, 'finalizada');
    });

    return map;
  }, [finalizedReceipts, normalizeInvoice]);

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
    const expectedItems = await buildExpectedItemsEntrada(invoiceValue, 16);
    setItems(expectedItems);
    setStarted(true);
  }, [supplier, invoice, findByKey, normalizeInvoice]);

  const resumeDraft = useCallback((draft) => {
    setSupplier(draft.supplier || '');
    setInvoice(draft.invoice || '');
    setConferente(draft.conferente || '');
    setItems(Array.isArray(draft.items) ? draft.items : []);
    setStarted(true);
  }, []);

  const handleQueueCardPress = useCallback((item) => {
    const key = normalizeInvoice(item?.invoice || '');
    const finalizedStatus = finalizedStatusByInvoice.get(key);

    if (finalizedStatus === 'finalizada') {
      Alert.alert(
        'Conferência finalizada',
        `A NF ${item?.invoice || '-'} já foi finalizada no app e permanece na fila até remoção pelo painel.`,
      );
      return;
    }

    startConference({
      supplierOverride: item?.supplierName,
      invoiceOverride: item?.invoice,
    });
  }, [finalizedStatusByInvoice, normalizeInvoice, startConference]);

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
    const nowIso = new Date().toISOString();
    const scannedValue = String(payload?.scannedValue || '').trim();
    const effectiveQty = Math.max(1, Number(payload?.effectiveQty) || 1);
    const qty = Math.max(1, Number(payload?.qty) || 1);
    const factor = Math.max(1, Number(payload?.factor) || 1);
    const packaging = payload?.packaging || null;
    const itemId = String(payload?.itemId || '');

    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const remaining = (Number(it.expectedQty) || 0) - (Number(it.checkedQty) || 0);
        if (remaining <= 0) { full = true; return it; }
        if (effectiveQty > remaining) { overflow = true; return it; }
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
        const nextReads = Array.isArray(it.reads) ? [...it.reads, meta].slice(-50) : [meta];
        return { ...it, checkedQty: (Number(it.checkedQty) || 0) + effectiveQty, lastMeta: meta, reads: nextReads };
      }),
    );

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
    // Re-focus input after scan payload is applied
    setTimeout(() => codeInputRef.current?.focus?.(), 80);
  }, []);

  const updateItemReadCount = useCallback((itemId, nextCount) => {
    const next = Math.max(0, Number(nextCount) || 0);
    setItems((prev) => prev.map((item) => item.id === itemId ? { ...item, checkedQty: next } : item));
  }, []);

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
      await removeByKey(payload.invoice);
      Alert.alert('Conferência finalizada', `Pendentes: ${nowTotals.pendingItems}. Divergências: ${nowTotals.divergences}.`);
      setStarted(false);
      setItems([]);
      setLastScanned('');
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar a conferência.');
    }
  }, [started, items, supplier, invoice, conferente, operatorName, buildTratativaPrefill, removeByKey]);

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
      items,
      updatedAt: new Date().toISOString(),
    });
  }, [started, invoice, supplier, conferente, items, upsertDraftDebounced]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER — not-started (queue view)
  // ─────────────────────────────────────────────────────────────────────────────
  if (!started) {
    const queueHeader = (
      <>
        {/* Queue search header */}
        <View style={styles.searchCard}>
          <View style={styles.sectionTopRow}>
            <View style={[styles.sectionIconWrap, { backgroundColor: colors.warm }]}>
              <MaterialIcons name="inventory-2" size={18} color="#ffffff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Fila disponível</Text>
              <Text style={styles.searchSubtitle}>Procure por NF, fornecedor ou código.</Text>
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
          data={bonusesFiltered}
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
                || 'nao_iniciado'}
              onPress={() => handleQueueCardPress(item)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.card}>
              <Text style={styles.emptyText}>Nenhum bônus encontrado.</Text>
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
    compactInvoice: { color: colors.text, fontSize: 14, fontWeight: '900', lineHeight: 18 },
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
    summaryMetricsRow: { marginTop: 12, flexDirection: 'row', gap: 10 },
    summaryMetricCard: {
      flex: 1,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors.surface2,
      borderWidth: 1,
      borderColor: colors.border,
    },
    summaryMetricLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
    summaryMetricValue: { marginTop: 4, color: colors.text, fontSize: 18, fontWeight: '900' },

    // ── Draft chips ──
    draftRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
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
      padding: 16,
      marginBottom: 14,
    },
    searchShell: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBg,
      borderRadius: 16,
      paddingHorizontal: 14,
      minHeight: 50,
    },
    searchInput: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '700' },
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
