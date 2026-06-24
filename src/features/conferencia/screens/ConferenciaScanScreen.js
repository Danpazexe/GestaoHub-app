import React, { useLayoutEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import ScreenLayout, { createHeaderTitleTemplate, createScreenHeaderTemplate } from '../../../components/ScreenLayout';
import { CORESCONFERENCIARECB, CORESCONFERENCIASAIDA } from '../../../components/coresAuth';

const clampInt = (value, fallback = 1) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.floor(n));
};

const pickDefaultPackaging = (item, initialPackagingId) => {
  const list = Array.isArray(item?.packagingOptions) ? item.packagingOptions : [];
  if (initialPackagingId) {
    const forced = list.find((opt) => opt.id === initialPackagingId);
    if (forced) return forced;
  }
  if (item?.lastMeta?.packagingId) {
    const hit = list.find((opt) => opt.id === item.lastMeta.packagingId);
    if (hit) return hit;
  }
  return list[0] || { id: 'un', label: 'UN', factor: 1 };
};

const parsePtBrDate = (value) => {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const dd = Number(match[1]);
  const mm = Number(match[2]);
  const yyyy = Number(match[3]);
  if (!dd || !mm || !yyyy) return null;
  const d = new Date(yyyy, mm - 1, dd);
  if (Number.isNaN(d.getTime())) return null;
  return d;
};

const formatPtBrDate = (date) => {
  const d = date instanceof Date ? date : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR');
};

const createColors = ({ context, isDarkMode }) => {
  const base = context === 'saida' ? CORESCONFERENCIASAIDA : CORESCONFERENCIARECB;
  const dark = !!isDarkMode;

  const background = dark ? '#1f2438' : base.background || '#f7f7f8';
  const surface = dark ? '#262d47' : '#ffffff';
  const surface2 = dark ? '#2b3350' : '#f7f7f8';
  const text = dark ? '#f3f5ff' : '#2f333a';
  const textMuted = dark ? '#aab1cf' : 'rgba(64, 68, 76, 0.78)';
  const border = dark ? '#3a4265' : 'rgba(64, 68, 76, 0.18)';
  const divider = dark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(64, 68, 76, 0.14)';
  const inputBg = dark ? '#202846' : '#ffffff';

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
    onPrimary: '#ffffff',
    shadow: '#000000',
    success: '#059669',
    danger: '#dc2626',
    warning: '#f59e0b',
  };
};

