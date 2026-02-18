import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, Image, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CORESPROFILE } from '../../components/coresAuth';

const ProfileScreen = ({ isDarkMode }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [profileImage, setProfileImage] = useState(null);

  const COLORS = CORESPROFILE;

  // Função para carregar os dados salvos no AsyncStorage
  const loadProfileData = useCallback(async () => {
    try {
      const savedName = await AsyncStorage.getItem('name');
      const savedEmail = await AsyncStorage.getItem('email');
      const savedPassword = await AsyncStorage.getItem('password');
      const savedProfileImage = await AsyncStorage.getItem('profileImage');

      if (savedName) setName(savedName);
      if (savedEmail) setEmail(savedEmail);
      if (savedPassword) setPassword(savedPassword);
      if (savedProfileImage) setProfileImage(savedProfileImage);
    } catch (error) {
      console.error('Erro ao carregar dados do perfil:', error);
    }
  }, []);

  // Carregar os dados assim que o componente for montado
  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  // Função para salvar as alterações no AsyncStorage
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

    if (!password.trim()) {
      Alert.alert('Erro', 'O campo Senha é obrigatório.');
      return;
    }

    try {
      // Salvando os dados no AsyncStorage
      await AsyncStorage.setItem('name', name);
      await AsyncStorage.setItem('email', email);
      await AsyncStorage.setItem('password', password);
      await AsyncStorage.setItem('profileImage', profileImage || '');

      console.log('[ProfileScreen] Alterações salvas!');
      console.log('[ProfileScreen] Nome atualizado:', name);
      console.log('[ProfileScreen] E-mail atualizado:', email);
      console.log('[ProfileScreen] Senha atualizada.');
      Alert.alert('Sucesso', 'Alterações salvas com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar dados do perfil:', error);
      Alert.alert('Erro', 'Ocorreu um erro ao salvar os dados. Tente novamente.');
    }
  }, [name, email, password, profileImage]);

  // Função para selecionar uma imagem
  const handleImagePick = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      includeBase64: false,
      quality: 0.8,
      selectionLimit: 1,
    });

    if (result.didCancel) {
      console.log('[ProfileScreen] Seleção de imagem cancelada.');
      return;
    }

    if (result.errorCode) {
      Alert.alert('Erro', 'Não foi possível acessar a galeria.');
      return;
    }

    const selectedImageUri = result.assets?.[0]?.uri;
    if (selectedImageUri) {
      setProfileImage(selectedImageUri);
      console.log('[ProfileScreen] Nova imagem de perfil selecionada:', selectedImageUri);
    } else {
      console.log('[ProfileScreen] Nenhum arquivo válido foi selecionado.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? COLORS.darkBackground : COLORS.background }]}>
      <Text style={[styles.title, { color: isDarkMode ? COLORS.textDark : COLORS.text }]}>Perfil do Usuário</Text>
      <TouchableOpacity onPress={handleImagePick}>
        <Image
          source={profileImage ? { uri: profileImage } : require('../../../assets/Perfil/default-profile.png')}
          style={[styles.profileImage, { borderColor: isDarkMode ? COLORS.accent : '#ccc' }]}
        />
        <Text style={[styles.editPhotoText, { color: COLORS.primary }]}>Alterar Foto</Text>
      </TouchableOpacity>
      <View style={styles.inputContainer}>
        <Text style={[styles.label, { color: isDarkMode ? COLORS.textDark : COLORS.text }]}>Nome</Text>
        <TextInput
          style={[styles.input, {
            backgroundColor: isDarkMode ? COLORS.cardDark : COLORS.white,
            borderColor: isDarkMode ? COLORS.accent : '#ccc',
            color: isDarkMode ? COLORS.textDark : COLORS.text
          }]}
          value={name}
          onChangeText={setName}
          placeholder="Digite seu nome"
          placeholderTextColor={isDarkMode ? '#aaa' : '#888'}
        />
      </View>
      <View style={styles.inputContainer}>
        <Text style={[styles.label, { color: isDarkMode ? COLORS.textDark : COLORS.text }]}>E-mail</Text>
        <TextInput
          style={[styles.input, {
            backgroundColor: isDarkMode ? COLORS.cardDark : COLORS.white,
            borderColor: isDarkMode ? COLORS.accent : '#ccc',
            color: isDarkMode ? COLORS.textDark : COLORS.text
          }]}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          placeholder="Digite seu e-mail"
          placeholderTextColor={isDarkMode ? '#aaa' : '#888'}
        />
      </View>
      <View style={styles.inputContainer}>
        <Text style={[styles.label, { color: isDarkMode ? COLORS.textDark : COLORS.text }]}>Senha</Text>
        <TextInput
          style={[styles.input, {
            backgroundColor: isDarkMode ? COLORS.cardDark : COLORS.white,
            borderColor: isDarkMode ? COLORS.accent : '#ccc',
            color: isDarkMode ? COLORS.textDark : COLORS.text
          }]}
          value={password}
          onChangeText={setPassword}
          placeholder="Digite sua senha"
          placeholderTextColor={isDarkMode ? '#aaa' : '#888'}
          secureTextEntry
        />
      </View>
      <TouchableOpacity style={[styles.saveButton, { backgroundColor: COLORS.primary }]} onPress={handleSaveChanges}>
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignSelf: 'center',
    marginBottom: 10,
    borderWidth: 2,
  },
  editPhotoText: {
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '600',
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
  saveButton: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ProfileScreen;
