import React, { useEffect, useState } from 'react';
import { View, Text, Switch, TouchableOpacity, Modal, StyleSheet, Alert, ScrollView } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import ReactNativeBiometrics from 'react-native-biometrics';
import Toast from 'react-native-toast-message';
import { CORESSETTINGS } from '../../../components/coresAuth';
import ScreenLayout, { createScreenHeaderTemplate, createHeaderTitleTemplate } from '../../../components/ScreenLayout';
import authService from '../../../services/authService';
import { readStoredUserSummary } from '../../../services/userSessionStorageService';
import {
  loadSavedAuthPreferences,
  loadSettingsData,
  resetAllLocalData,
  saveBiometricEnabled,
  saveSettingsValue,
} from '../services/settingsStorageService';

const COLORS = CORESSETTINGS;
const APP_VERSION = require('../../../../package.json').version;
const APP_ENVIRONMENT = __DEV__ ? 'Desenvolvimento' : 'Produção';

const SettingsScreen = ({ isDarkMode, setIsDarkMode, resetThemePreference, navigation }) => {
  const rnBiometrics = new ReactNativeBiometrics();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isBiometricEnabled, setBiometricEnabled] = useState(false);
  const [hasSavedCredentials, setHasSavedCredentials] = useState(false);
  const [userSummary, setUserSummary] = useState({
    name: 'Usuário',
    email: '',
  });

  useEffect(() => {
    loadSettings();
    navigation.setOptions({
      ...createScreenHeaderTemplate({
        isDarkMode,
        lightHeaderColor: COLORS.primary,
        darkHeaderColor: COLORS.primary,
        tintColor: '#FFFFFF',
        titleSize: 18,
        titleWeight: '700',
        titleLetterSpacing: 0.4,
        headerStyleOverride: {
          shadowOpacity: 0.08,
        },
      }),
      headerTitle: () =>
        createHeaderTitleTemplate({
          title: 'Configurações',
          iconName: 'settings',
          tintColor: '#FFFFFF',
        }),
    });
  }, [navigation, isDarkMode]);

  const loadSettings = async () => {
    try {
      const [settings, summary, authPreferences] = await Promise.all([
        loadSettingsData(),
        readStoredUserSummary(),
        loadSavedAuthPreferences(),
      ]);

      setBiometricEnabled(settings.biometric);
      setHasSavedCredentials(Boolean(authPreferences.savedEmail && authPreferences.savedPassword));
      setUserSummary({
        name: summary?.name || 'Usuário',
        email: summary?.email || '',
      });
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    }
  };

  const saveSettings = async (key, value) => {
    try {
      await saveSettingsValue(key, value);
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
    }
  };

  const toggleDarkMode = () => {
    const newValue = !isDarkMode;
    setIsDarkMode(newValue);
    saveSettings('darkMode', newValue);
  };

  const toggleBiometric = async () => {
    try {
      const { available, biometryType } = await rnBiometrics.isSensorAvailable();

      if (!available || !biometryType) {
        Alert.alert(
          'Não disponível',
          'Seu dispositivo não suporta ou não tem biometria configurada.',
        );
        return;
      }

      const { savedEmail, savedPassword } = await loadSavedAuthPreferences();

      if (!savedEmail || !savedPassword) {
        setHasSavedCredentials(false);
        Alert.alert(
          'Configuração necessária',
          'Para usar a biometria, você precisa primeiro fazer login e ativar "Lembrar-me".',
        );
        return;
      }

      const newValue = !isBiometricEnabled;
      setBiometricEnabled(newValue);
      setHasSavedCredentials(true);
      await saveBiometricEnabled(newValue);

      Toast.show({
        type: 'success',
        text1: 'Biometria',
        text2: newValue ? 'Ativada com sucesso!' : 'Desativada com sucesso!',
      });
    } catch (error) {
      console.error('Erro ao configurar biometria:', error);
      Alert.alert('Erro', 'Não foi possível configurar a biometria.');
    }
  };

  const confirmLogout = () => {
    Alert.alert(
      'Sair da conta',
      'Deseja encerrar a sessão atual e voltar para a tela de login?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: handleLogout,
        },
      ],
    );
  };

  const handleLogout = async () => {
    try {
      await authService.logout();

      Toast.show({
        type: 'success',
        text1: 'Logout realizado',
        text2: 'Sessão encerrada com sucesso.',
      });

      navigation.reset({
        index: 0,
        routes: [{ name: 'LoginScreen' }],
      });
    } catch (error) {
      console.error('Erro ao realizar logout:', error);
      Alert.alert('Erro', 'Não foi possível encerrar a sessão.');
    }
  };

  const handleResetData = async () => {
    try {
      await resetAllLocalData();
      resetThemePreference?.();
      setIsModalVisible(false);
      Alert.alert('Sucesso', 'Dados redefinidos com sucesso. O app será reiniciado.');
      navigation.reset({
        index: 0,
        routes: [{ name: 'EntryScreen' }],
      });
    } catch (error) {
      console.error('Erro ao redefinir dados', error);
      Alert.alert('Erro', 'Não foi possível redefinir os dados.');
    }
  };

  const SectionHeader = ({ title }) => (
    <Text style={[styles.sectionTitle, isDarkMode ? styles.darkText : styles.lightText]}>
      {title}
    </Text>
  );

  const SectionCard = ({ children }) => (
    <View style={[styles.sectionCard, isDarkMode ? styles.darkSectionCard : styles.lightSectionCard]}>
      {children}
    </View>
  );

  const SettingItem = ({ icon, title, subtitle, value, onToggle, iconColor, isLast = false }) => (
    <View
      style={[
        styles.row,
        !isLast && styles.rowDivider,
        !isLast && (isDarkMode ? styles.darkRowDivider : styles.lightRowDivider),
      ]}
    >
      <View style={styles.rowContent}>
        <View style={[styles.iconBadge, isDarkMode ? styles.darkIconBadge : styles.lightIconBadge]}>
          <MaterialCommunityIcons
            name={icon}
            size={22}
            color={iconColor || (isDarkMode ? COLORS.textDark : COLORS.primary)}
          />
        </View>

        <View style={styles.textBlock}>
          <Text style={[styles.rowTitle, isDarkMode ? styles.darkText : styles.lightText]}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.rowSubtitle, isDarkMode ? styles.darkMutedText : styles.lightMutedText]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{
          false: isDarkMode ? '#4B5563' : '#D1D5DB',
          true: isDarkMode ? '#10B981' : '#059669',
        }}
        thumbColor={value ? '#FFFFFF' : isDarkMode ? '#1F2937' : '#9CA3AF'}
        ios_backgroundColor={isDarkMode ? '#4B5563' : '#D1D5DB'}
      />
    </View>
  );

  const NavigationItem = ({ icon, title, onPress, iconColor, isLast = false, tone = 'default' }) => {
    const titleStyle = tone === 'danger'
      ? styles.dangerText
      : tone === 'warning'
        ? styles.warningText
        : null;

    return (
      <TouchableOpacity
        style={[
          styles.row,
          !isLast && styles.rowDivider,
          !isLast && (isDarkMode ? styles.darkRowDivider : styles.lightRowDivider),
        ]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        <View style={styles.rowContent}>
          <View style={[styles.iconBadge, isDarkMode ? styles.darkIconBadge : styles.lightIconBadge]}>
            <MaterialCommunityIcons
              name={icon}
              size={22}
              color={iconColor || (isDarkMode ? COLORS.textDark : COLORS.primary)}
            />
          </View>
          <Text style={[styles.rowTitle, isDarkMode ? styles.darkText : styles.lightText, titleStyle]}>
            {title}
          </Text>
        </View>

        <MaterialIcons
          name="arrow-forward-ios"
          size={16}
          color={isDarkMode ? COLORS.textMutedDark : COLORS.textMuted}
        />
      </TouchableOpacity>
    );
  };

  const InfoItem = ({ label, value, isLast = false }) => (
    <View
      style={[
        styles.infoRow,
        !isLast && styles.rowDivider,
        !isLast && (isDarkMode ? styles.darkRowDivider : styles.lightRowDivider),
      ]}
    >
      <Text style={[styles.infoLabel, isDarkMode ? styles.darkMutedText : styles.lightMutedText]}>
        {label}
      </Text>
      <Text style={[styles.infoValue, isDarkMode ? styles.darkText : styles.lightText]}>
        {value}
      </Text>
    </View>
  );

  return (
    <ScreenLayout
      isDarkMode={isDarkMode}
      lightBackground="#F4F6FB"
      darkBackground="#111827"
      contentStyle={[styles.container, isDarkMode ? styles.darkBackground : styles.lightBackground]}
    >
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <SectionHeader title="Conta" />
        <SectionCard>
          <View style={[styles.accountRow, styles.rowDivider, isDarkMode ? styles.darkRowDivider : styles.lightRowDivider]}>
            <View style={[styles.accountAvatar, isDarkMode ? styles.darkIconBadge : styles.lightIconBadge]}>
              <MaterialCommunityIcons
                name="account-circle-outline"
                size={26}
                color={isDarkMode ? COLORS.textDark : COLORS.primary}
              />
            </View>

            <View style={styles.accountInfo}>
              <Text style={[styles.accountName, isDarkMode ? styles.darkText : styles.lightText]}>
                {userSummary.name}
              </Text>
              <Text style={[styles.accountEmail, isDarkMode ? styles.darkMutedText : styles.lightMutedText]}>
                {userSummary.email || 'Sessão ativa'}
              </Text>
            </View>
          </View>

          <NavigationItem
            icon="account-edit-outline"
            title="Abrir perfil"
            onPress={() => navigation.navigate('ProfileScreen')}
          />

          <NavigationItem
            icon="logout"
            title="Sair da conta"
            onPress={confirmLogout}
            iconColor="#B45309"
            tone="warning"
            isLast
          />
        </SectionCard>

        <SectionHeader title="Preferências" />
        <SectionCard>
          <SettingItem
            icon="theme-light-dark"
            title="Modo escuro"
            value={isDarkMode}
            onToggle={toggleDarkMode}
            isLast
          />
        </SectionCard>

        <SectionHeader title="Segurança" />
        <SectionCard>
          <SettingItem
            icon="fingerprint"
            title="Autenticação biométrica"
            subtitle={hasSavedCredentials ? undefined : 'Requer Lembrar-me ativo'}
            value={isBiometricEnabled}
            onToggle={toggleBiometric}
            isLast
          />
        </SectionCard>

        <SectionHeader title="Alertas" />
        <SectionCard>
          <NavigationItem
            icon="bell-ring-outline"
            title="Notificações"
            onPress={() => navigation.navigate('NotificationSettings')}
            iconColor="#FF6B35"
            isLast
          />
        </SectionCard>

        <SectionHeader title="Sobre o app" />
        <SectionCard>
          <InfoItem label="Versão" value={APP_VERSION} />
          <InfoItem label="Ambiente" value={APP_ENVIRONMENT} isLast />
        </SectionCard>

        <SectionHeader title="Manutenção" />
        <SectionCard>
          <NavigationItem
            icon="alert-circle-outline"
            title="Redefinir dados locais"
            onPress={() => setIsModalVisible(true)}
            iconColor="#DC2626"
            tone="danger"
            isLast
          />
        </SectionCard>

        <Modal
          transparent
          animationType="fade"
          visible={isModalVisible}
          onRequestClose={() => setIsModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={[styles.modalContent, isDarkMode ? styles.darkModalContent : styles.lightModalContent]}>
              <View style={styles.modalIconWrap}>
                <MaterialIcons name="warning-amber" size={34} color="#DC2626" />
              </View>

              <Text style={[styles.modalTitle, isDarkMode ? styles.darkText : styles.lightText]}>
                Redefinir dados locais
              </Text>

              <Text style={[styles.modalText, isDarkMode ? styles.darkMutedText : styles.lightMutedText]}>
                Esta ação remove os dados salvos no aplicativo neste dispositivo.
              </Text>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setIsModalVisible(false)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.modalButtonText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.confirmButton]}
                  onPress={handleResetData}
                  activeOpacity={0.85}
                >
                  <Text style={styles.modalButtonText}>Confirmar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  lightBackground: {
    backgroundColor: '#F4F6FB',
  },
  darkBackground: {
    backgroundColor: '#111827',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 28,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    borderRadius: 18,
    paddingHorizontal: 14,
    marginBottom: 18,
    borderWidth: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  lightSectionCard: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(46,53,84,0.08)',
  },
  darkSectionCard: {
    backgroundColor: COLORS.cardDark,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
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
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 16,
  },
  textBlock: {
    flex: 1,
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  lightIconBadge: {
    backgroundColor: 'rgba(60,68,108,0.08)',
  },
  darkIconBadge: {
    backgroundColor: 'rgba(159,167,199,0.18)',
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  rowSubtitle: {
    fontSize: 12.5,
    marginTop: 3,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  accountAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: 16,
    fontWeight: '800',
  },
  accountEmail: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    gap: 16,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
    flexShrink: 1,
  },
  lightText: {
    color: '#2E3554',
  },
  darkText: {
    color: '#F3F5FF',
  },
  lightMutedText: {
    color: 'rgba(46,53,84,0.72)',
  },
  darkMutedText: {
    color: '#AAB1CF',
  },
  warningText: {
    color: '#B45309',
  },
  dangerText: {
    color: '#DC2626',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.45)',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
  },
  lightModalContent: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(46,53,84,0.08)',
  },
  darkModalContent: {
    backgroundColor: COLORS.cardDark,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalIconWrap: {
    width: 62,
    height: 62,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(220,38,38,0.12)',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 21,
    fontWeight: '800',
    textAlign: 'center',
  },
  modalText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    width: '100%',
    marginHorizontal: -6,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginHorizontal: 6,
  },
  cancelButton: {
    backgroundColor: '#64748B',
  },
  confirmButton: {
    backgroundColor: '#B91C1C',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default SettingsScreen;
