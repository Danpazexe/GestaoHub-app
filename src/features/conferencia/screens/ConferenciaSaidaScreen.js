import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import HapticFeedback from 'react-native-haptic-feedback';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import ScreenLayout, {
  createHeaderTitleTemplate,
  createScreenHeaderTemplate,
} from '../../../components/ScreenLayout';
import ConferenciaItemRow from '../components/ConferenciaItemRow';
import { finalizeConferenciaSaida } from '../services/conferenciaRecordsService';
import { readStoredUserName } from '../../../services/userSessionStorageService';
import {
  buildConferenceEvent,
  computeProgress,
  computeTotals,
  normalizeKey,
  pluralize,
} from '../services/conferenciaCore';
import { useConferenciaSaidaDrafts } from '../hooks/useConferenciaSaidaDrafts';
import { hasConferenceCatalog } from '../services/conferenciaCatalogService';
import { conferenciaSaidaTheme } from '../../../theme/domains/conferencia';

// ─── Compact summary bar (same pattern as Recebimento) ────────────────────────
const CompactSummaryBar = ({ orderCode, progress, pendingCount, doneCount, divergenceCount, colors, styles }) => (
  <View style={styles.compactBar}>
    <View style={styles.compactBarLeft}>
      <Text style={styles.compactInvoice} numberOfLines={1}>Pedido {orderCode}</Text>
      <View style={styles.progressTrackInline}>
        <View style={[styles.progressFillInline, { width: `${progress}%` }]} />
      </View>
    </View>
    <View style={styles.compactPills}>
      <View style={[styles.miniPill, { backgroundColor: colors.goldSoft, borderColor: 'rgba(245,158,11,0.22)' }]}>
        <Text style={[styles.miniPillText, { color: colors.warning }]}>{pendingCount}</Text>
        <MaterialIcons name="schedule" size={11} color={colors.warning} />
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

// ─── Section divider ──────────────────────────────────────────────────────────
const SectionDivider = ({ label, count, accent, styles }) => (
  <View style={[styles.sectionDivider, { borderLeftColor: accent }]}>
    <Text style={[styles.sectionDividerText, { color: accent }]}>{label}</Text>
    <View style={[styles.sectionDividerBadge, { backgroundColor: accent + '22' }]}>
      <Text style={[styles.sectionDividerCount, { color: accent }]}>{count}</Text>
    </View>
  </View>
);

// ─── Main screen ──────────────────────────────────────────────────────────────
const ConferenciaSaidaScreen = ({ navigation, route, isDarkMode }) => {
  const [orderCode, setOrderCode] = useState('');
  const [separador, setSeparador] = useState('');
  const [embalador, setEmbalador] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [manualQty, setManualQty] = useState('1');
  const [started, setStarted] = useState(false);
  const [items, setItems] = useState([]);
  const [lastScanned, setLastScanned] = useState('');
  const [lastScannedAt, setLastScannedAt] = useState(0);
  const [catalogAvailable, setCatalogAvailable] = useState(false);
  const codeInputRef = useRef(null);

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
      goldSoft: dark ? 'rgba(251,191,36,0.18)' : 'rgba(245,158,11,0.14)',
      pendingAccent: dark ? '#fb923c' : '#ea580c',
      doneAccent: dark ? '#34d399' : '#059669',
    };
  }, [isDarkMode]);

  const styles = useMemo(() => getStyles(colors), [colors]);
  const draftApi = useConferenciaSaidaDrafts();

  // Focus recovery on screen focus during active conference
  useEffect(() => {
    if (!started) return;
    const unsub = navigation.addListener('focus', () => {
      setTimeout(() => codeInputRef.current?.focus?.(), 150);
    });
    return unsub;
  }, [navigation, started]);

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
          subtitle: started ? 'Conferência cega em andamento' : 'Conferência cega por pedido',
          iconName: 'local-shipping',
          tintColor: '#ffffff',
        }),
    });
  }, [navigation, isDarkMode, colors.primary, started, orderCode]);

  useEffect(() => {
    const loadLoggedUser = async () => {
      try {
        const name = await readStoredUserName('');
        if (name) { setSeparador(name); setEmbalador(name); }
      } catch { /* ignore */ }
    };
    loadLoggedUser();
  }, []);

  useEffect(() => {
    if (!route.params?.scannedCode || !started) return;
    const scanned = String(route.params.scannedCode).trim();
    const qty = Math.max(1, Number(route.params.scannedQty) || 1);
    navigation.setParams({ scannedCode: undefined, scannedQty: undefined });
    beginScanFlow(scanned, qty);
  }, [route.params?.scannedCode, route.params?.scannedQty, started]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!route.params?.scanConfirm) return;
    const payload = route.params.scanConfirm;
    navigation.setParams({ scanConfirm: undefined });
    applyScanPayload(payload);
  }, [route.params?.scanConfirm, navigation]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    draftApi.loadDrafts();
    hasConferenceCatalog()
      .then(setCatalogAvailable)
      .catch(() => setCatalogAvailable(false));
    const unsub = navigation.addListener('focus', () => {
      draftApi.loadDrafts();
      hasConferenceCatalog()
        .then(setCatalogAvailable)
        .catch(() => setCatalogAvailable(false));
    });
    return unsub;
  }, [navigation, draftApi]); // eslint-disable-line react-hooks/exhaustive-deps

  const totals = useMemo(() => computeTotals(items), [items]);
  const progress = useMemo(() => computeProgress(totals), [totals]);

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

  const startConference = useCallback(async () => {
    if (!orderCode.trim()) {
      Alert.alert('Pedido obrigatório', 'Informe o número do pedido.');
      return;
    }
    const orderKey = normalizeKey(orderCode);
    try {
      const draft = await draftApi.findByKey(orderKey);
      if (draft) {
        setOrderCode(draft.orderCode || '');
        setSeparador(draft.separador || separador);
        setEmbalador(draft.embalador || embalador);
        setItems(Array.isArray(draft.items) ? draft.items : []);
        setStarted(true);
        return;
      }
    } catch { /* new */ }
    Alert.alert(
      'Sem carga real do pedido',
      catalogAvailable
        ? 'Para iniciar nova conferencia de saida, conecte uma fonte real dos itens do pedido.'
        : 'Nao ha catalogo real carregado no app. Importe a base real e conecte a origem do pedido.',
    );
  }, [orderCode, separador, embalador, draftApi, catalogAvailable]);

  const resumeDraft = useCallback((draft) => {
    setOrderCode(draft.orderCode || '');
    setSeparador(draft.separador || separador);
    setEmbalador(draft.embalador || embalador);
    setItems(Array.isArray(draft.items) ? draft.items : []);
    setStarted(true);
  }, [separador, embalador]);

  const openScanner = useCallback(() => {
    if (!started) {
      Alert.alert('Inicie primeiro', 'Inicie a conferência antes de bipar.');
      return;
    }
    navigation.navigate('BarcodeScannerScreen', {
      targetScreen: 'ConferenciaSaidaScreen',
      paramName: 'scannedCode',
      extraParams: { scannedQty: manualQty },
    });
  }, [started, navigation, manualQty]);

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
      Alert.alert('Item já completo', 'Quantidade desse item já foi totalmente conferida.');
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
    setTimeout(() => codeInputRef.current?.focus?.(), 80);
  }, []);

  const updateItemReadCount = useCallback((itemId, nextCount) => {
    const next = Math.max(0, Number(nextCount) || 0);
    setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, checkedQty: next } : i));
  }, []);

  const handleItemLongPress = useCallback((item) => {
    const canUndo = (item.checkedQty || 0) > 0;
    Alert.alert(
      'Ajustar leitura',
      `${item.code}${item.ean ? ` / ${item.ean}` : ''}\n${item.description}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        canUndo ? { text: 'Desfazer 1', onPress: () => updateItemReadCount(item.id, (item.checkedQty || 0) - 1) } : null,
        canUndo ? { text: 'Zerar leituras', style: 'destructive', onPress: () => updateItemReadCount(item.id, 0) } : null,
      ].filter(Boolean),
    );
  }, [updateItemReadCount]);

  const handleCodeSubmit = useCallback(() => {
    const code = manualCode.trim();
    const qty = Math.max(1, Number(manualQty) || 1);
    if (!code) return;
    setManualCode('');
    beginScanFlow(code, qty);
    setTimeout(() => codeInputRef.current?.focus?.(), 120);
  }, [manualCode, manualQty, beginScanFlow]);

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
      await draftApi.removeByKey(payload.orderCode);
      Alert.alert('Conferência finalizada', `Pendentes: ${nowTotals.pendingItems}. Divergências: ${nowTotals.divergences}.`);
      setStarted(false);
      setItems([]);
      setLastScanned('');
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar a conferência.');
    }
  }, [started, items, orderCode, separador, embalador, draftApi]);

  const saveConference = useCallback(() => {
    const nowTotals = computeTotals(items);
    if (nowTotals.divergences > 0) {
      const label = pluralize(nowTotals.divergences, 'item', 'itens');
      Alert.alert(
        'Fechar com divergência?',
        `Existem ${nowTotals.divergences} ${label} com divergência. Deseja finalizar assim?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Finalizar', style: 'destructive', onPress: persistConference },
        ],
      );
      return;
    }
    persistConference();
  }, [items, persistConference]);

  useEffect(() => {
    if (!started || !orderCode.trim()) return;
    draftApi.upsertDraftDebounced({
      orderCode: orderCode.trim(),
      separador: separador.trim(),
      embalador: embalador.trim(),
      items,
      updatedAt: new Date().toISOString(),
    });
  }, [started, orderCode, separador, embalador, items, draftApi]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Not started view ──────────────────────────────────────────────────────
  if (!started) {
    return (
      <ScreenLayout isDarkMode={isDarkMode} lightBackground={colors.background} darkBackground={colors.background} contentStyle={styles.content}>
        <FlatList
          data={[]}
          keyExtractor={(k) => k}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          ListHeaderComponent={
            <View style={styles.card}>
              <View style={styles.sectionTopRow}>
                <View style={[styles.sectionIconWrap, { backgroundColor: colors.primary }]}>
                  <MaterialIcons name="local-shipping" size={18} color="#ffffff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Dados da separação</Text>
                  <Text style={styles.searchSubtitle}>
                    A conferencia usa apenas rascunhos reais ou integracao real do pedido.
                  </Text>
                </View>
              </View>

              {draftApi.drafts.length > 0 && (
                <>
                  <Text style={styles.inputLabel}>Em andamento</Text>
                  <View style={styles.draftRow}>
                    {draftApi.drafts.slice(0, 3).map((draft) => (
                      <Pressable key={draft.orderCode} style={styles.draftChip} onPress={() => resumeDraft(draft)}>
                        <MaterialIcons name="restore" size={14} color={colors.primary} />
                        <Text style={styles.draftChipText}>{draft.orderCode}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}

              <Text style={styles.inputLabel}>Número do pedido</Text>
              <TextInput
                style={styles.input}
                placeholder="Número do pedido"
                placeholderTextColor={colors.textMuted}
                value={orderCode}
                onChangeText={setOrderCode}
              />
              <Text style={styles.inputLabel}>Separador</Text>
              <TextInput
                style={[styles.input, styles.inputDisabled]}
                placeholder="Separador"
                placeholderTextColor={colors.textMuted}
                value={separador}
                editable={false}
              />
              <Text style={styles.inputLabel}>Embalador</Text>
              <TextInput
                style={[styles.input, styles.inputDisabled]}
                placeholder="Embalador"
                placeholderTextColor={colors.textMuted}
                value={embalador}
                editable={false}
              />
              <Text style={styles.helperText}>
                {catalogAvailable
                  ? 'Catalogo real carregado, mas ainda sem fonte real dos itens do pedido.'
                  : 'Nenhum catalogo real carregado no app.'}
              </Text>
              <Pressable style={styles.primaryButton} onPress={startConference}>
                <MaterialIcons name="play-circle" size={20} color="#ffffff" />
                <Text style={styles.primaryButtonText}>Iniciar com dados reais</Text>
              </Pressable>
            </View>
          }
          renderItem={() => null}
        />
      </ScreenLayout>
    );
  }

  // ─── Active conference view ────────────────────────────────────────────────
  const listData = ['scan', 'toCheck', 'checked'];

  return (
    <ScreenLayout isDarkMode={isDarkMode} lightBackground={colors.background} darkBackground={colors.background} contentStyle={styles.content}>
      <CompactSummaryBar
        orderCode={orderCode}
        progress={progress}
        pendingCount={itemsToCheck.length}
        doneCount={itemsChecked.length}
        divergenceCount={totals.divergences}
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
                <View style={styles.codeInputRow}>
                  <TextInput
                    ref={codeInputRef}
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    placeholder="Código — pressione Enter"
                    placeholderTextColor={colors.textMuted}
                    value={manualCode}
                    onChangeText={setManualCode}
                    onSubmitEditing={handleCodeSubmit}
                    returnKeyType="done"
                    blurOnSubmit={false}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TextInput
                    style={[styles.input, styles.qtyInput, { marginBottom: 0 }]}
                    placeholder="Qtd"
                    placeholderTextColor={colors.textMuted}
                    value={manualQty}
                    onChangeText={(v) => setManualQty(v.replace(/[^0-9]/g, ''))}
                    keyboardType="numeric"
                    returnKeyType="done"
                    onSubmitEditing={handleCodeSubmit}
                  />
                  <Pressable style={styles.scanIconButton} onPress={openScanner} accessibilityLabel="Abrir câmera">
                    <MaterialIcons name="photo-camera" size={20} color="#ffffff" />
                  </Pressable>
                </View>
              </View>
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
                  styles={styles}
                />
                {itemsToCheck.length === 0 ? (
                  <View style={styles.emptyState}>
                    <MaterialIcons name="check-circle" size={32} color={colors.success} />
                    <Text style={[styles.emptyText, { marginTop: 8 }]}>Todos os itens conferidos!</Text>
                  </View>
                ) : (
                  itemsToCheck.map((row, idx) => (
                    <ConferenciaItemRow
                      key={row.id}
                      row={row}
                      colors={colors}
                      lastScanned={lastScanned}
                      lastScannedAt={lastScannedAt}
                      onLongPress={handleItemLongPress}
                      doneColor={colors.success}
                      isLast={idx === itemsToCheck.length - 1}
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
                styles={styles}
              />
              {itemsChecked.length === 0 ? (
                <Text style={styles.emptyText}>Nenhum item conferido ainda.</Text>
              ) : (
                itemsChecked.map((row, idx) => (
                  <ConferenciaItemRow
                    key={row.id}
                    row={row}
                    colors={colors}
                    lastScanned={lastScanned}
                    lastScannedAt={lastScannedAt}
                    onLongPress={handleItemLongPress}
                    doneColor={colors.success}
                    isLast={idx === itemsChecked.length - 1}
                  />
                ))
              )}
              {(itemsChecked.length > 0 || itemsToCheck.length === 0) && (
                <Pressable style={styles.finishButton} onPress={saveConference}>
                  <MaterialIcons name="check-circle" size={20} color="#ffffff" />
                  <Text style={styles.finishButtonText}>Finalizar conferência</Text>
                </Pressable>
              )}
            </View>
          );
        }}
      />
    </ScreenLayout>
  );
};

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
    compactBarLeft: { flex: 1, marginRight: 10, gap: 5 },
    compactInvoice: { color: colors.text, fontSize: 13, fontWeight: '900' },
    progressTrackInline: {
      height: 4,
      borderRadius: 999,
      backgroundColor: colors.surface2,
      overflow: 'hidden',
    },
    progressFillInline: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: 999,
    },
    compactPills: { flexDirection: 'row', gap: 5, alignItems: 'center' },
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
    scanCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    scanCardTitle: { color: colors.text, fontSize: 14, fontWeight: '900', flex: 1 },
    lastScannedBadge: { color: colors.textMuted, fontSize: 11, fontWeight: '700', maxWidth: 140 },
    codeInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    scanIconButton: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    qtyInput: { width: 58, textAlign: 'center' },

    // ── Section divider ──
    sectionDivider: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderLeftWidth: 3,
      paddingLeft: 10,
      marginBottom: 12,
    },
    sectionDividerText: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
    sectionDividerBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
    sectionDividerCount: { fontSize: 12, fontWeight: '900' },

    // ── Cards ──
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
    sectionTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
    sectionIconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    cardTitle: { fontSize: 17, fontWeight: '900', color: colors.text, marginBottom: 6 },
    searchSubtitle: { color: colors.textMuted, fontSize: 12, lineHeight: 18, fontWeight: '700', marginBottom: 10 },
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
    inputDisabled: { opacity: 0.6 },
    helperText: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 6 },
    draftRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 12 },
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
    emptyState: { alignItems: 'center', paddingVertical: 20 },
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

export default ConferenciaSaidaScreen;
