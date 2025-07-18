import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, Button, Image, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firebaseAuthService from '../../services/firebaseAuthService';
import Toast from 'react-native-toast-message';

const ProfileScreen = ({ isDarkMode }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [profileImage, setProfileImage] = useState(null);

  // Função para carregar os dados salvos no AsyncStorage
  const loadProfileData = useCallback(async () => {
    try {
      const userData = await firebaseAuthService.getUserData();
      if (userData) {
        setName(userData.name || '');
        setEmail(userData.email || '');
        setProfileImage(userData.photoURL || null);
      }
    } catch (error) {
      console.error('Erro ao carregar dados do perfil:', error);
    }
  }, []);

  // Carregar os dados assim que o componente for montado
  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  // Função para salvar as alterações no Firebase
  const handleSaveChanges = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert('Erro', 'O campo Nome é obrigatório.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Erro', 'Por favor, insira um email válido.');
      return;
    }

    try {
      await firebaseAuthService.updateProfile(name.trim(), profileImage);
      
      Toast.show({
        type: 'success',
        text1: 'Sucesso!',
        text2: 'Perfil atualizado com sucesso',
      });
    } catch (error) {
      console.error('Erro ao salvar dados do perfil:', error);
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Ocorreu um erro ao salvar os dados',
      });
    }
  }, [name, profileImage]);

  // Função para selecionar uma imagem
  const handleImagePick = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.granted) {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        const selectedImageUri = result.assets[0].uri;
        setProfileImage(selectedImageUri);
        console.log('[ProfileScreen] Nova imagem de perfil selecionada:', selectedImageUri);
      } else {
        console.log('[ProfileScreen] Seleção de imagem cancelada ou nenhum arquivo válido.');
      }
    } else {
      Alert.alert('Permissão Negada', 'É necessário permitir o acesso à galeria.');
    }
  };

  return (
    <View style={[styles.container, isDarkMode ? styles.darkBackground : styles.lightBackground]}>
      <Text style={[styles.title, isDarkMode ? styles.darkText : styles.lightText]}>Perfil do Usuário</Text>
      <TouchableOpacity onPress={handleImagePick}>
        <Image
          source={profileImage ? { uri: profileImage } : require('../../assets/Perfil/default-profile.png')}
          style={styles.profileImage}
        />
        <Text style={[styles.editPhotoText, isDarkMode ? styles.darkText : styles.lightText]}>Alterar Foto</Text>
      </TouchableOpacity>
      <View style={styles.inputContainer}>
        <Text style={[styles.label, isDarkMode ? styles.darkText : styles.lightText]}>Nome</Text>
        <TextInput
          style={[styles.input, isDarkMode ? styles.darkInput : styles.lightInput]}
          value={name}
          onChangeText={setName}
          placeholder="Digite seu nome"
          placeholderTextColor={isDarkMode ? '#aaa' : '#888'}
        />
      </View>
      <View style={styles.inputContainer}>
        <Text style={[styles.label, isDarkMode ? styles.darkText : styles.lightText]}>E-mail</Text>
        <TextInput
          style={[styles.input, isDarkMode ? styles.darkInput : styles.lightInput]}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          placeholder="Digite seu e-mail"
          placeholderTextColor={isDarkMode ? '#aaa' : '#888'}
        />
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={handleSaveChanges}>
        <Text style={styles.saveButtonText}>Salvar Alterações</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  lightBackground: {
    backgroundColor: '#f5f5f5',
  },
  darkBackground: {
    backgroundColor: '#888',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  lightText: {
    color: '#333',
  },
  darkText: {
    color: '#EAEAEA',
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignSelf: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#ccc',
  },
  editPhotoText: {
    textAlign: 'center',
    color: '#007BFF',
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  lightInput: {
    backgroundColor: '#fff',
    borderColor: '#ccc',
    color: '#000',
  },
  darkInput: {
    backgroundColor: '#333',
    borderColor: '#555',
    color: '#EAEAEA',
  },
  saveButton: {
    backgroundColor: '#007BFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ProfileScreen;
