import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const ModalProdDash = ({ item, isDarkMode, highlight }) => {
  const daysRemaining = (() => {
    const today = new Date();
    const target = new Date(item.validade);
    const diff = target - today;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  })();
  const isUrgent = highlight || daysRemaining <= 7;
  const styles = getStyles(isDarkMode);

  return (
    <View style={[
      styles.modalProductCard,
      isUrgent && { borderColor: '#DC3545', backgroundColor: isDarkMode ? '#23191a' : '#fff6f6' }
    ]}>
      <View style={styles.modalProductHeader}>
        <View style={[styles.modalProductIconCircle, isUrgent && { backgroundColor: '#ffeaea' }]}> 
          <MaterialIcons 
            name={isUrgent ? 'warning' : 'schedule'} 
            size={18} 
            color={isUrgent ? '#DC3545' : '#FFC107'} 
          />
        </View>
        <Text style={[styles.modalProductDays, isUrgent && { color: '#DC3545' }]}> 
          {daysRemaining} {daysRemaining === 1 ? 'dia' : 'dias'}
        </Text>
      </View>
      <Text style={styles.modalProductName} numberOfLines={2}>
        {item.descricao}
      </Text>
      <Text style={styles.modalProductDetails}>
        Qtd: {item.quantidade} | Lote: {item.lote}
      </Text>
    </View>
  );
};

const getStyles = (isDarkMode) => StyleSheet.create({
  modalProductCard: {
    flexDirection: 'column',
    marginBottom: 14,
    padding: 16,
    borderRadius: 14,
    backgroundColor: isDarkMode ? '#181A20' : '#fff',
    borderWidth: 1.2,
    borderColor: isDarkMode ? '#23262F' : '#e0e0e0',
  },
  modalProductHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalProductIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fffbe6',
    marginRight: 6,
  },
  modalProductDays: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#FFC107',
  },
  modalProductName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
    color: isDarkMode ? '#fff' : '#222',
  },
  modalProductDetails: {
    fontSize: 13,
    color: isDarkMode ? '#B0B3B8' : '#888',
  },
});

export default ModalProdDash; 