const ConferenciaScanScreen = ({ navigation, route, isDarkMode }) => {
  const context = String(route.params?.context || 'recebimento');
  const targetScreen = String(route.params?.targetScreen || '');
  const itemId = String(route.params?.itemId || '');
  const scannedValue = String(route.params?.scannedValue || '').trim();

  const item = route.params?.item || null;
  const initialQty = Math.max(1, Number(route.params?.initialQty) || 1);
  const initialPackagingId = route.params?.initialPackagingId || null;
  const editMode = String(route.params?.editMode || '').trim();

  const colors = useMemo(() => createColors({ context, isDarkMode }), [context, isDarkMode]);
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [qty, setQty] = useState(String(initialQty || 1));
  const [lote, setLote] = useState(String(item?.lastMeta?.lote || ''));
  const [validadeDate, setValidadeDate] = useState(() => {
    const parsed = parsePtBrDate(item?.lastMeta?.validade);
    return parsed || new Date();
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [validadeDraftDate, setValidadeDraftDate] = useState(() => {
    const parsed = parsePtBrDate(item?.lastMeta?.validade);
    return parsed || new Date();
  });
  // Nem todo produto tem validade. Default: "sem validade" só quando estamos
  // editando uma leitura que já foi salva sem validade.
  const [semValidade, setSemValidade] = useState(
    () => Boolean(item?.lastMeta) && !String(item?.lastMeta?.validade || '').trim(),
  );
  const [packaging, setPackaging] = useState(() => pickDefaultPackaging(item, initialPackagingId));
  const embalagemLabel = useMemo(() => String(packaging?.label || '').trim(), [packaging]);
  const handleSelectPackaging = (opt) => setPackaging(opt);

  const qtyInt = useMemo(() => clampInt(qty, 1), [qty]);
  const factorInt = useMemo(() => clampInt(packaging?.factor, 1), [packaging]);
  const effectiveQty = useMemo(() => qtyInt * factorInt, [qtyInt, factorInt]);

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
          title: 'Leitura do produto',
          subtitle: item?.code ? String(item.code) : 'Conferência',
          iconName: 'qr-code-scanner',
          tintColor: '#ffffff',
        }),
    });
  }, [navigation, isDarkMode, colors.primary, item?.code]);

  const toggleDatePicker = () => {
    if (semValidade) return;
    setValidadeDraftDate(validadeDate);
    setShowDatePicker(true);
  };

  const toggleSemValidade = () => {
    setSemValidade((prev) => {
      if (!prev) setShowDatePicker(false); // ao marcar sem validade, fecha o picker
      return !prev;
    });
  };

  const onChangeDate = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      if (event?.type === 'dismissed') {
        setShowDatePicker(false);
        return;
      }
      if (selectedDate) setValidadeDate(selectedDate);
      setShowDatePicker(false);
      return;
    }
    if (selectedDate) setValidadeDraftDate(selectedDate);
  };

  const confirmDatePicker = () => {
    setValidadeDate(validadeDraftDate);
    setShowDatePicker(false);
  };

  const cancelDatePicker = () => {
    setValidadeDraftDate(validadeDate);
    setShowDatePicker(false);
  };

  const confirm = () => {
    if (!targetScreen) {
      Alert.alert('Erro', 'Tela de destino não informada.');
      return;
    }
    if (!itemId) {
      Alert.alert('Erro', 'Item não identificado.');
      return;
    }

    const payload = {
      itemId,
      scannedValue,
      lote: String(lote || '').trim(),
      validade: semValidade ? '' : formatPtBrDate(validadeDate),
      embalagem: embalagemLabel,
      qty: qtyInt,
      factor: factorInt,
      effectiveQty,
      packaging: packaging || { id: 'un', label: 'UN', factor: 1 },
      editMode,
    };

    navigation.navigate({
      name: targetScreen,
      params: { scanConfirm: payload },
      merge: true,
    });
  };

  return (
    <ScreenLayout
      isDarkMode={isDarkMode}
      lightBackground={colors.background}
      darkBackground={colors.background}
      contentStyle={styles.content}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{item?.description || 'Produto'}</Text>
              <Text style={styles.subtitle}>
                {item?.code || '-'} {scannedValue ? `| Lido: ${scannedValue}` : ''}
              </Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaPill}>
              <Text style={styles.metaKey}>EAN</Text>
              <Text style={styles.metaVal}>{packaging?.ean || item?.ean || '-'}</Text>
            </View>
            <View style={styles.metaPill}>
              <Text style={styles.metaKey}>DUN</Text>
              <Text style={styles.metaVal}>{packaging?.dun || item?.dun || '-'}</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Embalagem</Text>
          <View style={styles.chipRow}>
            {(Array.isArray(item?.packagingOptions) ? item.packagingOptions : []).map((opt) => {
              const active = opt?.id && packaging?.id === opt.id;
              return (
                <Pressable
                  key={String(opt.id || opt.label)}
                  onPress={() => handleSelectPackaging(opt)}
                  style={[
                    styles.chip,
                    active && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                >
                  <Text style={[styles.chipText, active && { color: colors.onPrimary }]}>
                    {opt.label} x{opt.factor}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>
              <MaterialIcons name="confirmation-number" size={16} color={colors.textMuted} /> Lote
            </Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Informe o lote (opcional)"
                placeholderTextColor={colors.textMuted}
                value={lote}
                onChangeText={setLote}
              />
            </View>
          </View>

          <View style={styles.fieldBlock}>
            <View style={styles.fieldLabelRow}>
              <Text style={styles.fieldLabel}>
                <MaterialIcons name="event" size={16} color={colors.textMuted} /> Validade
              </Text>
              <Pressable
                style={styles.semValidadeToggle}
                onPress={toggleSemValidade}
                hitSlop={6}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: semValidade }}
                accessibilityLabel="Produto sem validade"
              >
                <MaterialIcons
                  name={semValidade ? 'check-box' : 'check-box-outline-blank'}
                  size={18}
                  color={semValidade ? colors.primary : colors.textMuted}
                />
                <Text style={[styles.semValidadeText, semValidade && { color: colors.primary }]}>Sem validade</Text>
              </Pressable>
            </View>
            {semValidade ? (
              <View style={[styles.inputContainer, styles.inputDisabled]}>
                <Text style={[styles.inputText, { color: colors.textMuted }]}>Produto sem validade</Text>
                <MaterialIcons name="event-busy" size={18} color={colors.textMuted} />
              </View>
            ) : (
              <Pressable style={styles.inputContainer} onPress={toggleDatePicker}>
                <Text style={styles.inputText}>{formatPtBrDate(validadeDate) || 'Selecione a data'}</Text>
                <MaterialIcons name="calendar-month" size={18} color={colors.textMuted} />
              </Pressable>
            )}
          </View>

          {showDatePicker ? (
            <View style={styles.datePickerWrap}>
              <DateTimePicker
                value={Platform.OS === 'ios' ? validadeDraftDate : validadeDate}
                mode="date"
                display="spinner"
                onChange={onChangeDate}
                minimumDate={new Date()}
                locale="pt-BR"
              />
              {Platform.OS === 'ios' ? (
                <View style={styles.dateActionsRow}>
                  <Pressable style={styles.dateSecondaryButton} onPress={cancelDatePicker}>
                    <Text style={styles.dateSecondaryButtonText}>Cancelar</Text>
                  </Pressable>
                  <Pressable style={styles.datePrimaryButton} onPress={confirmDatePicker}>
                    <Text style={styles.datePrimaryButtonText}>Confirmar</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>
              <MaterialIcons name="tag" size={16} color={colors.textMuted} /> Quantidade ({embalagemLabel || 'UN'})
            </Text>
            <View style={styles.qtyStepperRow}>
              <Pressable
                style={[styles.qtyStepBtn, qtyInt <= 1 && styles.qtyStepBtnDisabled]}
                onPress={() => setQty(String(Math.max(1, qtyInt - 1)))}
                disabled={qtyInt <= 1}
                accessibilityRole="button"
                accessibilityLabel="Diminuir quantidade"
              >
                <MaterialIcons name="remove" size={22} color={qtyInt <= 1 ? colors.textMuted : colors.primary} />
              </Pressable>
              <TextInput
                style={styles.qtyStepInput}
                placeholder="1"
                placeholderTextColor={colors.textMuted}
                value={qty}
                onChangeText={(v) => setQty(String(v || '').replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                returnKeyType="done"
                textAlign="center"
                selectTextOnFocus
              />
              <Pressable
                style={styles.qtyStepBtn}
                onPress={() => setQty(String(qtyInt + 1))}
                accessibilityRole="button"
                accessibilityLabel="Aumentar quantidade"
              >
                <MaterialIcons name="add" size={22} color={colors.primary} />
              </Pressable>
            </View>
          </View>

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total a lançar</Text>
            <Text style={styles.totalValue}>{effectiveQty}</Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <Pressable style={styles.secondaryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.secondaryButtonText}>Cancelar</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={confirm}>
            <MaterialIcons name="check-circle" size={18} color={colors.onPrimary} />
            <Text style={styles.primaryButtonText}>Confirmar leitura</Text>
          </Pressable>
        </View>
      </ScrollView>
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
      paddingBottom: 24,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.10,
      shadowRadius: 18,
      elevation: 4,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: 10,
    },
    scanSummaryRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    scanSummaryPill: {
      flex: 1,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 9,
      backgroundColor: colors.surface2,
      borderWidth: 1,
      borderColor: colors.border,
    },
    scanSummaryPillAccent: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    scanSummaryLabel: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase',
    },
    scanSummaryLabelAccent: {
      color: 'rgba(255,255,255,0.8)',
    },
    scanSummaryValue: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '900',
      marginTop: 4,
    },
    scanSummaryValueAccent: {
      color: colors.onPrimary,
    },
    title: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '900',
    },
    subtitle: {
      marginTop: 2,
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    metaRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    metaPill: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface2,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    metaKey: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase',
    },
    metaVal: {
      marginTop: 2,
      color: colors.text,
      fontSize: 12,
      fontWeight: '800',
    },
    sectionLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '800',
      marginBottom: 6,
    },
    chipRow: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
      marginBottom: 12,
    },
    chip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface2,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    chipText: {
      color: colors.text,
      fontWeight: '800',
      fontSize: 12,
    },
    formRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 10,
    },
    formCol: {
      flex: 1,
    },
    qtyCol: {
      width: 92,
    },
    fieldLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '800',
      marginBottom: 6,
    },
    inputContainer: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBg,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    input: {
      flex: 1,
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
      padding: 0,
      margin: 0,
    },
    inputText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
    },
    qtyInput: {
      textAlign: 'center',
    },
    fieldBlock: {
      marginBottom: 12,
    },
    fieldLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    semValidadeToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: 2,
    },
    semValidadeText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '800',
    },
    inputDisabled: {
      backgroundColor: colors.surface2,
      borderStyle: 'dashed',
    },
    qtyStepperRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    qtyStepBtn: {
      width: 50,
      height: 50,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface2,
    },
    qtyStepBtnDisabled: {
      opacity: 0.5,
    },
    qtyStepInput: {
      flex: 1,
      height: 50,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 14,
      backgroundColor: colors.inputBg,
      color: colors.text,
      fontSize: 22,
      fontWeight: '900',
      textAlign: 'center',
      paddingVertical: 0,
    },
    totalRow: {
      marginTop: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderTopWidth: 1,
      borderTopColor: colors.divider,
      paddingTop: 10,
    },
    totalLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '800',
    },
    totalValue: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '900',
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 12,
    },
    datePickerWrap: {
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface2,
      borderRadius: 14,
      overflow: 'hidden',
    },
    dateActionsRow: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 10,
      paddingBottom: 10,
      paddingTop: 6,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    dateSecondaryButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dateSecondaryButtonText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '900',
    },
    datePrimaryButton: {
      flex: 1,
      borderRadius: 12,
      backgroundColor: colors.primary,
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    datePrimaryButtonText: {
      color: colors.onPrimary,
      fontSize: 13,
      fontWeight: '900',
    },
    secondaryButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface2,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '900',
    },
    primaryButton: {
      flex: 1.35,
      borderRadius: 12,
      backgroundColor: colors.primary,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    primaryButtonText: {
      color: colors.onPrimary,
      fontSize: 13,
      fontWeight: '900',
    },
  });

export default ConferenciaScanScreen;
