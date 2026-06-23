import React from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  Pressable,
  StyleSheet,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { CORESPRODUCTITEM } from '../coresAuth';
import haptics from '../../utils/haptics';

const COLORS = CORESPRODUCTITEM;

// Ações de tratativa: cor semântica alinhada à paleta de badges do app
// (verde=venda, azul=troca, laranja=devolução, vermelho=vencido).
const TREATMENT_ACTIONS = [
  { type: 'sold', label: 'Vendido', icon: 'shopping-cart', color: '#16a34a' },
  { type: 'exchanged', label: 'Trocado', icon: 'swap-horiz', color: '#2563eb' },
  { type: 'returned', label: 'Devolvido', icon: 'assignment-return', color: '#ea580c' },
  { type: 'expired', label: 'Vencido', icon: 'event-busy', color: '#dc2626' },
];

const TreatmentModal = ({
  visible,
  onClose,
  onTreat,
  selectedProduct,
  isDarkMode,
  quantity,
  onQuantityChange,
}) => {
  const stock = Number(selectedProduct?.quantidade) || 0;
  const noStock = stock <= 0;
  const codprod = selectedProduct?.codprod ? String(selectedProduct.codprod) : '';

  const parsed = parseInt(quantity, 10);
  const current = Number.isNaN(parsed) ? 0 : parsed;
  const isValid = current >= 1 && current <= stock;
  const remaining = stock - current;

  const stepperEnabledColor = isDarkMode ? '#93c5fd' : '#2563eb';
  const stepperDisabledColor = isDarkMode ? '#5b6478' : '#B0B0B0';

  const commit = (next) => {
    onQuantityChange(String(Math.max(0, Math.min(stock, next))));
  };

  const handleText = (text) => {
    const digits = text.replace(/\D/g, '');
    if (digits === '') {
      onQuantityChange('');
      return;
    }
    onQuantityChange(String(Math.min(stock, parseInt(digits, 10))));
  };

  // Steppers e "Tudo" só são chamados quando habilitados (clamp em commit é
  // a rede de segurança), por isso não há ramo de "limite" aqui.
  const handleDecrement = () => {
    haptics.selection();
    commit(current - 1);
  };

  const handleIncrement = () => {
    haptics.selection();
    commit(current + 1);
  };

  const handleSetAll = () => {
    haptics.selection();
    commit(stock);
  };

  const handleTreat = (type) => {
    if (!isValid) {
      haptics.error();
      return;
    }
    haptics.success();
    onTreat(selectedProduct, type);
  };

  let hintText = `Restará ${remaining} un. em estoque`;
  if (noStock) {
    hintText = 'Sem estoque disponível para tratar';
  } else if (!isValid) {
    hintText = `Informe uma quantidade entre 1 e ${stock}`;
  } else if (remaining === 0) {
    hintText = 'Tratará todo o estoque deste item';
  }

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={[styles.overlay, isDarkMode && styles.darkOverlay]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fechar tratativa"
        >
          <Animatable.View animation="zoomIn" duration={220} easing="ease-out" useNativeDriver style={styles.cardAnim}>
            {/* onPress dispensa o teclado (number-pad não tem tecla Concluir) e
                engole o toque para não fechar o modal ao tocar no card. */}
            <Pressable style={[styles.card, isDarkMode && styles.darkCard]} onPress={Keyboard.dismiss}>
              <View style={styles.header}>
                <View style={styles.titleRow}>
                  <View style={[styles.iconWrap, isDarkMode && styles.darkIconWrap]}>
                    <MaterialIcons name="fact-check" size={18} color="#2563eb" />
                  </View>
                  <View style={styles.titleTextWrap}>
                    <Text style={[styles.title, isDarkMode && styles.darkTitle]} numberOfLines={1}>
                      Tratativa de Produto
                    </Text>
                    <View style={styles.metaRow}>
                      {codprod ? (
                        <View style={[styles.codeChip, isDarkMode && styles.darkCodeChip]}>
                          <Text style={[styles.codeChipText, isDarkMode && styles.darkCodeChipText]} numberOfLines={1}>
                            Cód. {codprod}
                          </Text>
                        </View>
                      ) : null}
                      <Text style={[styles.subtitle, isDarkMode && styles.darkSubtitle]} numberOfLines={1}>
                        {selectedProduct?.descricao || 'Produto'}
                      </Text>
                    </View>
                  </View>
                </View>
                <Pressable
                  style={[styles.closeButton, isDarkMode && styles.darkCloseButton]}
                  onPress={onClose}
                  accessibilityRole="button"
                  accessibilityLabel="Fechar"
                  hitSlop={8}
                >
                  <MaterialIcons name="close" size={20} color={isDarkMode ? COLORS.titleDark : '#37474f'} />
                </Pressable>
              </View>

              <View style={[styles.quantitySection, isDarkMode && styles.darkQuantitySection]}>
                <View style={styles.stockRow}>
                  <Text style={[styles.stockLabel, isDarkMode && styles.darkMuted]}>Estoque atual</Text>
                  <Text style={[styles.stockValue, isDarkMode && styles.darkTitle]}>{stock} un.</Text>
                </View>

                <Text style={[styles.stepperCaption, isDarkMode && styles.darkMuted]}>Quantidade a tratar</Text>
                <View style={styles.stepperRow}>
                  <Pressable
                    style={[styles.stepperButton, isDarkMode && styles.darkStepperButton, current <= 1 && styles.stepperButtonDisabled]}
                    onPress={handleDecrement}
                    disabled={current <= 1}
                    accessibilityRole="button"
                    accessibilityLabel="Diminuir quantidade"
                    accessibilityState={{ disabled: current <= 1 }}
                    hitSlop={6}
                  >
                    <MaterialIcons name="remove" size={24} color={current <= 1 ? stepperDisabledColor : stepperEnabledColor} />
                  </Pressable>

                  <TextInput
                    style={[styles.quantityInput, isDarkMode && styles.darkQuantityInput, !isValid && styles.quantityInputInvalid]}
                    value={quantity}
                    onChangeText={handleText}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={isDarkMode ? '#666' : '#B0B0B0'}
                    textAlign="center"
                    maxLength={6}
                    selectTextOnFocus
                    accessibilityLabel="Quantidade a tratar"
                  />

                  <Pressable
                    style={[styles.stepperButton, isDarkMode && styles.darkStepperButton, current >= stock && styles.stepperButtonDisabled]}
                    onPress={handleIncrement}
                    disabled={current >= stock}
                    accessibilityRole="button"
                    accessibilityLabel="Aumentar quantidade"
                    accessibilityState={{ disabled: current >= stock }}
                    hitSlop={6}
                  >
                    <MaterialIcons name="add" size={24} color={current >= stock ? stepperDisabledColor : stepperEnabledColor} />
                  </Pressable>

                  <Pressable
                    style={[
                      styles.allChip,
                      isDarkMode && styles.darkAllChip,
                      !noStock && current >= stock && styles.allChipActive,
                      noStock && styles.stepperButtonDisabled,
                    ]}
                    onPress={handleSetAll}
                    disabled={noStock}
                    accessibilityRole="button"
                    accessibilityLabel={`Tratar tudo, ${stock} unidades`}
                    accessibilityState={{ disabled: noStock, selected: !noStock && current >= stock }}
                    hitSlop={6}
                  >
                    <Text
                      style={[
                        styles.allChipText,
                        isDarkMode && styles.darkAllChipText,
                        !noStock && current >= stock && styles.allChipTextActive,
                      ]}
                    >
                      Tudo
                    </Text>
                  </Pressable>
                </View>

                <Text
                  style={[styles.hint, isDarkMode && styles.darkMuted, !isValid && styles.hintInvalid]}
                  accessibilityLiveRegion="polite"
                >
                  {hintText}
                </Text>
              </View>

              <View style={styles.buttonsContainer}>
                {TREATMENT_ACTIONS.map((action) => (
                  <Pressable
                    key={action.type}
                    style={({ pressed }) => [
                      styles.treatmentButton,
                      { backgroundColor: action.color },
                      !isValid && styles.treatmentButtonDisabled,
                      pressed && isValid && styles.treatmentButtonPressed,
                    ]}
                    onPress={() => handleTreat(action.type)}
                    disabled={!isValid}
                    accessibilityRole="button"
                    accessibilityLabel={`${action.label}, ${current} unidades`}
                    accessibilityState={{ disabled: !isValid }}
                  >
                    <View style={styles.treatmentIconCircle}>
                      <MaterialIcons name={action.icon} size={22} color="#FFF" />
                    </View>
                    <Text style={styles.treatmentButtonText}>{action.label}</Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                style={[styles.cancelButton, isDarkMode && styles.darkCancelButton]}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Cancelar"
              >
                <Text style={[styles.cancelButtonText, isDarkMode && styles.darkCancelButtonText]}>Cancelar</Text>
              </Pressable>
            </Pressable>
          </Animatable.View>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  darkOverlay: {
    backgroundColor: 'rgba(10, 14, 30, 0.66)',
  },
  cardAnim: {
    width: '100%',
    maxWidth: 380,
  },
  card: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 22,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 12,
  },
  darkCard: {
    backgroundColor: COLORS.cardDark,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12,
  },
  titleTextWrap: {
    flex: 1,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(37, 99, 235, 0.10)',
    marginRight: 10,
  },
  darkIconWrap: {
    backgroundColor: 'rgba(147, 197, 253, 0.16)',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1f2a37',
  },
  darkTitle: {
    color: COLORS.titleDark,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  codeChip: {
    flexShrink: 0,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(37, 99, 235, 0.10)',
  },
  darkCodeChip: {
    backgroundColor: 'rgba(147, 197, 253, 0.16)',
  },
  codeChipText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
    color: '#1d4ed8',
  },
  darkCodeChipText: {
    color: '#cfe0ff',
  },
  subtitle: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
    color: '#667085',
  },
  darkSubtitle: {
    color: COLORS.labelDark,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F7FF',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.12)',
  },
  darkCloseButton: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  quantitySection: {
    backgroundColor: '#F5F7FA',
    borderRadius: 16,
    padding: 16,
    marginTop: 18,
    marginBottom: 18,
  },
  darkQuantitySection: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stockLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667085',
  },
  stockValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1f2a37',
  },
  darkMuted: {
    color: COLORS.labelDark,
  },
  stepperCaption: {
    marginTop: 14,
    marginBottom: 8,
    textAlign: 'center',
    fontSize: 12.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: '#667085',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  stepperButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  darkStepperButton: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.10)',
  },
  stepperButtonDisabled: {
    opacity: 0.5,
  },
  quantityInput: {
    width: 96,
    height: 56,
    backgroundColor: '#FFF',
    borderRadius: 14,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    color: '#1f2a37',
    borderWidth: 1.5,
    borderColor: '#2563eb',
  },
  darkQuantityInput: {
    backgroundColor: 'rgba(0,0,0,0.22)',
    color: '#FFF',
    borderColor: '#3b82f6',
  },
  quantityInputInvalid: {
    borderColor: '#dc2626',
  },
  allChip: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(37, 99, 235, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.18)',
  },
  darkAllChip: {
    backgroundColor: 'rgba(147, 197, 253, 0.14)',
    borderColor: 'rgba(147, 197, 253, 0.22)',
  },
  allChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  allChipText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  darkAllChipText: {
    color: '#cfe0ff',
  },
  allChipTextActive: {
    color: '#FFF',
  },
  hint: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: 12.5,
    fontWeight: '600',
    color: '#667085',
  },
  hintInvalid: {
    color: '#dc2626',
    fontWeight: '700',
  },
  buttonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  treatmentButton: {
    width: '48%',
    height: 86,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
  },
  treatmentButtonPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.92,
  },
  treatmentButtonDisabled: {
    opacity: 0.45,
  },
  treatmentIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    marginBottom: 6,
  },
  treatmentButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  cancelButton: {
    marginTop: 16,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#EEF1F6',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  darkCancelButton: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475467',
  },
  darkCancelButtonText: {
    color: '#C8CCDA',
  },
});

export default TreatmentModal;
