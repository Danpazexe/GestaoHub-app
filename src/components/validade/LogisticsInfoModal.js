import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { CORESPRODUCTITEM } from '../coresAuth';
import {
  DEFAULT_LOGISTICS_LOCATION_CONFIG,
  getLogisticsLocationInfoItems,
} from '../../features/validade/constants/logisticsLocation';

const COLORS = CORESPRODUCTITEM;

const LogisticsInfoModal = ({
  visible,
  onClose,
  product,
  isDarkMode,
  locationConfig = DEFAULT_LOGISTICS_LOCATION_CONFIG,
}) => {
  const locationInfoItems = getLogisticsLocationInfoItems(product?.location, locationConfig);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, isDarkMode && styles.darkBackdrop]}>
        <View style={[styles.card, isDarkMode && styles.darkCard]}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={[styles.iconWrap, isDarkMode && styles.darkIconWrap]}>
                <MaterialIcons name="inventory-2" size={18} color={COLORS.badgeFuture} />
              </View>
              <Text style={[styles.title, isDarkMode && styles.darkTitle]}>
                Localização logística
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.closeButton, isDarkMode && styles.darkCloseButton]}
              onPress={onClose}
              activeOpacity={0.85}
            >
              <MaterialIcons
                name="close"
                size={20}
                color={isDarkMode ? COLORS.titleDark : COLORS.title}
              />
            </TouchableOpacity>
          </View>

          <Text style={[styles.subtitle, isDarkMode && styles.darkSubtitle]} numberOfLines={2}>
            {product?.descricao || 'Produto'}
          </Text>

          <View style={[styles.list, isDarkMode && styles.darkList]}>
            {locationInfoItems.map((item, index) => {
              const isLast = index === locationInfoItems.length - 1;

              return (
                <View
                  key={`${product?.id || product?.codprod || 'produto'}-location-${item.key}`}
                  style={[
                    styles.row,
                    item.isObservation && styles.observationRow,
                    !isLast && styles.rowDivider,
                    !isLast && (isDarkMode ? styles.darkRowDivider : styles.lightRowDivider),
                  ]}
                >
                  <Text style={[styles.label, isDarkMode && styles.darkLabel]}>
                    {item.label}
                  </Text>
                  <Text
                    style={[
                      styles.value,
                      isDarkMode && styles.darkValue,
                      item.isObservation && styles.observationValue,
                    ]}
                  >
                    {item.value}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
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
  card: {
    width: '100%',
    maxWidth: 360,
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
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.title,
  },
  darkTitle: {
    color: COLORS.titleDark,
  },
  closeButton: {
    width: 44,
    height: 44,
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
  subtitle: {
    marginTop: 10,
    marginBottom: 14,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '700',
    color: COLORS.label,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  darkSubtitle: {
    color: COLORS.labelDark,
  },
  list: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.08)',
  },
  darkList: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 58,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  observationRow: {
    alignItems: 'flex-start',
    flexDirection: 'column',
  },
  rowDivider: {
    borderBottomWidth: 1,
  },
  lightRowDivider: {
    borderBottomColor: 'rgba(46,53,84,0.08)',
  },
  darkRowDivider: {
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.label,
  },
  darkLabel: {
    color: COLORS.labelDark,
  },
  value: {
    flex: 1,
    textAlign: 'right',
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.title,
  },
  darkValue: {
    color: COLORS.valueDark,
  },
  observationValue: {
    textAlign: 'left',
    lineHeight: 20,
    marginTop: 4,
    fontSize: 14,
  },
});

export default LogisticsInfoModal;
