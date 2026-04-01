import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import HapticFeedback from 'react-native-haptic-feedback';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import ScreenLayout, { createHeaderTitleTemplate, createScreenHeaderTemplate } from '../../../components/ScreenLayout';
import ConferenciaBonusCard from '../components/ConferenciaBonusCard';
import ConferenciaItemRow from '../components/ConferenciaItemRow';
import { finalizeConferenciaRecebimento } from '../services/conferenciaRecordsService';
import { computeTotals, normalizeKey, pluralize } from '../services/conferenciaCore';
import { buildExpectedItemsEntrada } from '../mocks/conferenciaMock';
import { useConferenciaRecebimentoDrafts } from '../hooks/useConferenciaRecebimentoDrafts';
import { buildBonusRecebimentoList } from '../mocks/conferenciaBonusMock';
import { conferenciaRecebimentoTheme } from '../../../theme/domains/conferencia';

const ConferenciaRecebimentoScreen = ({ navigation, route, isDarkMode }) => {
  const [supplier, setSupplier] = useState('');
  const [invoice, setInvoice] = useState('');
  const [conferente, setConferente] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [started, setStarted] = useState(false);
  const [items, setItems] = useState([]);
  const [lastScanned, setLastScanned] = useState('');
  const [lastScannedAt, setLastScannedAt] = useState(0);
  const codeInputRef = useRef(null);
  const [bonusQuery, setBonusQuery] = useState('');

  const colors = useMemo(() => {
    const base = conferenciaRecebimentoTheme;
    const dark = !!isDarkMode;

    const background = dark ? '#1f2438' : base.background || '#f0fdfa';
    const surface = dark ? '#262d47' : '#ffffff';
    const surface2 = dark ? '#2b3350' : '#f7f7f8';
    const text = dark ? '#f3f5ff' : '#2f333a';
    const textMuted = dark ? '#aab1cf' : 'rgba(64, 68, 76, 0.78)';
    const border = dark ? '#3a4265' : 'rgba(64, 68, 76, 0.18)';
    const divider = dark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(64, 68, 76, 0.14)';
    const inputBg = dark ? '#202846' : '#ffffff';
    const chipBg = dark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 118, 110, 0.08)';

    return {
      primary: base.primary,
      secondary: base.secondary,
      accentText: base.text,
      background,
      surface,
      surface2,
      text,
      textMuted,
      border,
      divider,
      inputBg,
      chipBg,
      onPrimary: '#ffffff',
      shadow: '#000000',
      success: '#059669',
      successSoft: dark ? 'rgba(16, 185, 129, 0.16)' : 'rgba(16, 185, 129, 0.12)',
      danger: '#dc2626',
      dangerSoft: dark ? 'rgba(220, 38, 38, 0.16)' : 'rgba(220, 38, 38, 0.10)',
      warning: '#f59e0b',
    };
  }, [isDarkMode]);
  const styles = getStyles(colors);
  const normalizeInvoice = normalizeKey;
  const draftApi = useConferenciaRecebimentoDrafts();

  useLayoutEffect(() => {
    const subtitle = started && (invoice.trim() || supplier.trim())
      ? `NF ${invoice.trim() || '-'} • ${supplier.trim() || '-'}`
      : 'Bônus para conferir';

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
          subtitle,
          iconName: 'inventory',
          tintColor: '#ffffff',
        }),
    });
  }, [navigation, isDarkMode, colors.primary, started, invoice, supplier]);

  useEffect(() => {
    if (!route.params?.scannedCode || !started) return;
    const scanned = String(route.params.scannedCode).trim();
    navigation.setParams({ scannedCode: undefined });
    navigation.setParams({ scannedQty: undefined });
    beginScanFlow(scanned, 1);
  }, [route.params?.scannedCode, started]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!route.params?.scanConfirm) return;
    const payload = route.params.scanConfirm;
    navigation.setParams({ scanConfirm: undefined });
    applyScanPayload(payload);
  }, [route.params?.scanConfirm, navigation]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    draftApi.loadDrafts();
    const unsubscribe = navigation.addListener('focus', draftApi.loadDrafts);
    return unsubscribe;
  }, [navigation, draftApi]); // eslint-disable-line react-hooks/exhaustive-deps

  const bonusesAll = useMemo(() => buildBonusRecebimentoList(), []);
  const bonusesFiltered = useMemo(() => {
    const q = String(bonusQuery || '').trim().toLowerCase();
    if (!q) return bonusesAll;
    return bonusesAll.filter((b) => {
      const hay = `${b.invoice} ${b.supplierName} ${b.supplierCode}`.toLowerCase();
      return hay.includes(q);
    });
  }, [bonusesAll, bonusQuery]);

  const itemsToCheck = useMemo(() => {
    const key = String(lastScanned || '').trim();
    return items
      .filter((item) => item.checkedQty < item.expectedQty)
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
  const itemsChecked = useMemo(() => items.filter((item) => item.checkedQty >= item.expectedQty), [items]);

  const startConference = async ({ supplierOverride, invoiceOverride } = {}) => {
    const supplierValue = String(supplierOverride ?? supplier).trim();
    const invoiceValue = String(invoiceOverride ?? invoice).trim();

    if (!supplierValue || !invoiceValue) {
      Alert.alert('Dados obrigatórios', 'Informe fornecedor e número da nota.');
      return;
    }
    const invoiceKey = normalizeInvoice(invoiceValue);
    try {
      const draft = await draftApi.findByKey(invoiceKey);
      if (draft) {
        setSupplier(draft.supplier || '');
        setInvoice(draft.invoice || '');
        setConferente(draft.conferente || '');
        setItems(Array.isArray(draft.items) ? draft.items : []);
        setStarted(true);
        return;
      }
    } catch {
      // continue with new conference
    }
    setSupplier(supplierValue);
    setInvoice(invoiceValue);
    const expectedItems = await buildExpectedItemsEntrada(invoiceValue, 16);
    setItems(expectedItems);
    setStarted(true);
  };

  const resumeDraft = (draft) => {
    setSupplier(draft.supplier || '');
    setInvoice(draft.invoice || '');
    setConferente(draft.conferente || '');
    setItems(Array.isArray(draft.items) ? draft.items : []);
    setStarted(true);
  };

  const openScanner = () => {
    if (!started) {
      Alert.alert('Inicie primeiro', 'Inicie a conferência da nota antes de bipar.');
      return;
    }
    navigation.navigate('BarcodeScannerScreen', {
      targetScreen: 'ConferenciaRecebimentoScreen',
      paramName: 'scannedCode',
    });
  };

  const findItemForScan = (value) => {
    const key = String(value || '').trim();
    if (!key) return null;
    for (const it of items) {
      // Prioriza embalagem (CX/FD) antes do item base, para puxar fator automaticamente.
      const opts = Array.isArray(it.packagingOptions) ? it.packagingOptions : [];
      const hit = opts.find((opt) => (opt?.ean && key === opt.ean) || (opt?.dun && key === opt.dun));
      if (hit) return { item: it, opt: hit, matchType: 'pack' };

      if (key === it.code) return { item: it, opt: null, matchType: 'code' };
      if (it.ean && key === it.ean) return { item: it, opt: null, matchType: 'ean' };
      if (it.dun && key === it.dun) return { item: it, opt: null, matchType: 'dun' };
    }
    return null;
  };

  const beginScanFlow = (value, qty = 1) => {
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

    const initialPackagingId = match.matchType === 'code'
      ? 'un'
      : (match.opt?.id || null);

    navigation.navigate('ConferenciaScanScreen', {
      context: 'recebimento',
      targetScreen: 'ConferenciaRecebimentoScreen',
      itemId: match.item.id,
      scannedValue: String(value || '').trim(),
      initialQty: amount,
      initialPackagingId,
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
  };

  const applyScanPayload = (payload) => {
    let overflow = false;
    let full = false;
    const nowIso = new Date().toISOString();
    const scannedValue = String(payload?.scannedValue || '').trim();
    const effectiveQty = Math.max(1, Number(payload?.effectiveQty) || 1);
    const qty = Math.max(1, Number(payload?.qty) || 1);
    const factor = Math.max(1, Number(payload?.factor) || 1);
    const packaging = payload?.packaging || null;
    const lote = payload?.lote;
    const validade = payload?.validade;
    const embalagem = payload?.embalagem;
    const itemId = String(payload?.itemId || '');

    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const remaining = (Number(it.expectedQty) || 0) - (Number(it.checkedQty) || 0);
        if (remaining <= 0) {
          full = true;
          return it;
        }
        if (effectiveQty > remaining) {
          overflow = true;
          return it;
        }

        const meta = {
          at: nowIso,
          scannedValue,
          lote: String(lote || '').trim(),
          validade: String(validade || '').trim(),
          embalagem: String(embalagem || '').trim(),
          packagingId: packaging?.id || 'un',
          packagingLabel: packaging?.label || 'UN',
          packagingFactor: Number(factor) || 1,
          qty: Number(qty) || 1,
          effectiveQty,
          ean: packaging?.ean || it.ean || '',
          dun: packaging?.dun || it.dun || '',
        };

        const nextReads = Array.isArray(it.reads) ? [...it.reads, meta].slice(-50) : [meta];
        return {
          ...it,
          checkedQty: (Number(it.checkedQty) || 0) + effectiveQty,
          lastMeta: meta,
          reads: nextReads,
        };
      }),
    );

    if (overflow) {
      HapticFeedback.trigger('notificationError', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });
      Alert.alert('Quantidade inválida', 'A quantidade informada excede o saldo disponível para esse item.');
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
    codeInputRef.current?.focus?.();
  };

  const updateItemReadCount = (itemId, nextCount) => {
    const next = Math.max(0, Number(nextCount) || 0);
    setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, checkedQty: next } : item)));
  };

  const handleItemLongPress = (item) => {
    const canUndo = (item.checkedQty || 0) > 0;
    const canReset = (item.checkedQty || 0) > 0;

    Alert.alert(
      'Ajustar leitura',
      `${item.code}${item.ean ? ` / ${item.ean}` : ''}\n${item.description}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        canUndo
          ? {
            text: 'Desfazer 1',
            onPress: () => updateItemReadCount(item.id, (item.checkedQty || 0) - 1),
          }
          : null,
        canReset
          ? {
            text: 'Zerar leituras',
            style: 'destructive',
            onPress: () => updateItemReadCount(item.id, 0),
          }
          : null,
      ].filter(Boolean),
    );
  };

  const handleCodeSubmit = () => {
    const code = manualCode.trim();
    if (!code) return;
    setManualCode('');
    codeInputRef.current?.focus?.();
    beginScanFlow(code, 1);
  };

  const persistConference = async () => {
    if (!started || items.length === 0) return;
    const nowTotals = computeTotals(items);
    const payload = {
      id: `rec-${Date.now()}`,
      type: 'recebimento',
      createdAt: new Date().toISOString(),
      supplier: supplier.trim(),
      invoice: invoice.trim(),
      conferente: conferente.trim(),
      items,
      totals: nowTotals,
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
        }));

      await finalizeConferenciaRecebimento(payload, divergences);

      await draftApi.removeByKey(payload.invoice);

      Alert.alert(
        'Conferência finalizada',
        `Pendentes: ${nowTotals.pendingItems}. Divergências: ${nowTotals.divergences}.`,
      );
      setStarted(false);
      setItems([]);
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar a conferência.');
    }
  };

  const saveConference = () => {
    const nowTotals = computeTotals(items);
    if (nowTotals.divergences > 0) {
      const itemLabel = pluralize(nowTotals.divergences, 'item', 'itens');
      Alert.alert(
        'Fechar com divergência?',
        `Existem ${nowTotals.divergences} ${itemLabel} com divergência. Deseja realmente finalizar assim?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Finalizar', style: 'destructive', onPress: persistConference },
        ],
      );
      return;
    }

    persistConference();
  };

  useEffect(() => {
    if (!started || !invoice.trim()) return;
    draftApi.upsertDraftDebounced({
      invoice: invoice.trim(),
      supplier: supplier.trim(),
      conferente: conferente.trim(),
      items,
      updatedAt: new Date().toISOString(),
    });
  }, [started, invoice, supplier, conferente, items, draftApi]); // eslint-disable-line react-hooks/exhaustive-deps

  const listData = useMemo(() => {
    if (!started) return [];
    return ['toCheck', 'checked'];
  }, [started]);

  const header = useMemo(() => {
    if (!started) {
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Dados da entrada</Text>
          {draftApi.drafts.length > 0 ? (
            <>
              <Text style={styles.inputLabel}>Conferências em andamento</Text>
              <View style={styles.draftRow}>
                {draftApi.drafts.slice(0, 3).map((draft) => (
                  <Pressable
                    key={draft.invoice}
                    style={styles.draftChip}
                    onPress={() => resumeDraft(draft)}
                  >
                    <MaterialIcons name="restore" size={14} color={colors.primary} />
                    <Text style={styles.draftChipText}>{draft.invoice}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
          <Text style={styles.inputLabel}>Fornecedor</Text>
          <TextInput
            style={styles.input}
            placeholder="Fornecedor"
            placeholderTextColor={colors.textMuted}
            value={supplier}
            onChangeText={setSupplier}
          />
          <Text style={styles.inputLabel}>Número da nota</Text>
          <TextInput
            style={styles.input}
            placeholder="Número da nota"
            placeholderTextColor={colors.textMuted}
            value={invoice}
            onChangeText={setInvoice}
          />
          <Text style={styles.inputLabel}>Conferente</Text>
          <TextInput
            style={styles.input}
            placeholder="Conferente (opcional)"
            placeholderTextColor={colors.textMuted}
            value={conferente}
            onChangeText={setConferente}
          />
          <Pressable style={styles.primaryButton} onPress={startConference}>
            <MaterialIcons name="play-circle" size={20} color="#fff" />
            <Text style={styles.primaryButtonText}>Iniciar conferência</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <>
            <View style={styles.statusCard}>
              <View style={styles.statusHeader}>
                <View>
                  <Text style={styles.statusTitle}>Conferência em andamento</Text>
                  <Text style={styles.statusSubtitle}>{invoice}</Text>
                </View>
              </View>
              <Text style={styles.statusMeta}>Fornecedor: {supplier}</Text>
              {conferente ? <Text style={styles.statusMeta}>Conferente: {conferente}</Text> : null}
              {lastScanned ? <Text style={styles.statusMeta}>Última leitura: {lastScanned}</Text> : null}
            </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Código de Barra ou Código do Produto</Text>
          <View style={styles.codeInputRow}>
            <TextInput
              ref={codeInputRef}
              style={[styles.input, styles.codeInput]}
              placeholder="Digite o código e pressione Enter"
              placeholderTextColor={colors.textMuted}
              value={manualCode}
              onChangeText={setManualCode}
              onSubmitEditing={handleCodeSubmit}
              returnKeyType="done"
              blurOnSubmit={false}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable style={styles.scanIconButton} onPress={openScanner} accessibilityLabel="Abrir câmera para bipagem">
              <MaterialIcons name="qr-code-scanner" size={20} color={colors.onPrimary} />
            </Pressable>
          </View>
          <Text style={styles.helperText}>Dica: pressione Enter para lançar a leitura.</Text>
        </View>
      </>
    );
  }, [
    started,
    styles,
    draftApi.drafts,
    colors.primary,
    colors.textMuted,
    supplier,
    invoice,
    conferente,
    startConference,
    openScanner,
    manualCode,
    handleCodeSubmit,
    resumeDraft,
    lastScanned,
  ]);

  return (
    <ScreenLayout
      isDarkMode={isDarkMode}
      lightBackground={colors.background}
      darkBackground={colors.background}
      contentStyle={styles.content}
    >
      {started ? (
        <>
          <FlatList
            data={listData}
            keyExtractor={(key) => String(key)}
            ListHeaderComponent={header}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            renderItem={({ item }) => {
              if (item === 'toCheck') {
                return (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Itens a Conferir</Text>
                    {itemsToCheck.length === 0 ? (
                      <Text style={styles.emptyText}>Nenhum item pendente.</Text>
                    ) : (
                      itemsToCheck.map((row) => (
                        <ConferenciaItemRow
                          key={row.id}
                          row={row}
                          colors={colors}
                          lastScanned={lastScanned}
                          lastScannedAt={lastScannedAt}
                          onLongPress={handleItemLongPress}
                          doneColor={colors.success}
                        />
                      ))
                    )}
                  </View>
                );
              }

              return (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Itens Conferidos</Text>
                  {itemsChecked.length === 0 ? (
                    <Text style={styles.emptyText}>Nenhum item totalmente conferido.</Text>
                  ) : (
                    itemsChecked.map((row) => (
                      <ConferenciaItemRow
                        key={row.id}
                        row={row}
                        colors={colors}
                        lastScanned={lastScanned}
                        lastScannedAt={lastScannedAt}
                        onLongPress={handleItemLongPress}
                        doneColor={colors.success}
                      />
                    ))
                  )}

                  <Pressable style={styles.finishButton} onPress={saveConference}>
                    <MaterialIcons name="check-circle" size={20} color="#fff" />
                    <Text style={styles.finishButtonText}>Finalizar conferência</Text>
                  </Pressable>
                </View>
              );
            }}
          />

        </>
      ) : (
        <FlatList
          data={bonusesFiltered}
          keyExtractor={(item) => String(item.id)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          ListHeaderComponent={
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Bônus para conferir</Text>
              <TextInput
                style={styles.input}
                placeholder="Buscar por NF ou fornecedor"
                placeholderTextColor={colors.textMuted}
                value={bonusQuery}
                onChangeText={setBonusQuery}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />

              {draftApi.drafts.length > 0 ? (
                <>
                  <Text style={[styles.inputLabel, { marginTop: 12 }]}>Em andamento</Text>
                  <View style={styles.draftRow}>
                    {draftApi.drafts.slice(0, 3).map((draft) => (
                      <Pressable
                        key={draft.invoice}
                        style={styles.draftChip}
                        onPress={() => resumeDraft(draft)}
                      >
                        <MaterialIcons name="restore" size={14} color={colors.primary} />
                        <Text style={styles.draftChipText}>{draft.invoice}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <ConferenciaBonusCard
              item={item}
              colors={colors}
              onPress={() => startConference({ supplierOverride: item.supplierName, invoiceOverride: item.invoice })}
            />
          )}
          ListEmptyComponent={
            <View style={styles.card}>
              <Text style={styles.emptyText}>Nenhum bônus encontrado.</Text>
            </View>
          }
        />
      )}
    </ScreenLayout>
  );
};

const getStyles = (colors) =>
  StyleSheet.create({
    content: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 12,
    },
    scrollContent: {
      paddingBottom: 28,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 12,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 3,
    },
    statusCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 12,
    },
    statusHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    statusTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '900',
    },
    statusSubtitle: {
      marginTop: 2,
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    statusMeta: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
      marginBottom: 2,
    },
    draftRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 10,
      flexWrap: 'wrap',
    },
    draftChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.chipBg,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    draftChipText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '700',
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 10,
    },
    inputLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      marginBottom: 6,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBg,
      color: colors.text,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 10,
      fontSize: 14,
      fontWeight: '600',
    },
    codeInputRow: {
      flexDirection: 'row',
      gap: 8,
    },
    codeInput: {
      flex: 1,
    },
    scanIconButton: {
      width: 52,
      borderRadius: 10,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.primary,
      paddingVertical: 10,
      marginBottom: 10,
    },
    helperText: {
      marginTop: -2,
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '600',
    },
    bonusCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 10,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 2,
    },
    bonusTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    bonusTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '900',
    },
    bonusSub: {
      marginTop: 2,
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '800',
    },
    badge: {
      backgroundColor: colors.surface2,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },
    badgeText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '900',
    },
    bonusMetaRow: {
      marginTop: 10,
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
    metaPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.surface2,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    metaText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '800',
    },
    primaryButton: {
      borderRadius: 10,
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 11,
    },
    primaryButtonText: {
      color: colors.onPrimary,
      fontSize: 14,
      fontWeight: '800',
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
      paddingVertical: 9,
    },
    itemLeft: {
      flex: 1,
      paddingRight: 10,
    },
    itemRowHot: {
      backgroundColor: colors.successSoft,
      borderRadius: 10,
      paddingHorizontal: 8,
      marginHorizontal: -8,
    },
    itemCode: {
      color: colors.text,
      fontWeight: '800',
      fontSize: 12,
    },
    itemDesc: {
      marginTop: 2,
      color: colors.textMuted,
      fontWeight: '600',
      fontSize: 12,
    },
    itemMetaRow: {
      marginTop: 6,
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
    },
    itemTag: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface2,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
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
    emptyText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    itemQty: {
      fontSize: 14,
      fontWeight: '900',
    },
    finishButton: {
      borderRadius: 12,
      backgroundColor: colors.success,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      marginTop: 10,
    },
    finishButtonText: {
      color: colors.onPrimary,
      fontSize: 14,
      fontWeight: '900',
    },
  });

export default ConferenciaRecebimentoScreen;
