import notifee, { AndroidImportance, TriggerType } from '@notifee/react-native';
import { Platform } from 'react-native';
import { loadValidadeProducts } from '../../validade/services/validadeProductsService';

const CHANNEL_ID = 'default';
const MAX_SCHEDULED_NOTIFICATIONS = 450;
const MAX_SCHEDULE_DAYS = 30;

export const setupNotificationChannels = async () => {
  if (Platform.OS !== 'android') return;

  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Notificações de Validade',
    importance: AndroidImportance.HIGH,
    vibration: true,
    vibrationPattern: [250, 250],
    lightColor: '#FF231F7C',
    sound: 'notification',
  });
};

export const getNotificationStats = async () => {
  const scheduledNotifications = await notifee.getTriggerNotifications();
  return {
    total: scheduledNotifications.length,
    daily: scheduledNotifications.filter((item) => item.notification?.data?.strategy === 'daily').length,
    alternate: scheduledNotifications.filter((item) => item.notification?.data?.strategy === 'alternate').length,
    once: scheduledNotifications.filter((item) => item.notification?.data?.strategy === 'once').length,
  };
};

export const getNotificationStyle = (level) => {
  switch (level) {
    case 'warning':
      return {
        icon: '⚠️',
        color: '#FFA000',
        bgColor: '#FFF8E1',
        darkBgColor: '#4A3C00',
      };
    case 'critical':
      return {
        icon: '🚨',
        color: '#e45635',
        bgColor: '#FFEBEE',
        darkBgColor: '#4A1C1C',
      };
    case 'normal':
    default:
      return {
        icon: '🔔',
        color: '#4CAF50',
        bgColor: '#E8F5E8',
        darkBgColor: '#1B4332',
      };
  }
};

export const formatExpirationMessage = (days, productName, expirationDate) => {
  if (days === 0) {
    return `Produto ${productName} vence HOJE! (${expirationDate})`;
  }
  if (days === 1) {
    return `Produto ${productName} vence AMANHÃ! (${expirationDate})`;
  }
  return `Produto ${productName} vence em ${days} dias (${expirationDate})`;
};

export const clearScheduledNotifications = async () => {
  await notifee.cancelAllNotifications();
  return {
    total: 0,
    daily: 0,
    alternate: 0,
    once: 0,
  };
};

export const sendTestNotification = async ({ alertLevel = 'normal', vibrationEnabled = true } = {}) => {
  const style = getNotificationStyle(alertLevel);
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 5);
  const body = formatExpirationMessage(5, 'Produto Teste', futureDate.toLocaleDateString('pt-BR'));

  await notifee.createTriggerNotification(
    {
      title: `${style.icon} Teste de Notificação`,
      body,
      data: { test: true },
      android: {
        channelId: CHANNEL_ID,
        sound: 'notification',
        vibrationPattern: vibrationEnabled ? [250, 250] : undefined,
        importance: AndroidImportance.HIGH,
        pressAction: { id: 'default' },
      },
    },
    {
      type: TriggerType.TIMESTAMP,
      timestamp: Date.now() + 3000,
    },
  );
};

const resolveAutoAlertLevel = (daysUntilExpiration) => {
  if (daysUntilExpiration <= 7) return 'critical';
  if (daysUntilExpiration <= 14) return 'warning';
  return 'normal';
};

const buildNotificationPayload = ({
  style,
  product,
  alertLevel,
  daysUntilExpiration,
  strategy,
  vibrationEnabled,
}) => ({
  title: `${style.icon} Alerta de Validade`,
  body: formatExpirationMessage(daysUntilExpiration, product.descricao, product.validade),
  data: {
    productId: product.id,
    alertLevel,
    expirationDate: product.validade,
    daysUntilExpiration,
    strategy,
  },
  android: {
    channelId: CHANNEL_ID,
    sound: 'notification',
    vibrationPattern: vibrationEnabled ? [250, 250] : undefined,
    importance: AndroidImportance.HIGH,
    pressAction: { id: 'default' },
  },
});

