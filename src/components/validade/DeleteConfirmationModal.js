import React from 'react';
import { View, Text, Modal, Pressable, StyleSheet } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import haptics from '../../utils/haptics';

const DeleteConfirmationModal = ({
  visible,
  onClose,
  onConfirm,
  product,
  isDarkMode
}) => (
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
            Confirmar Exclusão
          </Text>
          <Text style={[styles.productName, isDarkMode && { color: '#999' }]} numberOfLines={2}>
            {product?.descricao}
          </Text>
        </View>
        <Text style={[styles.confirmationText, isDarkMode && { color: '#999' }]}>Tem certeza que deseja excluir este produto?</Text>
        <View style={styles.confirmationButtons}>
          <Pressable
            style={styles.confirmationCancelButton}
            onPress={onClose}
            android_ripple={{ color: 'rgba(255,255,255,0.1)' }}
          >
            <MaterialIcons name="close" size={24} color="#FFF" />
            <Text style={styles.confirmationButtonText}>Cancelar</Text>
          </Pressable>
          <Pressable
            style={styles.confirmationDeleteButton}
            onPress={() => { haptics.warning(); onConfirm(); }}
            android_ripple={{ color: 'rgba(255,255,255,0.1)' }}
          >
            <MaterialIcons name="delete" size={24} color="#FFF" />
            <Text style={styles.confirmationButtonText}>Excluir</Text>
          </Pressable>
        </View>
      </View>
    </View>
  </Modal>
);

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
  confirmationText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginVertical: 24,
    lineHeight: 24,
  },
  confirmationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 16,
  },
  confirmationCancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#757575',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  confirmationDeleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#D32F2F',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  confirmationButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default DeleteConfirmationModal; 
