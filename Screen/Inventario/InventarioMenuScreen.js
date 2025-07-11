import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const menuOptions = [
  {
    label: 'Criar e Lançar Inventário',
    icon: 'add-box',
    screen: 'InventarioCriarScreen',
    enabled: true,
  },
  {
    label: 'Resultados',
    icon: 'assessment',
    screen: 'InventarioResultadosScreen',
    enabled: true,
    
  },
];

const InventarioMenuScreen = ({ navigation, isDarkMode }) => {
  const [userName, setUserName] = useState('Usuário');

  useEffect(() => {
    const loadUserName = async () => {
      try {
        const userData = await AsyncStorage.getItem('userData');
        if (userData) {
          const user = JSON.parse(userData);
          if (user.name) {
            setUserName(user.name);
          }
        }
      } catch (e) {
        setUserName('Usuário');
      }
    };
    loadUserName();
  }, []);

  useEffect(() => {
    navigation.setOptions({
      headerTitle: 'Inventário',
      headerTitleStyle: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 22,
      },
      headerStyle: {
        backgroundColor: '#7c3aed',
        shadowColor: 'transparent',
        elevation: 0,
      },
      headerTintColor: '#fff',
    });
  }, [navigation]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? '#181A20' : '#f8fafc' }]}>  
      {/* Título removido conforme solicitado */}
      <View style={styles.menuList}>
        {menuOptions.map((option, idx) => {
          const disabled = !option.enabled;
          return (
            <TouchableOpacity
              key={option.label}
              style={[
                styles.menuItem,
                { backgroundColor: isDarkMode ? '#23262F' : '#fff' },
                disabled && styles.menuItemDisabled
              ]}
              onPress={() => !disabled && navigation.navigate(option.screen)}
              activeOpacity={disabled ? 1 : 0.7}
              disabled={disabled}
            >
              <MaterialIcons name={option.icon} size={28} color={disabled ? '#bbb' : '#7c3aed'} />
              <Text style={[
                styles.menuLabel,
                { color: disabled ? '#bbb' : (isDarkMode ? '#fff' : '#222') }
              ]}>{option.label}</Text>
              <MaterialIcons name="chevron-right" size={24} color={disabled ? '#bbb' : (isDarkMode ? '#fff' : '#222')} />
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.footer}>
        <Text style={{ color: '#7c3aed', fontSize: 12 }}>{userName}</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 32,
    paddingHorizontal: 0,
  },
  menuList: {
    flex: 1,
    paddingHorizontal: 0,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 22,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    borderRadius: 0,
    marginBottom: 0,
  },
  menuItemDisabled: {
    opacity: 0.5,
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
    marginLeft: 18,
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
});

export default InventarioMenuScreen; 