export const scheduleProductExpiryNotifications = async ({
  vibrationEnabled = true,
} = {}) => {
  await notifee.cancelAllNotifications();
  const products = await loadValidadeProducts({ preferRemote: false });

  if (!Array.isArray(products) || products.length === 0) {
    return {
      stats: { total: 0, daily: 0, alternate: 0, once: 0 },
      scheduledCount: 0,
      hasProducts: false,
    };
  }

  let scheduledCount = 0;
  let dailyCount = 0;
  let alternateCount = 0;
  let onceCount = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const product of products) {
    if (!product?.validade || !product?.descricao) continue;

    try {
      const expirationDate = new Date(product.validade);
      expirationDate.setHours(0, 0, 0, 0);

      const daysUntilExpiration = Math.ceil((expirationDate - today) / (1000 * 60 * 60 * 24));
      if (daysUntilExpiration <= 0 || daysUntilExpiration > MAX_SCHEDULE_DAYS) continue;

      const autoAlertLevel = resolveAutoAlertLevel(daysUntilExpiration);
      const style = getNotificationStyle(autoAlertLevel);

      if (daysUntilExpiration <= 7) {
        for (let day = 0; day <= daysUntilExpiration; day += 1) {
          if (scheduledCount >= MAX_SCHEDULED_NOTIFICATIONS) break;
          const notificationDate = new Date(expirationDate);
          notificationDate.setDate(expirationDate.getDate() - day);
          notificationDate.setHours(9, 0, 0, 0);
          if (notificationDate <= new Date()) continue;

          const daysLeft = daysUntilExpiration - day;
          await notifee.createTriggerNotification(
            buildNotificationPayload({
              style,
              product,
              alertLevel: autoAlertLevel,
              daysUntilExpiration: daysLeft,
              strategy: 'daily',
              vibrationEnabled,
            }),
            {
              type: TriggerType.TIMESTAMP,
              timestamp: notificationDate.getTime(),
            },
          );
          scheduledCount += 1;
          dailyCount += 1;
        }
        continue;
      }

      if (daysUntilExpiration <= 14) {
        for (let day = 0; day <= daysUntilExpiration; day += 2) {
          if (scheduledCount >= MAX_SCHEDULED_NOTIFICATIONS) break;
          const notificationDate = new Date(expirationDate);
          notificationDate.setDate(expirationDate.getDate() - day);
          notificationDate.setHours(9, 0, 0, 0);
          if (notificationDate <= new Date()) continue;

          const daysLeft = daysUntilExpiration - day;
          await notifee.createTriggerNotification(
            buildNotificationPayload({
              style,
              product,
              alertLevel: autoAlertLevel,
              daysUntilExpiration: daysLeft,
              strategy: 'alternate',
              vibrationEnabled,
            }),
            {
              type: TriggerType.TIMESTAMP,
              timestamp: notificationDate.getTime(),
            },
          );
          scheduledCount += 1;
          alternateCount += 1;
        }
        continue;
      }

      if (scheduledCount >= MAX_SCHEDULED_NOTIFICATIONS) continue;
      const notificationDate = new Date(expirationDate);
      notificationDate.setDate(expirationDate.getDate() - 21);
      notificationDate.setHours(9, 0, 0, 0);
      if (notificationDate <= new Date()) {
        notificationDate.setTime(new Date().getTime() + 24 * 60 * 60 * 1000);
      }
      if (notificationDate <= new Date()) continue;

      await notifee.createTriggerNotification(
        buildNotificationPayload({
          style,
          product,
          alertLevel: autoAlertLevel,
          daysUntilExpiration: 21,
          strategy: 'once',
          vibrationEnabled,
        }),
        {
          type: TriggerType.TIMESTAMP,
          timestamp: notificationDate.getTime(),
        },
      );
      scheduledCount += 1;
      onceCount += 1;
    } catch (error) {
      console.error(`Erro ao processar produto ${product?.descricao}:`, error);
    }
  }

  return {
    hasProducts: true,
    scheduledCount,
    stats: {
      total: scheduledCount,
      daily: dailyCount,
      alternate: alternateCount,
      once: onceCount,
    },
    limitReached: scheduledCount >= MAX_SCHEDULED_NOTIFICATIONS,
  };
};
