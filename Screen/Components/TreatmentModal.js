import React from 'react';
import { View, Text, Modal, TextInput, Pressable, StyleSheet } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const getModalStyles = (isDarkMode) => StyleSheet.create({
  quantitySection: {
    backgroundColor: isDarkMode ? '#2A2A2A' : '#F5F5F5',
    borderRadius: 15,
    padding: 16,
    marginBottom: 20,
  },
});

const TreatmentModal = ({ 
  visible, 
  onClose, 
  onTreat, 
  selectedProduct, 
  isDarkMode,
  quantity,
  onQuantityChange 
}) => {
  const modalStyles = getModalStyles(isDarkMode);

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalView, isDarkMode && styles.darkModalView]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isDarkMode && styles.darkText]}>
              Tratativa de Produto
            </Text>
            <Text style={[styles.productName, isDarkMode && { color: '#999' }]} numberOfLines={1}>
              {selectedProduct?.descricao}
            </Text>
          </View>

          <View style={[modalStyles.quantitySection, isDarkMode && styles.darkQuantitySection]}>
            <View style={styles.quantityInfo}>
              <Text style={[styles.quantityLabel, isDarkMode && { color: '#999' }]}>Estoque Atual:</Text>
              <Text style={[styles.quantityValue, isDarkMode && styles.darkText]}>{selectedProduct?.quantidade || 0} unidades</Text>
            </View>
            <View style={styles.quantityInputWrapper}>
              <Text style={[styles.quantityInputLabel, isDarkMode && { color: '#999' }]}>Quantidade a tratar:</Text>
              <TextInput
                style={[styles.quantityInput, isDarkMode && styles.darkQuantityInput]}
                value={quantity}
                onChangeText={onQuantityChange}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={isDarkMode ? '#666' : '#999'}
                textAlign="center"
              />
            </View>
          </View>

          <View style={styles.buttonsContainer}>
            <Pressable style={[styles.treatmentButton, styles.sellButton]} onPress={() => onTreat(selectedProduct, 'sold')}>
              <MaterialIcons name="shopping-cart" size={24} color="#FFF" />
              <Text style={styles.treatmentButtonText}>Vendido</Text>
            </Pressable>
            <Pressable style={[styles.treatmentButton, styles.exchangeButton]} onPress={() => onTreat(selectedProduct, 'exchanged')}>
              <MaterialIcons name="swap-horiz" size={24} color="#FFF" />
              <Text style={styles.treatmentButtonText}>Trocado</Text>
            </Pressable>
            <Pressable style={[styles.treatmentButton, styles.returnButton]} onPress={() => onTreat(selectedProduct, 'returned')}>
              <MaterialIcons name="assignment-return" size={24} color="#FFF" />
              <Text style={styles.treatmentButtonText}>Devolvido</Text>
            </Pressable>
            <Pressable style={[styles.treatmentButton, styles.expiredButton]} onPress={() => onTreat(selectedProduct, 'expired')}>
              <MaterialIcons name="error" size={24} color="#FFF" />
              <Text style={styles.treatmentButtonText}>Vencido</Text>
            </Pressable>
          </View>

          <Pressable
            style={[styles.treatmentCancelButton, isDarkMode && styles.darkTreatmentCancelButton]}
            onPress={onClose}
          >
            <Text style={styles.treatmentCancelButtonText}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalView: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'stretch',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
  },
  darkModalView: {
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#333',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  productName: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  darkText: {
    color: '#EAEAEA',
  },
  darkQuantitySection: {
    backgroundColor: '#2A2A2A',
  },
  quantityInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  quantityLabel: {
    fontSize: 16,
    color: '#666',
  },
  quantityValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  quantityInputWrapper: {
    alignItems: 'center',
  },
  quantityInputLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  quantityInput: {
    width: '50%',
    height: 50,
    backgroundColor: '#FFF',
    borderRadius: 12,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#333',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  darkQuantityInput: {
    backgroundColor: '#333',
    color: '#FFF',
    borderColor: '#404040',
  },
  buttonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 20,
  },
  treatmentButton: {
    width: '48%',
    height: 80,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    padding: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  sellButton: {
    backgroundColor: '#4CAF50',
  },
  exchangeButton: {
    backgroundColor: '#2196F3',
  },
  returnButton: {
    backgroundColor: '#FF9800',
  },
  expiredButton: {
    backgroundColor: '#FF5252',
  },
  treatmentButtonText: {
    color: '#FFF',
    marginTop: 8,
    fontWeight: '600',
  },
  treatmentCancelButton: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#757575',
    alignItems: 'center',
    marginTop: 16,
    width: '100%',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  darkTreatmentCancelButton: {
    backgroundColor: '#424242',
    borderWidth: 1,
    borderColor: '#505050',
  },
  treatmentCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default TreatmentModal; 
