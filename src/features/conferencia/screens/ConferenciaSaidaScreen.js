import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import HapticFeedback from 'react-native-haptic-feedback';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import ScreenLayout, { createHeaderTitleTemplate, createScreenHeaderTemplate } from '../../../components/ScreenLayout';
import { finalizeConferenciaSaida } from '../services/conferenciaRecordsService';
import { readStoredUserName } from '../../../services/userSessionStorageService';
import { computeProgress, computeTotals, normalizeKey, pluralize } from '../services/conferenciaCore';
import { buildExpectedItemsSaida } from '../mocks/conferenciaMock';
import { useConferenciaSaidaDrafts } from '../hooks/useConferenciaSaidaDrafts';
import { conferenciaSaidaTheme } from '../../../theme/domains/conferencia';

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
  const codeInputRef = useRef(null);

  const colors = useMemo(() => {
    const base = conferenciaSaidaTheme;
    const dark = !!isDarkMode;

    const background = dark ? '#1f2438' : base.background || '#eef2ff';
    const surface = dark ? '#262d47' : '#ffffff';
    const surface2 = dark ? '#2b3350' : '#f7f7f8';
    const text = dark ? '#f3f5ff' : '#2f333a';
    const textMuted = dark ? '#aab1cf' : 'rgba(64, 68, 76, 0.78)';
    const border = dark ? '#3a4265' : 'rgba(64, 68, 76, 0.18)';
    const divider = dark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(64, 68, 76, 0.14)';
    const inputBg = dark ? '#202846' : '#ffffff';
    const chipBg = dark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(67, 56, 202, 0.08)';

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
  const normalizeOrder = normalizeKey;
  const draftApi = useConferenciaSaidaDrafts();

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
          title: 'Conferência de saída',
          subtitle: 'Conferência cega por pedido',
          iconName: 'local-shipping',
          tintColor: '#ffffff',
        }),
    });
  }, [navigation, isDarkMode, colors.primary]);

  useEffect(() => {
    const loadLoggedUser = async () => {
      try {
        const name = await readStoredUserName('');
        if (name) {
          setSeparador(name);
          setEmbalador(name);
        }
      } catch {
        // ignore
      }
    };

    loadLoggedUser();
  }, []);

  useEffect(() => {
    if (!route.params?.scannedCode || !started) return;
    const scanned = String(route.params.scannedCode).trim();
    const qty = Math.max(1, Number(route.params.scannedQty) || 1);
    navigation.setParams({ scannedCode: undefined });
    navigation.setParams({ scannedQty: undefined });
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
    const unsubscribe = navigation.addListener('focus', draftApi.loadDrafts);
    return unsubscribe;
  }, [navigation, draftApi]); // eslint-disable-line react-hooks/exhaustive-deps

  const totals = useMemo(() => computeTotals(items), [items]);
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
  const progress = useMemo(() => computeProgress(totals), [totals]);

  const startConference = async () => {
    if (!orderCode.trim()) {
      Alert.alert('Pedido obrigatório', 'Informe o número do pedido.');
      return;
    }
    const orderKey = normalizeOrder(orderCode);
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
    } catch {
      // continue with new conference
    }
    const expectedItems = await buildExpectedItemsSaida(orderCode.trim(), 20);
    setItems(expectedItems);
    setStarted(true);
  };

  const resumeDraft = (draft) => {
    setOrderCode(draft.orderCode || '');
    setSeparador(draft.separador || separador);
    setEmbalador(draft.embalador || embalador);
    setItems(Array.isArray(draft.items) ? draft.items : []);
    setStarted(true);
  };

  const openScanner = () => {
    if (!started) {
      Alert.alert('Inicie primeiro', 'Inicie a conferência do pedido antes de bipar.');
      return;
    }
    navigation.navigate('BarcodeScannerScreen', {
      targetScreen: 'ConferenciaSaidaScreen',
      paramName: 'scannedCode',
      extraParams: { scannedQty: manualQty },
    });
  };

  const findItemForScan = (value) => {
    const key = String(value || '').trim();
    if (!key) return null;
    for (const it of items) {
      // Prioriza embalagem (CX/FD) antes do item base, para puxar fator automaticamente.
      const opts = Array.isArray(it.packagingOptions) ? it.packagingOptions : [];
      const hit = opts.find((opt) => (opt?.ean && key === opt.ean) || (opt?.dun && key === opt.dun));
      if (hit) return { item: it, opt: hit };

      if (key === it.code || (it.ean && key === it.ean) || (it.dun && key === it.dun)) return { item: it, opt: null };
    }
    return null;
  };

  const beginScanFlow = (value, qty = 1) => {
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
    const qty = Math.max(1, Number(manualQty) || 1);
    if (!code) return;
    setManualCode('');
    codeInputRef.current?.focus?.();
    beginScanFlow(code, qty);
  };

  const persistConference = async () => {
    if (!started || items.length === 0) return;
    const nowTotals = computeTotals(items);
    const payload = {
      id: `saida-${Date.now()}`,
      type: 'saida',
      createdAt: new Date().toISOString(),
      orderCode: orderCode.trim(),
      separador: separador.trim(),
      embalador: embalador.trim(),
      items,
      totals: nowTotals,
    };

    try {
      const divergences = items
        .filter((item) => item.checkedQty !== item.expectedQty)
        .map((item) => ({
          id: `div-sai-${payload.id}-${item.id}`,
          source: 'saida',
          status: 'pendente',
          createdAt: payload.createdAt,
          orderCode: payload.orderCode,
          code: item.code,
          description: item.description,
          expectedQty: item.expectedQty,
          checkedQty: item.checkedQty,
          diff: item.checkedQty - item.expectedQty,
        }));

      await finalizeConferenciaSaida(payload, divergences);

      await draftApi.removeByKey(payload.orderCode);

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
    if (!started || !orderCode.trim()) return;
    draftApi.upsertDraftDebounced({
      orderCode: orderCode.trim(),
      separador: separador.trim(),
      embalador: embalador.trim(),
      items,
      updatedAt: new Date().toISOString(),
    });
  }, [started, orderCode, separador, embalador, items, draftApi]); // eslint-disable-line react-hooks/exhaustive-deps

  const listData = useMemo(() => {
    if (!started) return [];
    return ['toCheck', 'checked'];
  }, [started]);

  const header = useMemo(() => {
    if (!started) {
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Dados da separação</Text>
          {draftApi.drafts.length > 0 ? (
            <>
              <Text style={styles.inputLabel}>Conferências em andamento</Text>
              <View style={styles.draftRow}>
                {draftApi.drafts.slice(0, 3).map((draft) => (
                  <Pressable
                    key={draft.orderCode}
                    style={styles.draftChip}
                    onPress={() => resumeDraft(draft)}
                  >
                    <MaterialIcons name="restore" size={14} color={colors.primary} />
                    <Text style={styles.draftChipText}>{draft.orderCode}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
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
            style={styles.input}
            placeholder="Separador"
            placeholderTextColor={colors.textMuted}
            value={separador}
            editable={false}
          />
          <Text style={styles.inputLabel}>Embalador</Text>
          <TextInput
            style={styles.input}
            placeholder="Embalador"
            placeholderTextColor={colors.textMuted}
            value={embalador}
            editable={false}
          />
          <Pressable style={styles.primaryButton} onPress={startConference}>
            <MaterialIcons name="play-circle" size={20} color={colors.onPrimary} />
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
              <Text style={styles.statusSubtitle}>Pedido {orderCode}</Text>
            </View>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>{progress}%</Text>
            </View>
          </View>
          <Text style={styles.statusMeta}>Separador: {separador}</Text>
          <Text style={styles.statusMeta}>Embalador: {embalador}</Text>
          {lastScanned ? <Text style={styles.statusMeta}>Última leitura: {lastScanned}</Text> : null}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>

        <Pressable style={styles.scanButton} onPress={openScanner}>
          <MaterialIcons name="qr-code-scanner" size={20} color={colors.onPrimary} />
          <Text style={styles.scanButtonText}>Abrir câmera para bipagem</Text>
        </Pressable>

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
            <TextInput
              style={[styles.input, styles.qtyInput]}
              placeholder="Qtde"
              placeholderTextColor={colors.textMuted}
              value={manualQty}
              onChangeText={(value) => setManualQty(value.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
              onSubmitEditing={handleCodeSubmit}
              returnKeyType="done"
            />
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
    colors.onPrimary,
    orderCode,
    separador,
    embalador,
    startConference,
    progress,
    openScanner,
    manualCode,
    manualQty,
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
                  itemsToCheck.map((row) => {
                    const isHot = lastScanned && (row.code === lastScanned || row.ean === lastScanned) && (Date.now() - lastScannedAt) < 2500;
                    const done = row.checkedQty >= row.expectedQty && row.checkedQty > 0;
                    return (
                      <Pressable
                        key={row.id}
                        onLongPress={() => handleItemLongPress(row)}
                        style={[styles.itemRow, isHot && styles.itemRowHot]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemCode}>{row.code}{row.ean ? ` / ${row.ean}` : ''}</Text>
                          <Text style={styles.itemDesc} numberOfLines={1}>{row.description}</Text>
                        </View>
                        <Text style={[styles.itemQty, { color: done ? colors.success : colors.text }]}>
                          Lido: {row.checkedQty}
                        </Text>
                      </Pressable>
                    );
                  })
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
                itemsChecked.map((row) => {
                  const isHot = lastScanned && (row.code === lastScanned || row.ean === lastScanned) && (Date.now() - lastScannedAt) < 2500;
                  return (
                    <Pressable
                      key={row.id}
                      onLongPress={() => handleItemLongPress(row)}
                      style={[styles.itemRow, isHot && styles.itemRowHot]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemCode}>{row.code}{row.ean ? ` / ${row.ean}` : ''}</Text>
                        <Text style={styles.itemDesc} numberOfLines={1}>{row.description}</Text>
                      </View>
                      <Text style={[styles.itemQty, { color: colors.success }]}>Lido: {row.checkedQty}</Text>
                    </Pressable>
                  );
                })
              )}

              <Pressable style={styles.finishButton} onPress={saveConference}>
                <MaterialIcons name="check-circle" size={20} color={colors.onPrimary} />
                <Text style={styles.finishButtonText}>Finalizar conferência</Text>
              </Pressable>
            </View>
          );
        }}
      />

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
    statusBadge: {
      backgroundColor: colors.primary,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    statusBadgeText: {
      color: colors.onPrimary,
      fontSize: 12,
      fontWeight: '900',
    },
    progressTrack: {
      marginTop: 8,
      height: 8,
      borderRadius: 999,
      backgroundColor: colors.surface2,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: 999,
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
      flex: 0.85,
    },
    qtyInput: {
      flex: 0.15,
      textAlign: 'center',
      minWidth: 62,
    },
    helperText: {
      marginTop: -2,
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '600',
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
    scanButton: {
      borderRadius: 10,
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 13,
      marginBottom: 12,
    },
    scanButtonText: {
      color: colors.onPrimary,
      fontWeight: '800',
      fontSize: 14,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
      paddingVertical: 9,
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

export default ConferenciaSaidaScreen;
