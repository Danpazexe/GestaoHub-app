import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  Alert,
  Switch,
  Platform
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

const NotifScreen = ({ navigation, isDarkMode }) => {
  const [notificationDays, setNotificationDays] = useState(7);
  const [alertLevel, setAlertLevel] = useState('normal'); // 'normal', 'warning', 'critical'
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [repeatNotifications, setRepeatNotifications] = useState(false);
  const [repeatInterval, setRepeatInterval] = useState(24); // horas

  useEffect(() => {
    loadSettings();
    navigation.setOptions({
      headerShown: true,
      headerStyle: {
        backgroundColor: isDarkMode ? '#181818' : '#6cb6a5',
      },
      headerTintColor: '#FFFFFF',
      headerTitle: 'Configurar Validades',
    });
  }, [navigation, isDarkMode]);

  const loadSettings = async () => {
    try {
      const settings = await AsyncStorage.getItem('validitySettings');
      if (settings) {
        const parsedSettings = JSON.parse(settings);
        setNotificationDays(parsedSettings.notificationDays ?? 7);
        setAlertLevel(parsedSettings.alertLevel ?? 'normal');
        setVibrationEnabled(parsedSettings.vibrationEnabled ?? true);
        setRepeatNotifications(parsedSettings.repeatNotifications ?? false);
        setRepeatInterval(parsedSettings.repeatInterval ?? 24);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações de validade:', error);
    }
  };

  const saveSettings = async () => {
    try {
      const settings = {
        notificationDays,
        alertLevel,
        vibrationEnabled,
        repeatNotifications,
        repeatInterval,
      };
      await AsyncStorage.setItem('validitySettings', JSON.stringify(settings));
      await updateNotificationSchedule();
      Alert.alert('Sucesso', 'Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      Alert.alert('Erro', 'Não foi possível salvar as configurações');
    }
  };

  const getNotificationStyle = (level) => {
    switch (level) {
      case 'normal':
        return {
          icon: '🔔',
          color: '#4CAF50',
          channelId: 'normal-alerts',
          importance: Notifications.AndroidImportance.DEFAULT,
          priority: 'default',
          style: {
            backgroundColor: '#E8F5E9',
            accentColor: '#4CAF50'
          }
        };
      case 'warning':
        return {
          icon: '⚠️',
          color: '#FFA000',
          channelId: 'warning-alerts',
          importance: Notifications.AndroidImportance.HIGH,
          priority: 'high',
          style: {
            backgroundColor: '#FFF3E0',
            accentColor: '#FFA000'
          }
        };
      case 'critical':
        return {
          icon: '🚨',
          color: '#e45635',
          channelId: 'critical-alerts',
          importance: Notifications.AndroidImportance.MAX,
          priority: 'max',
          style: {
            backgroundColor: '#FFEBEE',
            accentColor: '#e45635'
          }
        };
      default:
        return getNotificationStyle('normal');
    }
  };

  const formatExpirationMessage = (days, productName = 'Produto exemplo', expirationDate) => {
    if (days === 0) {
      return `${productName} vence HOJE (${expirationDate})`;
    } else if (days === 1) {
      return `${productName} vencerá AMANHÃ (${expirationDate})`;
    } else {
      return `${productName} vencerá em ${days} dias (${expirationDate})`;
    }
  };
  const updateNotificationSchedule = async () => {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      
      const productsJson = await AsyncStorage.getItem('products');
      if (productsJson) {
        const products = JSON.parse(productsJson);
        
        for (const product of products) {
          if (product.expirationDate) {
            const expirationDate = new Date(product.expirationDate);
            const notificationDate = new Date(expirationDate);
            notificationDate.setDate(expirationDate.getDate() - notificationDays);

            if (notificationDate > new Date()) {
              const style = getNotificationStyle(alertLevel);
              const formattedDate = expirationDate.toLocaleDateString('pt-BR');
              const daysUntilExpiration = notificationDays;

              let title, subtitle;
              switch (alertLevel) {
                case 'normal':
                  title = `${style.icon} Lembrete de Validade`;
                  subtitle = 'Acompanhamento de produto';
                  break;
                case 'warning':
                  title = `${style.icon} Atenção: Produto Próximo do Vencimento`;
                  subtitle = 'Verificação necessária';
                  break;
                case 'critical':
                  title = `${style.icon} URGENTE: Risco de Vencimento`;
                  subtitle = 'Ação imediata necessária';
                  break;
              }

              const body = formatExpirationMessage(daysUntilExpiration, product.name, formattedDate);

              // Configure o trigger baseado na repetição
              let trigger;
              if (repeatNotifications) {
                // Para notificações repetidas
                trigger = {
                  seconds: repeatInterval * 3600, // Converte horas para segundos
                  repeats: true
                };
              } else {
                // Para notificação única
                trigger = {
                  date: notificationDate,
                  repeats: false
                };
              }

              await Notifications.scheduleNotificationAsync({
                content: {
                  title,
                  subtitle,
                  body,
                  data: { 
                    productId: product.id,
                    alertLevel,
                    expirationDate: product.expirationDate
                  },
                  sound: true,
                  priority: 'high',
                  color: style.color,
                  vibrate: vibrationEnabled ? [0, 250, 250, 250] : null,
                  channelId: style.channelId,
                  smallIcon: "./assets/Image/LOGO432.png",
                  largeIcon: "./assets/Image/LOGO432.png",
                  autoDismiss: false, // Impede que a notificação seja automaticamente descartada
                },
                trigger,
              });

              // Se for repetição, agende também a primeira notificação
              if (repeatNotifications && notificationDate > new Date()) {
                await Notifications.scheduleNotificationAsync({
                  content: {
                    title,
                    subtitle,
                    body,
                    data: { 
                      productId: product.id,
                      alertLevel,
                      expirationDate: product.expirationDate
                    },
                    sound: true,
                    priority: 'high',
                    color: style.color,
                    vibrate: vibrationEnabled ? [0, 250, 250, 250] : null,
                    channelId: style.channelId,
                    smallIcon: "./assets/Image/LOGO432.png",
                    largeIcon: "./assets/Image/LOGO432.png",
                    autoDismiss: false, // Impede que a notificação seja automaticamente descartada
                  },
                  trigger: {
                    date: notificationDate,
                    repeats: false
                  },
                });
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Erro ao atualizar notificações:', error);
    }
  };

  const adjustDays = (increment) => {
    setNotificationDays(current => {
      const newValue = current + increment;
      if (newValue >= 1 && newValue <= 30) {
        return newValue;
      }
      return current;
    });
  };

  const getAlertStyle = (level) => {
    switch (level) {
      case 'normal':
        return { icon: 'notifications', color: '#4CAF50' };
      case 'warning':
        return { icon: 'warning', color: '#FFA000' };
      case 'critical':
        return { icon: 'error', color: '#e45635' };
      default:
        return { icon: 'notifications', color: '#4CAF50' };
    }
  };

  const schedulePushNotification = async () => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Título da notificação",
        body: "Corpo da notificação",
        sound: true,
      },
      trigger: { seconds: 2 },
    });
  };

  return (
    <ScrollView 
      style={[styles.container, isDarkMode ? styles.darkBackground : styles.lightBackground]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Banner Superior */}
      <View style={[styles.banner, isDarkMode ? styles.darkBanner : styles.lightBanner]}>
        <View style={styles.bannerContent}>
          <View style={styles.bannerIconContainer}>
            <MaterialIcons 
              name="notifications-active" 
              size={32} 
              color="#FFFFFF" 
            />
          </View>
          <View style={styles.bannerTextContainer}>
            <Text style={styles.bannerTitle}>Central de Notificações</Text>
            <Text style={styles.bannerSubtitle}>
              Configure suas preferências de alerta
            </Text>
          </View>
        </View>
      </View>

      {/* Cards de Status */}
      <View style={styles.cardsRow}>
        <View style={[
          styles.statusCard, 
          isDarkMode ? styles.darkContainer : styles.lightContainer,
          { borderLeftColor: '#4CAF50' }
        ]}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="timer" size={20} color="#4CAF50" />
            <Text style={[styles.cardHeaderText, isDarkMode ? styles.darkText : styles.lightText]}>
              Antecedência
            </Text>
          </View>
          <Text style={[styles.cardValue, isDarkMode ? styles.darkText : styles.lightText]}>
            {notificationDays} dias
          </Text>
        </View>

        <View style={[
          styles.statusCard, 
          isDarkMode ? styles.darkContainer : styles.lightContainer,
          { borderLeftColor: getAlertStyle(alertLevel).color }
        ]}>
          <View style={styles.cardHeader}>
            <MaterialIcons 
              name={getAlertStyle(alertLevel).icon} 
              size={20} 
              color={getAlertStyle(alertLevel).color} 
            />
            <Text style={[styles.cardHeaderText, isDarkMode ? styles.darkText : styles.lightText]}>
              Nível
            </Text>
          </View>
          <Text style={[styles.cardValue, { color: getAlertStyle(alertLevel).color }]}>
            {alertLevel.charAt(0).toUpperCase() + alertLevel.slice(1)}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, isDarkMode ? styles.darkText : styles.lightText]}>
          Antecedência das Notificações
        </Text>
        <View style={[styles.daysContainer, isDarkMode ? styles.darkContainer : styles.lightContainer]}>
          <Text style={[styles.daysText, isDarkMode ? styles.darkText : styles.lightText]}>
            Notificar com antecedência de:
          </Text>
          <View style={styles.daysSelector}>
            <TouchableOpacity 
              style={[styles.dayButton, isDarkMode ? styles.darkButton : styles.lightButton]} 
              onPress={() => adjustDays(-1)}
            >
              <MaterialIcons name="remove" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            
            <View style={[styles.daysValue, isDarkMode ? styles.darkContainer : styles.lightContainer]}>
              <Text style={[styles.daysNumber, isDarkMode ? styles.darkText : styles.lightText]}>
                {notificationDays}
              </Text>
              <Text style={[styles.daysLabel, isDarkMode ? styles.darkText : styles.lightText]}>
                dias
              </Text>
            </View>

            <TouchableOpacity 
              style={[styles.dayButton, isDarkMode ? styles.darkButton : styles.lightButton]} 
              onPress={() => adjustDays(1)}
            >
              <MaterialIcons name="add" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, isDarkMode ? styles.darkText : styles.lightText]}>
          Nível de Alerta
        </Text>
        
        <View style={[styles.alertLevelsContainer, isDarkMode ? styles.darkContainer : styles.lightContainer]}>
          <TouchableOpacity 
            style={[
              styles.alertOption,
              alertLevel === 'normal' && styles.alertOptionSelected,
              { borderColor: '#4CAF50' }
            ]}
            onPress={() => setAlertLevel('normal')}
          >
            <MaterialIcons 
              name="notifications" 
              size={24} 
              color={alertLevel === 'normal' ? '#4CAF50' : isDarkMode ? '#EAEAEA' : '#666'} 
            />
            <Text style={[
              styles.alertOptionText,
              alertLevel === 'normal' && { color: '#4CAF50' },
              isDarkMode && styles.darkText
            ]}>
              Normal
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.alertOption,
              alertLevel === 'warning' && styles.alertOptionSelected,
              { borderColor: '#FFA000' }
            ]}
            onPress={() => setAlertLevel('warning')}
          >
            <MaterialIcons 
              name="warning" 
              size={24} 
              color={alertLevel === 'warning' ? '#FFA000' : isDarkMode ? '#EAEAEA' : '#666'} 
            />
            <Text style={[
              styles.alertOptionText,
              alertLevel === 'warning' && { color: '#FFA000' },
              isDarkMode && styles.darkText
            ]}>
              Atenção
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.alertOption,
              alertLevel === 'critical' && styles.alertOptionSelected,
              { borderColor: '#e45635' }
            ]}
            onPress={() => setAlertLevel('critical')}
          >
            <MaterialIcons 
              name="error" 
              size={24} 
              color={alertLevel === 'critical' ? '#e45635' : isDarkMode ? '#EAEAEA' : '#666'} 
            />
            <Text style={[
              styles.alertOptionText,
              alertLevel === 'critical' && { color: '#e45635' },
              isDarkMode && styles.darkText
            ]}>
              Crítico
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.settingGroup, isDarkMode ? styles.darkContainer : styles.lightContainer]}>
          <View style={styles.settingItem}>
            <MaterialIcons name="vibration" size={24} color={isDarkMode ? '#EAEAEA' : '#333333'} />
            <Text style={[styles.settingText, isDarkMode ? styles.darkText : styles.lightText]}>
              Vibração
            </Text>
          </View>
          <Switch
            value={vibrationEnabled}
            onValueChange={setVibrationEnabled}
            trackColor={{ false: "#e45635", true: "#4CAF50" }}
            thumbColor={vibrationEnabled ? "#ffffff" : "#f4f3f4"}
          />
        </View>

        <View style={[styles.settingGroup, isDarkMode ? styles.darkContainer : styles.lightContainer]}>
          <View style={styles.settingItem}>
            <MaterialIcons name="repeat" size={24} color={isDarkMode ? '#EAEAEA' : '#333333'} />
            <Text style={[styles.settingText, isDarkMode ? styles.darkText : styles.lightText]}>
              Repetir notificações
            </Text>
          </View>
          <Switch
            value={repeatNotifications}
            onValueChange={setRepeatNotifications}
            trackColor={{ false: "#e45635", true: "#4CAF50" }}
            thumbColor={repeatNotifications ? "#ffffff" : "#f4f3f4"}
          />
        </View>

        {repeatNotifications && (
          <View style={[styles.settingGroup, isDarkMode ? styles.darkContainer : styles.lightContainer]}>
            <View style={styles.settingItem}>
              <MaterialIcons name="update" size={24} color={isDarkMode ? '#EAEAEA' : '#333333'} />
              <Text style={[styles.settingText, isDarkMode ? styles.darkText : styles.lightText]}>
                Repetir a cada
              </Text>
            </View>
            <View style={styles.repeatSelector}>
              <TouchableOpacity 
                style={styles.repeatButton}
                onPress={() => setRepeatInterval(prev => Math.max(1, prev - 1))}
              >
                <MaterialIcons name="remove" size={20} color={isDarkMode ? '#EAEAEA' : '#333333'} />
              </TouchableOpacity>
              <Text style={[styles.repeatText, isDarkMode ? styles.darkText : styles.lightText]}>
                {repeatInterval}h
              </Text>
              <TouchableOpacity 
                style={styles.repeatButton}
                onPress={() => setRepeatInterval(prev => Math.min(48, prev + 1))}
              >
                <MaterialIcons name="add" size={20} color={isDarkMode ? '#EAEAEA' : '#333333'} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <TouchableOpacity 
        style={[styles.saveButton, isDarkMode ? styles.darkButton : styles.lightButton]}
        onPress={saveSettings}
      >
        <MaterialIcons name="save" size={24} color="#FFFFFF" />
        <Text style={styles.saveButtonText}>Salvar Configurações</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  contentContainer: {
    paddingVertical: 20,
  },
  darkBackground: {
    backgroundColor: '#181818',
  },
  lightBackground: {
    backgroundColor: '#F9F9F9',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    paddingHorizontal: 15,
  },
  darkContainer: {
    backgroundColor: '#252525',
  },
  lightContainer: {
    backgroundColor: '#FFF',
  },
  darkText: {
    color: '#EAEAEA',
  },
  lightText: {
    color: '#333333',
  },
  daysContainer: {
    padding: 20,
    borderRadius: 10,
    marginBottom: 15,
    alignItems: 'center',
  },
  daysText: {
    fontSize: 16,
    marginBottom: 15,
    textAlign: 'center',
  },
  daysSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 15,
  },
  dayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  daysValue: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    minWidth: 80,
  },
  daysNumber: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  daysLabel: {
    fontSize: 14,
  },
  settingGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
    padding: 15,
    borderRadius: 10,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  settingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 20,
    paddingVertical: 15,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  darkButton: {
    backgroundColor: '#6cb6a5',
  },
  lightButton: {
    backgroundColor: '#181818',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  alertLevelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  alertOption: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    marginHorizontal: 5,
  },
  alertOptionSelected: {
    backgroundColor: 'rgba(108, 182, 165, 0.1)',
  },
  alertOptionText: {
    marginTop: 5,
    fontSize: 12,
    fontWeight: '600',
  },
  repeatSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  repeatButton: {
    padding: 5,
    borderRadius: 15,
    backgroundColor: 'rgba(108, 182, 165, 0.1)',
  },
  repeatText: {
    fontSize: 16,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'center',
  },
  banner: {
    paddingVertical: 25,
    paddingHorizontal: 20,
    marginBottom: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  darkBanner: {
    backgroundColor: '#6cb6a5',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    marginTop: -20,
    zIndex: 1
  },
  lightBanner: {
    backgroundColor: '#6cb6a5',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    marginTop: -20,
    zIndex: 1
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  bannerSubtitle: {
    color: '#FFFFFF',
    opacity: 0.9,
    fontSize: 14,
  },
  cardsRow: {
    flexDirection: 'row',
    marginHorizontal: 15,
    marginBottom: 20,
    gap: 10,
  },
  statusCard: {
    flex: 1,
    padding: 15,
    borderRadius: 12,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  cardHeaderText: {
    fontSize: 14,
    opacity: 0.8,
  },
  cardValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
});

export default NotifScreen;