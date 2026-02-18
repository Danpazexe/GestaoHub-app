import React, { useState, useEffect, useLayoutEffect } from 'react';
import { View, Text, Switch, TouchableOpacity, StyleSheet, Alert, ScrollView, Platform, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import notifee, { AndroidImportance, TriggerType } from '@notifee/react-native';
import Toast from 'react-native-toast-message';
import { CORESNOTIFICATION } from '../../components/coresAuth';
import { STORAGE_KEYS } from '../../constants/storage';
import {
  createScreenHeaderTemplate,
  createHeaderTitleTemplate,
  createHeaderActionsTemplate,
} from '../../components/ScreenLayout';

const { width } = Dimensions.get('window');

const NotificationScreen = ({ navigation, isDarkMode }) => {
  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(true);
  const [alertLevel, setAlertLevel] = useState('normal');
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [notificationStats, setNotificationStats] = useState({
    total: 0,
    daily: 0,
    alternate: 0,
    once: 0
  });
  const [showAdvanced, setShowAdvanced] = useState(false);

  const COLORS = CORESNOTIFICATION;

  useEffect(() => {
    setupNotificationChannels();
    loadNotificationStats();
  }, []);

  useLayoutEffect(() => {
    if (!navigation) return;

    navigation.setOptions({
      ...createScreenHeaderTemplate({
        isDarkMode,
        lightHeaderColor: COLORS.primary,
        darkHeaderColor: COLORS.secondary,
        tintColor: '#FFFFFF',
        titleSize: 18,
        titleWeight: '700',
        headerStyleOverride: {
          elevation: 4,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 3,
        },
      }),
      headerTitle: () =>
        createHeaderTitleTemplate({
          title: 'Notificações',
          iconName: 'notifications',
          tintColor: '#FFFFFF',
        }),
      headerRight: () =>
        createHeaderActionsTemplate({
          isDarkMode,
          actions: [
            {
              key: 'toggle-advanced',
              iconName: 'cog-outline',
              IconComponent: MaterialCommunityIcons,
              onPress: () => setShowAdvanced((prev) => !prev),
              isActive: showAdvanced,
              activeBackgroundColor: isDarkMode ? '#3d7a77' : COLORS.secondary,
              baseBackgroundColor: isDarkMode ? '#2d5a57' : 'rgba(255, 255, 255, 0.2)',
              iconColor: '#FFFFFF',
            },
          ],
        }),
    });
  }, [navigation, isDarkMode, setShowAdvanced, showAdvanced]);

  const setupNotificationChannels = async () => {
    if (Platform.OS === 'android') {
      try {
        await notifee.createChannel({
          id: 'default',
          name: 'Notificações de Validade',
          importance: AndroidImportance.HIGH,
          vibration: true,
          vibrationPattern: [250, 250],
          lightColor: '#FF231F7C',
          sound: 'notification',
        });
      } catch (error) {
        console.error('Erro ao configurar canal:', error);
      }
    }
  };

  const loadNotificationStats = async () => {
    try {
      const scheduledNotifications = await notifee.getTriggerNotifications();
      const stats = {
        total: scheduledNotifications.length,
        daily: scheduledNotifications.filter(n => n.notification?.data?.strategy === 'daily').length,
        alternate: scheduledNotifications.filter(n => n.notification?.data?.strategy === 'alternate').length,
        once: scheduledNotifications.filter(n => n.notification?.data?.strategy === 'once').length
      };
      setNotificationStats(stats);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  const getNotificationStyle = (level) => {
    switch (level) {
      case 'normal':
        return {
          icon: '🔔',
          color: '#4CAF50',
          bgColor: '#E8F5E8',
          darkBgColor: '#1B4332'
        };
      case 'warning':
        return {
          icon: '⚠️',
          color: '#FFA000',
          bgColor: '#FFF8E1',
          darkBgColor: '#4A3C00'
        };
      case 'critical':
        return {
          icon: '🚨',
          color: '#e45635',
          bgColor: '#FFEBEE',
          darkBgColor: '#4A1C1C'
        };
      default:
        return {
          icon: '🔔',
          color: '#4CAF50',
          bgColor: '#E8F5E8',
          darkBgColor: '#1B4332'
        };
    }
  };

  const formatExpirationMessage = (days, productName, expirationDate) => {
    if (days === 0) {
      return `Produto ${productName} vence HOJE! (${expirationDate})`;
    } else if (days === 1) {
      return `Produto ${productName} vence AMANHÃ! (${expirationDate})`;
    } else {
      return `Produto ${productName} vence em ${days} dias (${expirationDate})`;
    }
  };

  const clearPastNotifications = async () => {
    try {
      setIsLoading(true);

      await notifee.cancelAllNotifications();

      setNotificationStats({ total: 0, daily: 0, alternate: 0, once: 0 });

      Toast.show({
        type: 'success',
        text1: 'Limpeza Concluída',
        text2: 'Todos os agendamentos de notificação foram removidos com sucesso!'
      });
    } catch (error) {
      console.error('Erro ao limpar notificações:', error);
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Não foi possível limpar as notificações.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testNotification = async () => {
    try {
      const style = getNotificationStyle(alertLevel);
      const testBody = formatExpirationMessage(5, 'Produto Teste', '15/07/2025');

      await notifee.createTriggerNotification(
        {
          title: `${style.icon} Teste de Notificação`,
          body: testBody,
          data: { test: true },
          android: {
            channelId: 'default',
            sound: 'notification',
            vibrationPattern: vibrationEnabled ? [250, 250] : undefined,
            importance: AndroidImportance.HIGH,
            pressAction: { id: 'default' },
          },
        },
        {
          type: TriggerType.TIMESTAMP,
          timestamp: Date.now() + 3000,
        }
      );

      Toast.show({
        type: 'success',
        text1: 'Teste Enviado',
        text2: 'Uma notificação de teste será exibida em 3 segundos!'
      });
    } catch (error) {
      console.error('Erro ao enviar notificação de teste:', error);
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Não foi possível enviar a notificação de teste.'
      });
    }
  };

  const updateNotificationSchedule = async () => {
    if (!isNotificationsEnabled) {
      await notifee.cancelAllNotifications();
      setNotificationStats({ total: 0, daily: 0, alternate: 0, once: 0 });
      Toast.show({
        type: 'info',
        text1: 'Notificações Desativadas',
        text2: 'Todas as notificações foram canceladas.'
      });
      return;
    }

    try {
      setIsLoading(true);

      await notifee.cancelAllNotifications();

      const productsJson = await AsyncStorage.getItem(STORAGE_KEYS.PRODUCTS);
      if (!productsJson) {
        Toast.show({
          type: 'info',
          text1: 'Nenhum Produto',
          text2: 'Não há produtos cadastrados para agendar notificações.'
        });
        return;
      }

      const products = JSON.parse(productsJson);

      let scheduledCount = 0;
      let dailyCount = 0;
      let alternateCount = 0;
      let onceCount = 0;
      const maxDiasAgendamento = 30;
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      for (const product of products) {
        if (!product.validade || !product.descricao) continue;

        try {
          const expirationDate = new Date(product.validade);
          expirationDate.setHours(0, 0, 0, 0);

          const daysUntilExpiration = Math.ceil((expirationDate - hoje) / (1000 * 60 * 60 * 24));

          if (daysUntilExpiration > 0 && daysUntilExpiration <= maxDiasAgendamento) {
            // Definir nível de alerta automaticamente baseado nos dias restantes
            let autoAlertLevel;
            if (daysUntilExpiration <= 7) {
              autoAlertLevel = 'critical'; // 1-7 dias = Crítico
            } else if (daysUntilExpiration <= 14) {
              autoAlertLevel = 'warning';  // 8-14 dias = Atenção
            } else {
              autoAlertLevel = 'normal';   // 15-21 dias = Normal
            }

            const style = getNotificationStyle(autoAlertLevel);

            if (daysUntilExpiration <= 7) {
              for (let day = 0; day <= daysUntilExpiration; day++) {
                if (scheduledCount >= 450) break;

                const notificationDate = new Date(expirationDate);
                notificationDate.setDate(expirationDate.getDate() - day);
                notificationDate.setHours(9, 0, 0, 0);

                if (notificationDate > new Date()) {
                  const daysLeft = daysUntilExpiration - day;
                  const title = `${style.icon} Alerta de Validade`;
                  const body = formatExpirationMessage(daysLeft, product.descricao, product.validade);

                  const notificationContent = {
                    title,
                    body,
                    data: {
                      productId: product.id,
                      alertLevel: autoAlertLevel,
                      expirationDate: product.validade,
                      daysUntilExpiration: daysLeft,
                      strategy: 'daily'
                    },
                    android: {
                      channelId: 'default',
                      sound: 'notification',
                      vibrationPattern: vibrationEnabled ? [250, 250] : undefined,
                      importance: AndroidImportance.HIGH,
                      pressAction: { id: 'default' },
                    },
                  };

                  try {
                    await notifee.createTriggerNotification(notificationContent, {
                      type: TriggerType.TIMESTAMP,
                      timestamp: notificationDate.getTime(),
                    });

                    scheduledCount++;
                    dailyCount++;
                  } catch (error) {
                    console.error(`Erro ao agendar notificação diária para ${product.descricao}:`, error);
                  }
                }
              }

            } else if (daysUntilExpiration <= 14) {
              for (let day = 0; day <= daysUntilExpiration; day += 2) {
                if (scheduledCount >= 450) break;

                const notificationDate = new Date(expirationDate);
                notificationDate.setDate(expirationDate.getDate() - day);
                notificationDate.setHours(9, 0, 0, 0);

                if (notificationDate > new Date()) {
                  const daysLeft = daysUntilExpiration - day;
                  const title = `${style.icon} Alerta de Validade`;
                  const body = formatExpirationMessage(daysLeft, product.descricao, product.validade);

                  const notificationContent = {
                    title,
                    body,
                    data: {
                      productId: product.id,
                      alertLevel: autoAlertLevel,
                      expirationDate: product.validade,
                      daysUntilExpiration: daysLeft,
                      strategy: 'alternate'
                    },
                    android: {
                      channelId: 'default',
                      sound: 'notification',
                      vibrationPattern: vibrationEnabled ? [250, 250] : undefined,
                      importance: AndroidImportance.HIGH,
                      pressAction: { id: 'default' },
                    },
                  };

                  try {
                    await notifee.createTriggerNotification(notificationContent, {
                      type: TriggerType.TIMESTAMP,
                      timestamp: notificationDate.getTime(),
                    });

                    scheduledCount++;
                    alternateCount++;
                  } catch (error) {
                    console.error(`Erro ao agendar notificação alternada para ${product.descricao}:`, error);
                  }
                }
              }

            } else if (daysUntilExpiration <= 21) {
              if (scheduledCount < 450) {
                const notificationDate = new Date(expirationDate);
                notificationDate.setDate(expirationDate.getDate() - 21);
                notificationDate.setHours(9, 0, 0, 0);

                if (notificationDate <= new Date()) {
                  notificationDate.setTime(new Date().getTime() + 24 * 60 * 60 * 1000);
                }

                if (notificationDate > new Date()) {
                  const title = `${style.icon} Alerta de Validade`;
                  const body = formatExpirationMessage(21, product.descricao, product.validade);

                  const notificationContent = {
                    title,
                    body,
                    data: {
                      productId: product.id,
                      alertLevel: autoAlertLevel,
                      expirationDate: product.validade,
                      daysUntilExpiration: 21,
                      strategy: 'once'
                    },
                    android: {
                      channelId: 'default',
                      sound: 'notification',
                      vibrationPattern: vibrationEnabled ? [250, 250] : undefined,
                      importance: AndroidImportance.HIGH,
                      pressAction: { id: 'default' },
                    },
                  };

                  try {
                    await notifee.createTriggerNotification(notificationContent, {
                      type: TriggerType.TIMESTAMP,
                      timestamp: notificationDate.getTime(),
                    });

                    scheduledCount++;
                    onceCount++;
                  } catch (error) {
                    console.error(`Erro ao agendar notificação única para ${product.descricao}:`, error);
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error(`Erro ao processar produto ${product.descricao}:`, error);
        }
      }

      const newStats = { total: scheduledCount, daily: dailyCount, alternate: alternateCount, once: onceCount };
      setNotificationStats(newStats);

      if (scheduledCount > 0) {
        Toast.show({
          type: 'success',
          text1: 'Notificações Configuradas',
          text2: `${scheduledCount} notificação(ões) agendadas com sucesso!\n\nEstratégia automática:\n• 1-7 dias: Notificação diária (CRÍTICO)\n• 8-14 dias: Dia sim, dia não (ATENÇÃO)\n• 15-21 dias: Uma vez só (NORMAL)`
        });
      } else {
        Toast.show({
          type: 'info',
          text1: 'Nenhuma Notificação',
          text2: 'Nenhum produto encontrado com data de vencimento nos próximos 21 dias para agendar notificações.'
        });
      }

      if (scheduledCount >= 450) {
        Toast.show({
          type: 'error',
          text1: 'Limite Aproximado',
          text2: 'O limite de notificações está próximo. Algumas notificações podem não ter sido agendadas.'
        });
      }

    } catch (error) {
      console.error('Erro ao agendar notificações:', error);
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Não foi possível agendar as notificações.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const StatCard = ({ title, value, icon, color, bgColor, community }) => (
    <View style={[styles.statCard, { backgroundColor: isDarkMode ? '#374151' : '#ffffff' }]}>
      <View style={[styles.statIcon, { backgroundColor: bgColor }]}>
        {community ? (
          <MaterialCommunityIcons name={icon} size={24} color={color} />
        ) : (
          <MaterialIcons name={icon} size={24} color={color} />
        )}
      </View>
      <Text style={[styles.statValue, isDarkMode ? styles.darkText : styles.lightText]}>
        {value}
      </Text>
      <Text style={[styles.statTitle, isDarkMode ? styles.darkText : styles.lightText]}>
        {title}
      </Text>
    </View>
  );

  const SettingItem = ({ icon, title, value, onToggle, iconColor, description }) => (
    <View style={[styles.settingGroup, isDarkMode ? styles.darkContainer : styles.lightContainer]}>
      <View style={styles.settingItem}>
        <MaterialIcons name={icon} size={24} color={iconColor || (isDarkMode ? '#fff' : '#374151')} />
        <View style={styles.settingTextContainer}>
          <Text style={[styles.settingText, isDarkMode ? styles.darkText : styles.lightText]}>
            {title}
          </Text>
          {description && (
            <Text style={[styles.settingDescription, isDarkMode ? styles.darkTextSecondary : styles.lightTextSecondary]}>
              {description}
            </Text>
          )}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{
          false: isDarkMode ? "#4B5563" : "#D1D5DB",
          true: isDarkMode ? "#10B981" : "#059669"
        }}
        thumbColor={value ? "#fff" : isDarkMode ? "#1F2937" : "#9CA3AF"}
        ios_backgroundColor={isDarkMode ? "#4B5563" : "#D1D5DB"}
      />
    </View>
  );

  // Função para obter estilos dinâmicos baseados no tema
  const getStyles = (isDarkMode) => StyleSheet.create({
    advancedOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10,
    },
    advancedContainer: {
      backgroundColor: isDarkMode ? '#23262F' : '#ffffff',
      borderRadius: 16,
      width: width * 0.85,
      padding: 20,
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
    },
    advancedHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    advancedTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    advancedTitle: {
      fontSize: 20,
      fontWeight: '700',
    },
    closeButton: {
      padding: 5,
    },
  });

  // Use os estilos dinâmicos
  const dynamicStyles = getStyles(isDarkMode);

  return (
    <View style={[styles.container, isDarkMode ? styles.darkBackground : styles.lightBackground]}>
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header com estatísticas */}
        <View style={[styles.headerCard, isDarkMode ? styles.darkContainer : styles.lightContainer]}>
          <View style={styles.headerContent}>
            <MaterialIcons name="analytics" size={32} color="#6cb6a5" />
            <Text style={[styles.headerTitle, isDarkMode ? styles.darkText : styles.lightText]}>
              Estatísticas de Notificações
            </Text>
          </View>
          <View style={styles.statsGrid}>
            <StatCard
              title="Total"
              value={notificationStats.total}
              icon="notifications-active"
              color="#6cb6a5"
              bgColor={isDarkMode ? '#1B4332' : '#E8F5E8'}
            />
            <StatCard
              title="Diárias"
              value={notificationStats.daily}
              icon="calendar-today"
              color="#e45635"
              bgColor={isDarkMode ? '#4A1C1C' : '#FFEBEE'}
            />
            <StatCard
              title="Alternadas"
              value={notificationStats.alternate}
              icon="swap-horizontal"
              color="#FFA000"
              bgColor={isDarkMode ? '#4A3C00' : '#FFF8E1'}
              community={true}
            />
            <StatCard
              title="Únicas"
              value={notificationStats.once}
              icon="star-circle"
              color="#3B82F6"
              bgColor={isDarkMode ? '#1E3A8A' : '#E0F2FE'}
              community={true}
            />
          </View>
        </View>

        {/* Configurações principais */}
        <Text style={[styles.sectionTitle, isDarkMode ? styles.darkText : styles.lightText]}>
          Configurações Principais
        </Text>

        <SettingItem
          icon="notifications-active"
          title="Ativar Notificações"
          value={isNotificationsEnabled}
          onToggle={setIsNotificationsEnabled}
          iconColor="#FF6B35"
          description="Habilita ou desabilita todas as notificações"
        />

        <SettingItem
          icon="vibration"
          title="Vibração"
          value={vibrationEnabled}
          onToggle={setVibrationEnabled}
          iconColor="#3B82F6"
          description="Adiciona vibração às notificações"
        />



        {/* Configurações avançadas */}
        {showAdvanced && (
          <TouchableOpacity
            style={dynamicStyles.advancedOverlay}
            activeOpacity={1}
            onPress={() => setShowAdvanced(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
              style={dynamicStyles.advancedContainer}
            >
              <View style={dynamicStyles.advancedHeader}>
                <View style={dynamicStyles.advancedTitleContainer}>
                  <MaterialCommunityIcons
                    name="cog"
                    size={24}
                    color={isDarkMode ? '#FFFFFF' : '#333333'}
                  />
                  <Text style={[dynamicStyles.advancedTitle, isDarkMode ? styles.darkText : styles.lightText]}>
                    Configurações Avançadas
                  </Text>
                </View>
                <TouchableOpacity
                  style={dynamicStyles.closeButton}
                  onPress={() => setShowAdvanced(false)}
                >
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={28}
                    color={isDarkMode ? '#FF6B6B' : '#B00020'}
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[
                  styles.advancedButton,
                  { backgroundColor: isDarkMode ? '#4F46E5' : '#3B82F6' }
                ]}
                onPress={testNotification}
              >
                <MaterialCommunityIcons name="bell-alert" size={20} color="#FFFFFF" />
                <Text style={styles.advancedButtonText}>Testar Notificação</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.advancedButton,
                  { backgroundColor: isDarkMode ? '#059669' : '#10B981' }
                ]}
                onPress={loadNotificationStats}
              >
                <MaterialCommunityIcons name="refresh" size={20} color="#FFFFFF" />
                <Text style={styles.advancedButtonText}>Atualizar Estatísticas</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        )}

        {/* Ações principais */}
        <Text style={[styles.sectionTitle, isDarkMode ? styles.darkText : styles.lightText]}>
          Gerenciar Notificações
        </Text>

        <TouchableOpacity
          style={[styles.button, isDarkMode ? styles.darkButton : styles.lightButton, isLoading && styles.disabledButton]}
          onPress={updateNotificationSchedule}
          disabled={isLoading}
        >
          <MaterialCommunityIcons name="calendar-check" size={24} color="#FFFFFF" />
          <Text style={styles.buttonText}>
            {isLoading ? 'Agendando...' : 'Agendar Notificações'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.clearButton, isLoading && styles.disabledButton]}
          onPress={clearPastNotifications}
          disabled={isLoading}
        >
          <MaterialCommunityIcons name="bell-cancel" size={24} color="#FFFFFF" />
          <Text style={styles.buttonText}>
            {isLoading ? 'Limpando...' : 'Limpar Agendamentos'}
          </Text>
        </TouchableOpacity>

        {/* Informações */}
        <View style={[styles.infoContainer, isDarkMode ? styles.darkInfoContainer : styles.lightInfoContainer]}>
          <MaterialIcons name="info" size={20} color="#3B82F6" />
          <Text style={[styles.infoText, isDarkMode ? styles.darkText : styles.lightText]}>
            • 1-7 dias restantes: Notificação DIÁRIA (CRÍTICO){'\n'}
            • 8-14 dias restantes: Dia SIM, dia NÃO (ATENÇÃO){'\n'}
            • 15-21 dias restantes: Uma notificação ÚNICA (NORMAL){'\n'}
            • Horário padrão: 9h da manhã
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  darkBackground: {
    backgroundColor: '#181A20',
  },
  lightBackground: {
    backgroundColor: '#f5f5f5',
  },
  darkContainer: {
    backgroundColor: '#23262F',
  },
  lightContainer: {
    backgroundColor: '#ffffff',
  },
  headerCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 24,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
    opacity: 0.8,
  },
  settingGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  settingDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  darkText: {
    color: '#FFFFFF',
  },
  lightText: {
    color: '#374151',
  },
  darkTextSecondary: {
    color: '#B0B3B8',
  },
  lightTextSecondary: {
    color: '#6B7280',
  },
  levelSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  levelButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  levelButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  darkLevelButton: {
    borderColor: '#6B7280',
  },
  lightLevelButton: {
    borderColor: '#D1D5DB',
  },
  levelButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  levelButtonTextActive: {
    color: '#FFFFFF',
  },
  advancedToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  advancedSection: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  advancedTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  advancedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  testButton: {
    backgroundColor: '#3B82F6',
  },
  refreshButton: {
    backgroundColor: '#10B981',
  },
  advancedButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 8,
    paddingVertical: 16,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  lightButton: {
    backgroundColor: '#059669',
  },
  darkButton: {
    backgroundColor: '#10B981',
  },
  clearButton: {
    backgroundColor: '#DC2626',
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  darkInfoContainer: {
    backgroundColor: '#23262F',
  },
  lightInfoContainer: {
    backgroundColor: '#E5E7EB',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});

export default NotificationScreen; 
