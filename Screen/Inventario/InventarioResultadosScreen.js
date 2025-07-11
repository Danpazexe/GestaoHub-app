import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';

const InventarioResultadosScreen = ({ navigation, isDarkMode }) => (
  <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? '#181A20' : '#f8fafc' }]}>  
    <Text style={[styles.title, { color: isDarkMode ? '#fff' : '#222' }]}>Resultados do Inventário</Text>
    <Text style={[styles.text, { color: isDarkMode ? '#ccc' : '#444' }]}>Tela de resultados em construção.</Text>
    <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
      <Text style={styles.buttonText}>Voltar</Text>
    </TouchableOpacity>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 16 },
  text: { fontSize: 16, marginBottom: 32 },
  button: { backgroundColor: '#7c3aed', padding: 12, borderRadius: 8 },
  buttonText: { color: '#fff', fontWeight: 'bold' },
});

export default InventarioResultadosScreen; 