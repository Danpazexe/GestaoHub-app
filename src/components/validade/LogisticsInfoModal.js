import React from 'react';
import { Modal, View, Text, StyleSheet, Pressable } from 'react-native';
import * as Animatable from 'react-native-animatable';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { CORESPRODUCTITEM } from '../coresAuth';
import {
  DEFAULT_LOGISTICS_LOCATION_CONFIG,
  getLogisticsLocationInfoItems,
} from '../../features/validade/constants/logisticsLocation';

const COLORS = CORESPRODUCTITEM;
const ACCENT = COLORS.badgeFuture; // azul de marca usado no ícone do header

const LogisticsInfoModal = ({
  visible,
  onClose,
  product,
  isDarkMode,
  locationConfig = DEFAULT_LOGISTICS_LOCATION_CONFIG,
}) => {
  const locationInfoItems = getLogisticsLocationInfoItems(product?.location, locationConfig);
  const codprod = product?.codprod ? String(product.codprod) : '';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={[styles.backdrop, isDarkMode && styles.darkBackdrop]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Fechar localização logística"
      >
        <Animatable.View
          animation="zoomIn"
          duration={220}
          easing="ease-out"
          useNativeDriver
          style={styles.cardAnim}
        >
          {/* Pressable interno engole o toque para não fechar ao tocar no card */}
          <Pressable style={[styles.card, isDarkMode && styles.darkCard]} onPress={() => {}}>
            <View style={styles.header}>
              <View style={styles.titleRow}>
                <View style={[styles.iconWrap, isDarkMode && styles.darkIconWrap]}>
                  <MaterialIcons name="inventory-2" size={18} color={ACCENT} />
                </View>
                <View style={styles.titleTextWrap}>
                  <Text style={[styles.title, isDarkMode && styles.darkTitle]} numberOfLines={1}>
                    Localização logística
                  </Text>
                  <View style={styles.metaRow}>
                    {codprod ? (
                      <View style={[styles.codeChip, isDarkMode && styles.darkCodeChip]}>
                        <Text
                          style={[styles.codeChipText, isDarkMode && styles.darkCodeChipText]}
                          numberOfLines={1}
                        >
                          Cód. {codprod}
                        </Text>
                      </View>
                    ) : null}
                    <Text
                      style={[styles.subtitle, isDarkMode && styles.darkSubtitle]}
                      numberOfLines={1}
                    >
                      {product?.descricao || 'Produto'}
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
                <MaterialIcons
                  name="close"
                  size={20}
                  color={isDarkMode ? COLORS.titleDark : COLORS.title}
                />
              </Pressable>
            </View>

            {locationInfoItems.length === 0 ? (
              <View style={[styles.emptyState, isDarkMode && styles.darkEmptyState]}>
                <MaterialIcons
                  name="location-off"
                  size={26}
                  color={isDarkMode ? COLORS.labelDark : COLORS.label}
                />
                <Text style={[styles.emptyTitle, isDarkMode && styles.darkLabel]}>
                  Sem localização cadastrada
                </Text>
                <Text style={[styles.emptySubtitle, isDarkMode && styles.darkSubtitle]}>
                  Este produto ainda não tem endereço logístico definido.
                </Text>
              </View>
            ) : (
              <View style={styles.list}>
                {locationInfoItems.map((item, index) => {
                  const isLast = index === locationInfoItems.length - 1;

                  if (item.isObservation) {
                    return (
                      <View
                        key={`${codprod || 'produto'}-location-${item.key}`}
                        style={[styles.noteCard, isDarkMode && styles.darkNoteCard, !isLast && styles.noteSpacing]}
                      >
                        <View style={styles.noteHeader}>
                          <MaterialIcons
                            name={item.icon || 'notes'}
                            size={16}
                            color={isDarkMode ? '#cfe0ff' : ACCENT}
                          />
                          <Text style={[styles.noteLabel, isDarkMode && styles.darkNoteLabel]}>
                            {item.label}
                          </Text>
                        </View>
                        <Text style={[styles.noteValue, isDarkMode && styles.darkNoteValue]}>
                          {item.value}
                        </Text>
                      </View>
                    );
                  }

                  return (
                    <View
                      key={`${codprod || 'produto'}-location-${item.key}`}
                      style={[styles.row, !isLast && styles.rowSpacing]}
                    >
                      <View style={[styles.rowIcon, isDarkMode && styles.darkRowIcon]}>
                        <MaterialIcons
                          name={item.icon || 'place'}
                          size={18}
                          color={isDarkMode ? '#cfe0ff' : ACCENT}
                        />
                      </View>
                      <Text style={[styles.label, isDarkMode && styles.darkLabel]} numberOfLines={1}>
                        {item.label}
                      </Text>
                      <View style={[styles.valuePill, isDarkMode && styles.darkValuePill]}>
                        <Text style={[styles.valueText, isDarkMode && styles.darkValueText]} numberOfLines={1}>
                          {item.value}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </Pressable>
        </Animatable.View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  darkBackdrop: {
    backgroundColor: 'rgba(10, 14, 30, 0.62)',
  },
  cardAnim: {
    width: '100%',
    maxWidth: 360,
  },
  card: {
    width: '100%',
    borderRadius: 24,
    padding: 18,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.10)',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
    elevation: 14,
  },
  darkCard: {
    backgroundColor: COLORS.cardDark,
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
    backgroundColor: 'rgba(59, 130, 246, 0.10)',
    marginRight: 10,
  },
  darkIconWrap: {
    backgroundColor: 'rgba(147, 197, 253, 0.16)',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.title,
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
    backgroundColor: 'rgba(59, 130, 246, 0.10)',
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
    color: COLORS.label,
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
    borderColor: 'rgba(59, 130, 246, 0.12)',
  },
  darkCloseButton: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  list: {
    marginTop: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 54,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
  },
  rowSpacing: {
    marginBottom: 8,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.10)',
  },
  darkRowIcon: {
    backgroundColor: 'rgba(147, 197, 253, 0.16)',
  },
  label: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.label,
  },
  darkLabel: {
    color: COLORS.labelDark,
  },
  valuePill: {
    minWidth: 40,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.10)',
  },
  darkValuePill: {
    backgroundColor: 'rgba(147, 197, 253, 0.16)',
  },
  valueText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  darkValueText: {
    color: '#cfe0ff',
  },
  noteCard: {
    marginTop: 2,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.10)',
  },
  darkNoteCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  noteSpacing: {
    marginBottom: 8,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  noteLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    color: COLORS.label,
  },
  darkNoteLabel: {
    color: COLORS.labelDark,
  },
  noteValue: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: COLORS.title,
  },
  darkNoteValue: {
    color: COLORS.valueDark,
  },
  emptyState: {
    marginTop: 16,
    paddingVertical: 26,
    paddingHorizontal: 18,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.08)',
  },
  darkEmptyState: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.label,
  },
  emptySubtitle: {
    marginTop: 4,
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
    color: COLORS.label,
  },
});

export default LogisticsInfoModal;
