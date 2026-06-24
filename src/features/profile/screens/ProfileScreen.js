import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, Image, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import ScreenLayout, {
  createHeaderTitleTemplate,
  createScreenHeaderTemplate,
} from '../../../components/ScreenLayout';
import { CORESPROFILE } from '../../../components/coresAuth';
import {
  loadProfileData as loadStoredProfileData,
  saveProfileData,
} from '../services/profileStorageService';

const ProfileScreen = ({ isDarkMode, navigation }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [profileImage, setProfileImage] = useState(null);

  const COLORS = CORESPROFILE;

  const loadProfileData = useCallback(async () => {
    try {
      const storedProfile = await loadStoredProfileData();

      if (storedProfile.name) setName(storedProfile.name);
      if (storedProfile.email) setEmail(storedProfile.email);
      if (storedProfile.profileImage) setProfileImage(storedProfile.profileImage);
    } catch (error) {
      console.error('Erro ao carregar dados do perfil:', error);
    }
  }, []);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  useEffect(() => {
    navigation?.setOptions({
      ...createScreenHeaderTemplate({
        isDarkMode,
        lightHeaderColor: COLORS.primary,
        darkHeaderColor: COLORS.primary,
        tintColor: '#FFFFFF',
      }),
      headerTitle: () =>
        createHeaderTitleTemplate({
          title: 'Perfil',
          subtitle: 'Dados do usuário',
          iconName: 'person',
          tintColor: '#FFFFFF',
        }),
    });
  }, [navigation, isDarkMode, COLORS.primary]);

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
      await saveProfileData({ name, email, profileImage });

      console.log('[ProfileScreen] Alterações salvas!');
      console.log('[ProfileScreen] Nome atualizado:', name);
      console.log('[ProfileScreen] E-mail atualizado:', email);
      Alert.alert('Sucesso', 'Alterações salvas com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar dados do perfil:', error);
      Alert.alert('Erro', 'Ocorreu um erro ao salvar os dados. Tente novamente.');
    }
  }, [name, email, profileImage]);

  // Função para selecionar uma imagem
  const handleImagePick = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      includeBase64: false,
      quality: 0.5,
      maxWidth: 512,
      maxHeight: 512,
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
    <ScreenLayout
      isDarkMode={isDarkMode}
      lightBackground={COLORS.background}
      darkBackground={COLORS.darkBackground}
      contentStyle={styles.container}
    >
      <Text style={[styles.title, { color: isDarkMode ? COLORS.textDark : COLORS.text }]}>Perfil do Usuário</Text>
      <TouchableOpacity onPress={handleImagePick}>
        <Image
          source={profileImage ? { uri: profileImage } : require('../../../../assets/Perfil/default-profile.png')}
          style={[styles.profileImage, { borderColor: isDarkMode ? COLORS.accent : '#ccc' }]}
        />
        <Text style={[styles.editPhotoText, { color: isDarkMode ? COLORS.accent : COLORS.primary }]}>Alterar Foto</Text>
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
          placeholderTextColor={isDarkMode ? '#9fa7c7' : '#888'}
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
          placeholderTextColor={isDarkMode ? '#9fa7c7' : '#888'}
        />
      </View>
      <TouchableOpacity style={[styles.saveButton, { backgroundColor: COLORS.primary }]} onPress={handleSaveChanges}>
        <Text style={styles.saveButtonText}>Salvar Alterações</Text>
      </TouchableOpacity>
    </ScreenLayout>
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
