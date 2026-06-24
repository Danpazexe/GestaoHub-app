import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Share,
  Platform,
  Dimensions,
  PixelRatio,
  PermissionsAndroid,
  NativeModules,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, { AuthorizationStatus } from '@notifee/react-native';
import { Camera } from 'react-native-vision-camera';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { version } from '../../../../package.json';
import { CORESHOME } from '../../../components/coresAuth';
import { SUPABASE_CONFIG } from '../../../services/supabaseConfig';
import { getSupabaseClient, isSupabaseConfigured } from '../../../services/supabaseClient';

const COLORS = CORESHOME;
const TOKEN_STORAGE_KEYS = ['fcmToken', 'firebaseToken', 'pushToken', 'deviceToken', 'notificationToken'];
const TOKEN_KEY_HINT_REGEX = /(token|fcm|firebase|push|messag)/i;

const isMeaningfulString = (value) =>
  typeof value === 'string' && value.trim().length > 0;

const safeCallNativeMethod = async (module, methodName, ...args) => {
  try {
    if (!module || typeof module[methodName] !== 'function') {
      return null;
    }
    const result = module[methodName](...args);
    return await Promise.resolve(result);
  } catch {
    return null;
  }
};

const getReactNativeVersion = () => {
  const rn = Platform.constants?.reactNativeVersion;
  if (!rn) return 'n/a';
  return `${rn.major}.${rn.minor}.${rn.patch}`;
};

const extractHostFromScriptUrl = () => {
  try {
    const scriptURL = NativeModules?.SourceCode?.scriptURL;
    if (!isMeaningfulString(scriptURL)) return null;
    const hostMatch = scriptURL.match(/\/\/([^/:]+)(?::\d+)?/);
    return hostMatch?.[1] || null;
  } catch {
    return null;
  }
};

const getDeviceInfo = async () => {
  const constants = Platform.constants || {};
  const rnDeviceInfo = NativeModules?.RNDeviceInfo;

  const [nativeName, nativeBrand, nativeModel, nativeSystemVersion] = await Promise.all([
    safeCallNativeMethod(rnDeviceInfo, 'getDeviceName'),
    safeCallNativeMethod(rnDeviceInfo, 'getBrand'),
    safeCallNativeMethod(rnDeviceInfo, 'getModel'),
    safeCallNativeMethod(rnDeviceInfo, 'getSystemVersion'),
  ]);

  const brand = nativeBrand || constants.Brand || constants.brand || 'n/a';
  const model = nativeModel || constants.Model || constants.model || 'n/a';
  const fallbackName = constants.deviceName || constants.systemName || 'n/a';
  const deviceName = nativeName
    || ([brand, model].filter((item) => isMeaningfulString(item) && item !== 'n/a').join(' ') || fallbackName);

  const screen = Dimensions.get('screen');
  const windowSize = Dimensions.get('window');

  return {
    brand,
    model,
    deviceName: deviceName || 'n/a',
    osName: Platform.OS === 'android' ? 'Android' : 'iOS',
    osVersion: String(nativeSystemVersion || Platform.Version || 'n/a'),
    displayWindow: `${Math.round(windowSize.width)} x ${Math.round(windowSize.height)}`,
    displayScreen: `${Math.round(screen.width)} x ${Math.round(screen.height)}`,
    pixelRatio: PixelRatio.get().toFixed(2),
    fontScale: PixelRatio.getFontScale().toFixed(2),
  };
};

const fetchJsonWithTimeout = async (url, timeoutMs = 1800) => {
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs));
  const request = fetch(url)
    .then((response) => response.json())
    .catch(() => null);
  return Promise.race([request, timeout]);
};

const getPublicIpAddress = async () => {
  try {
    const primary = await fetchJsonWithTimeout('https://api64.ipify.org?format=json');
    if (isMeaningfulString(primary?.ip)) return primary.ip;

    const fallback = await fetchJsonWithTimeout('https://ifconfig.co/json');
    if (isMeaningfulString(fallback?.ip)) return fallback.ip;
  } catch {
    // no-op
  }

  return 'Indisponivel';
};

const getLocalIpAddress = async () => {
  try {
    const networkInfo = NativeModules?.RNNetworkInfo;
    const byNetworkInfo = await safeCallNativeMethod(networkInfo, 'getIPAddress');
    if (isMeaningfulString(byNetworkInfo)) return String(byNetworkInfo);

    const rnDeviceInfo = NativeModules?.RNDeviceInfo;
    const byDeviceInfo = await safeCallNativeMethod(rnDeviceInfo, 'getIpAddress');
    if (isMeaningfulString(byDeviceInfo)) return String(byDeviceInfo);
  } catch {
    // no-op
  }

  const hostFromScript = extractHostFromScriptUrl();
  if (isMeaningfulString(hostFromScript)) return hostFromScript;

  return 'Indisponivel';
};

const normalizeMacAddress = (value) => {
  if (!isMeaningfulString(value)) return null;
  const normalized = String(value).trim();
  if (normalized === '02:00:00:00:00:00') {
    return 'Indisponivel (restricao do SO)';
  }
  return normalized;
};

const getMacAddress = async () => {
  try {
    const networkInfo = NativeModules?.RNNetworkInfo;
    const byNetworkInfo = await safeCallNativeMethod(networkInfo, 'getMacAddress');
    const normalizedNetworkInfo = normalizeMacAddress(byNetworkInfo);
    if (normalizedNetworkInfo) return normalizedNetworkInfo;

    const rnDeviceInfo = NativeModules?.RNDeviceInfo;
    const byDeviceInfo = await safeCallNativeMethod(rnDeviceInfo, 'getMacAddress');
    const normalizedDeviceInfo = normalizeMacAddress(byDeviceInfo);
    if (normalizedDeviceInfo) return normalizedDeviceInfo;
  } catch {
    // no-op
  }

  return 'Indisponivel (restricao do SO)';
};

const isLikelyPushToken = (value) => {
  if (!isMeaningfulString(value)) return false;
  const trimmed = value.trim();
  if (trimmed.length >= 120) return true;
  if (trimmed.length >= 64 && /[:._-]/.test(trimmed)) return true;
  return false;
};

const findTokenInObject = (value, depth = 0) => {
  if (depth > 4 || value == null) return null;

  if (typeof value === 'string') {
    if (isLikelyPushToken(value)) return value;
    try {
      const parsed = JSON.parse(value);
      return findTokenInObject(parsed, depth + 1);
    } catch {
      return null;
    }
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findTokenInObject(item, depth + 1);
      if (found) return found;
    }
    return null;
  }

  if (typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      if (TOKEN_KEY_HINT_REGEX.test(key) && typeof nested === 'string' && isLikelyPushToken(nested)) {
        return nested;
      }
      const found = findTokenInObject(nested, depth + 1);
      if (found) return found;
    }
  }

  return null;
};

const getStoredFcmToken = async () => {
  try {
    const direct = await AsyncStorage.multiGet(TOKEN_STORAGE_KEYS);
    const directToken = direct
      .map(([, value]) => value)
      .find((value) => isLikelyPushToken(value));
    if (directToken) return directToken;

    const allKeys = await AsyncStorage.getAllKeys();
    const filteredKeys = allKeys.filter((key) => TOKEN_KEY_HINT_REGEX.test(key)).slice(0, 120);
    if (!filteredKeys.length) return null;

    const values = await AsyncStorage.multiGet(filteredKeys);
    for (const [, rawValue] of values) {
      const found = findTokenInObject(rawValue);
      if (found) return found;
    }
  } catch {
    return null;
  }

  return null;
};

const getNativeFcmToken = async () => {
  try {
    const nativeMessaging = NativeModules?.RNFBMessagingModule;
    const token = await safeCallNativeMethod(nativeMessaging, 'getToken');
    if (isLikelyPushToken(token) || (isMeaningfulString(token) && token.length > 20)) {
      return token;
    }
  } catch {
    // no-op
  }

  return null;
};

const getFcmToken = async () => {
  const nativeToken = await getNativeFcmToken();
  if (nativeToken) return nativeToken;

  const storedToken = await getStoredFcmToken();
  if (storedToken) return storedToken;

  return 'Indisponivel (FCM nao configurado)';
};

const normalizePermissionStatus = (status) => {
  if (status === true || status === 'granted' || status === 'authorized') {
    return { granted: true, statusText: String(status) };
  }

  if (status === false || status === 'denied' || status === 'blocked' || status === 'restricted') {
    return { granted: false, statusText: String(status) };
  }

  return { granted: null, statusText: String(status ?? 'unavailable') };
};

const mapNotificationAuthorizationStatus = (status) => {
  switch (status) {
    case AuthorizationStatus.NOT_DETERMINED:
      return 'NOT_DETERMINED';
    case AuthorizationStatus.DENIED:
      return 'DENIED';
    case AuthorizationStatus.AUTHORIZED:
      return 'AUTHORIZED';
    case AuthorizationStatus.PROVISIONAL:
      return 'PROVISIONAL';
    case AuthorizationStatus.EPHEMERAL:
      return 'EPHEMERAL';
    default:
      return String(status ?? 'unknown');
  }
};

const getNotificationPermission = async () => {
  try {
    const settings = await notifee.getNotificationSettings();
    const status = settings?.authorizationStatus;
    const granted = [
      AuthorizationStatus.AUTHORIZED,
      AuthorizationStatus.PROVISIONAL,
      AuthorizationStatus.EPHEMERAL,
    ].includes(status);
    return {
      label: 'NOTIFICATIONS',
      granted,
      statusText: mapNotificationAuthorizationStatus(status),
    };
  } catch {
    return { label: 'NOTIFICATIONS', granted: null, statusText: 'unavailable' };
  }
};

const getCameraPermission = async () => {
  try {
    const status = await Promise.resolve(Camera.getCameraPermissionStatus());
    return { label: 'CAMERA', ...normalizePermissionStatus(status) };
  } catch {
    return { label: 'CAMERA', granted: null, statusText: 'unavailable' };
  }
};

const getAndroidRuntimePermissions = async () => {
  if (Platform.OS !== 'android') {
    return [];
  }

  const apiLevel = Number(Platform.Version) || 0;
  const declaredPermissions = [
    apiLevel >= 33
      ? { label: 'POST_NOTIFICATIONS', permission: PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS }
      : null,
    { label: 'CAMERA', permission: PermissionsAndroid.PERMISSIONS.CAMERA },
    apiLevel >= 33
      ? { label: 'READ_MEDIA_IMAGES', permission: PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES }
      : null,
    apiLevel <= 32
      ? { label: 'READ_EXTERNAL_STORAGE', permission: PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE }
      : null,
    apiLevel <= 28
      ? { label: 'WRITE_EXTERNAL_STORAGE', permission: PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE }
      : null,
  ].filter((item) => item?.permission);

  return Promise.all(
    declaredPermissions.map(async (item) => {
      try {
        const granted = await PermissionsAndroid.check(item.permission);
        return {
          label: item.label,
          granted,
          statusText: granted ? 'granted' : 'denied',
        };
      } catch {
        return {
          label: item.label,
          granted: null,
          statusText: 'unavailable',
        };
      }
    }),
  );
};

const getRelevantPermissions = async () => {
  if (Platform.OS === 'android') {
    return getAndroidRuntimePermissions();
  }

  const [notifPermission, cameraPermission] = await Promise.all([
    getNotificationPermission(),
    getCameraPermission(),
  ]);

  return [notifPermission, cameraPermission];
};

const getSupabaseHealth = async () => {
  const configured = isSupabaseConfigured();

  if (!configured) {
    return {
      configured: false,
      connected: false,
      statusText: 'Nao configurado',
      detail: 'Defina url e anonKey em supabaseConfig.js',
    };
  }

  const client = getSupabaseClient();
  if (!client) {
    return {
      configured: true,
      connected: false,
      statusText: 'Cliente indisponivel',
      detail: 'Falha ao inicializar cliente Supabase',
    };
  }

  try {
    const { error } = await client
      .from(SUPABASE_CONFIG.storageTable)
      .select('id')
      .limit(1);

    if (error) {
      return {
        configured: true,
        connected: false,
        statusText: 'Offline',
        detail: error.message,
      };
    }

    return {
      configured: true,
      connected: true,
      statusText: 'Online',
      detail: 'Conexao e consulta OK',
    };
  } catch (error) {
    return {
      configured: true,
      connected: false,
      statusText: 'Offline',
      detail: error?.message || 'Erro desconhecido',
    };
  }
};

const compactToken = (token) => {
  if (!isMeaningfulString(token)) return token;
  if (token.length < 30) return token;
  return `${token.slice(0, 16)}...${token.slice(-12)}`;
};

const InfoRow = ({ label, value, dark }) => (
  <View style={styles.row}>
    <Text style={[styles.rowLabel, dark && styles.rowLabelDark]}>{label}</Text>
    <Text style={[styles.rowValue, dark && styles.rowValueDark]}>{value ?? '-'}</Text>
  </View>
);

const Section = ({ title, dark, children }) => (
  <View style={[styles.section, dark && styles.sectionDark]}>
    <Text style={[styles.sectionTitle, dark && styles.sectionTitleDark]}>{title}</Text>
    {children}
  </View>
);

const EasterEggScreen = ({ navigation, isDarkMode }) => {
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState(null);

  const loadDiagnostics = useCallback(async () => {
    setLoading(true);
    try {
      const [storedProducts, storedUserData] = await Promise.all([
        AsyncStorage.getItem('products'),
        AsyncStorage.getItem('userData'),
      ]);

      const products = storedProducts ? JSON.parse(storedProducts) : [];
      const userData = storedUserData ? JSON.parse(storedUserData) : null;

      const [
        deviceInfo,
        localIpAddress,
        publicIpAddress,
        macAddress,
        fcmToken,
        allPermissions,
        supabaseHealth,
      ] = await Promise.all([
        getDeviceInfo(),
        getLocalIpAddress(),
        getPublicIpAddress(),
        getMacAddress(),
        getFcmToken(),
        getRelevantPermissions(),
        getSupabaseHealth(),
      ]);

      const permissionsAllowed = allPermissions
        .filter((item) => item.granted === true)
        .map((item) => item.label);
      const permissionsDenied = allPermissions
        .filter((item) => item.granted === false)
        .map((item) => item.label);
      const permissionsUnknown = allPermissions
        .filter((item) => item.granted === null)
        .map((item) => item.label);

      const expired = products.filter((item) => {
        const parsed = new Date(item?.validade);
        if (Number.isNaN(parsed.getTime())) return false;
        const now = new Date();
        parsed.setHours(0, 0, 0, 0);
        now.setHours(0, 0, 0, 0);
        return parsed < now;
      }).length;

      setSnapshot({
        generatedAt: new Date().toISOString(),
        appVersion: version,
        rnVersion: getReactNativeVersion(),
        jsEngine: global.HermesInternal ? 'Hermes' : 'JSC',
        os: `${deviceInfo.osName} ${deviceInfo.osVersion}`,
        deviceName: deviceInfo.deviceName,
        deviceBrand: deviceInfo.brand,
        deviceModel: deviceInfo.model,
        localIpAddress,
        publicIpAddress,
        macAddress,
        displayWindow: deviceInfo.displayWindow,
        displayScreen: deviceInfo.displayScreen,
        pixelRatio: deviceInfo.pixelRatio,
        fontScale: deviceInfo.fontScale,
        userName: userData?.name || 'n/a',
        userEmail: userData?.email || 'n/a',
        productTotal: products.length,
        productExpired: expired,
        fcmToken,
        permissionDetails: allPermissions,
        permissionsAllowed,
        permissionsDenied,
        permissionsUnknown,
        supabaseConfigured: supabaseHealth.configured,
        supabaseConnected: supabaseHealth.connected,
        supabaseStatusText: supabaseHealth.statusText,
        supabaseDetail: supabaseHealth.detail,
        supabaseTable: SUPABASE_CONFIG.storageTable,
      });
    } catch (error) {
      setSnapshot({
        generatedAt: new Date().toISOString(),
        error: error?.message || 'Erro ao montar diagnostico',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDiagnostics();
  }, [loadDiagnostics]);

  const reportText = useMemo(() => {
    if (!snapshot) return '';
    return [
      'GESTAO HUB - DEV PANEL',
      `Gerado em: ${snapshot.generatedAt}`,
      `App: ${snapshot.appVersion || 'n/a'}`,
      `React Native: ${snapshot.rnVersion || 'n/a'}`,
      `Engine: ${snapshot.jsEngine || 'n/a'}`,
      `SO: ${snapshot.os || 'n/a'}`,
      `Dispositivo: ${snapshot.deviceName || 'n/a'}`,
      `Marca: ${snapshot.deviceBrand || 'n/a'}`,
      `Modelo: ${snapshot.deviceModel || 'n/a'}`,
      `IP local: ${snapshot.localIpAddress || 'n/a'}`,
      `IP publico: ${snapshot.publicIpAddress || 'n/a'}`,
      `MAC: ${snapshot.macAddress || 'n/a'}`,
      `Display(window): ${snapshot.displayWindow || 'n/a'}`,
      `Display(screen): ${snapshot.displayScreen || 'n/a'}`,
      `Pixel ratio: ${snapshot.pixelRatio || 'n/a'}`,
      `Font scale: ${snapshot.fontScale || 'n/a'}`,
      `Usuario: ${snapshot.userName || 'n/a'}`,
      `Email: ${snapshot.userEmail || 'n/a'}`,
      `FCM Token: ${snapshot.fcmToken || 'n/a'}`,
      `Supabase configurado: ${snapshot.supabaseConfigured ? 'sim' : 'nao'}`,
      `Supabase status: ${snapshot.supabaseStatusText || 'n/a'}`,
      `Supabase tabela: ${snapshot.supabaseTable || 'n/a'}`,
      `Supabase detalhe: ${snapshot.supabaseDetail || 'n/a'}`,
      `Produtos total: ${snapshot.productTotal ?? 'n/a'}`,
      `Produtos vencidos: ${snapshot.productExpired ?? 'n/a'}`,
      `Permissoes permitidas: ${snapshot.permissionsAllowed?.join(', ') || 'nenhuma'}`,
      `Permissoes negadas: ${snapshot.permissionsDenied?.join(', ') || 'nenhuma'}`,
      `Permissoes desconhecidas: ${snapshot.permissionsUnknown?.join(', ') || 'nenhuma'}`,
      ...(snapshot.permissionDetails || []).map(
        (item) => `Permissao ${item.label}: ${item.statusText}`,
      ),
      snapshot.error ? `Erro: ${snapshot.error}` : '',
    ].filter(Boolean).join('\n');
  }, [snapshot]);

  const handleShareReport = async () => {
    if (!reportText) return;
    await Share.share({ message: reportText });
  };

  const formatGeneratedAt = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('pt-BR');
  };

  return (
    <SafeAreaView style={[styles.safeArea, isDarkMode && styles.safeAreaDark]} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, isDarkMode && styles.titleDark]}>Painel</Text>
          <Text style={[styles.subtitle, isDarkMode && styles.subtitleDark]}>Diagnostico tecnico do dispositivo e app</Text>
        </View>
        <Pressable style={({ pressed }) => [styles.closeButton, isDarkMode && styles.closeButtonDark, pressed && styles.pressed]} onPress={() => navigation.goBack()}>
          <MaterialIcons name="close" size={22} color={isDarkMode ? '#ffffff' : '#2f333a'} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Section title="Aplicativo" dark={isDarkMode}>
          <InfoRow label="Versao app" value={loading ? '...' : snapshot?.appVersion} dark={isDarkMode} />
          <InfoRow label="Gerado em" value={loading ? '...' : formatGeneratedAt(snapshot?.generatedAt)} dark={isDarkMode} />
          <InfoRow label="React Native" value={loading ? '...' : snapshot?.rnVersion} dark={isDarkMode} />
          <InfoRow label="Engine JS" value={loading ? '...' : snapshot?.jsEngine} dark={isDarkMode} />
        </Section>

        <Section title="Dispositivo e Rede" dark={isDarkMode}>
          <InfoRow label="Nome dispositivo" value={loading ? '...' : snapshot?.deviceName} dark={isDarkMode} />
          <InfoRow label="Marca" value={loading ? '...' : snapshot?.deviceBrand} dark={isDarkMode} />
          <InfoRow label="Modelo" value={loading ? '...' : snapshot?.deviceModel} dark={isDarkMode} />
          <InfoRow label="SO" value={loading ? '...' : snapshot?.os} dark={isDarkMode} />
          <InfoRow label="IP local" value={loading ? '...' : snapshot?.localIpAddress} dark={isDarkMode} />
          <InfoRow label="IP publico" value={loading ? '...' : snapshot?.publicIpAddress} dark={isDarkMode} />
          <InfoRow label="Endereco MAC" value={loading ? '...' : snapshot?.macAddress} dark={isDarkMode} />
          <InfoRow label="Display (window)" value={loading ? '...' : snapshot?.displayWindow} dark={isDarkMode} />
          <InfoRow label="Display (screen)" value={loading ? '...' : snapshot?.displayScreen} dark={isDarkMode} />
          <InfoRow label="Pixel ratio" value={loading ? '...' : snapshot?.pixelRatio} dark={isDarkMode} />
          <InfoRow label="Font scale" value={loading ? '...' : snapshot?.fontScale} dark={isDarkMode} />
        </Section>

        <Section title="Conta e Dados" dark={isDarkMode}>
          <InfoRow label="Usuario" value={loading ? '...' : snapshot?.userName} dark={isDarkMode} />
          <InfoRow label="Email" value={loading ? '...' : snapshot?.userEmail} dark={isDarkMode} />
          <InfoRow label="Produtos total" value={loading ? '...' : String(snapshot?.productTotal ?? '-')} dark={isDarkMode} />
          <InfoRow label="Produtos vencidos" value={loading ? '...' : String(snapshot?.productExpired ?? '-')} dark={isDarkMode} />
          <InfoRow label="FCM token" value={loading ? '...' : compactToken(snapshot?.fcmToken)} dark={isDarkMode} />
        </Section>

        <Section title="Supabase" dark={isDarkMode}>
          <InfoRow
            label="Configurado"
            value={loading ? '...' : snapshot?.supabaseConfigured ? 'Sim' : 'Nao'}
            dark={isDarkMode}
          />
          <InfoRow
            label="Status"
            value={loading ? '...' : snapshot?.supabaseStatusText}
            dark={isDarkMode}
          />
          <InfoRow
            label="Tabela"
            value={loading ? '...' : snapshot?.supabaseTable}
            dark={isDarkMode}
          />
          <InfoRow
            label="Detalhe"
            value={loading ? '...' : snapshot?.supabaseDetail}
            dark={isDarkMode}
          />
        </Section>

        <Section title="Permissoes" dark={isDarkMode}>
          <InfoRow
            label="Qtd permitidas"
            value={loading ? '...' : String(snapshot?.permissionsAllowed?.length || 0)}
            dark={isDarkMode}
          />
          <InfoRow
            label="Qtd nao permitidas"
            value={loading ? '...' : String(snapshot?.permissionsDenied?.length || 0)}
            dark={isDarkMode}
          />
          <InfoRow
            label="Qtd desconhecidas"
            value={loading ? '...' : String(snapshot?.permissionsUnknown?.length || 0)}
            dark={isDarkMode}
          />

          <View style={styles.permissionBlock}>
            <Text style={[styles.permissionTitle, isDarkMode && styles.permissionTitleDark]}>Status detalhado</Text>
            {(snapshot?.permissionDetails || []).map((item) => (
              <InfoRow
                key={item.label}
                label={item.label}
                value={item.statusText}
                dark={isDarkMode}
              />
            ))}
          </View>
        </Section>

        {snapshot?.error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>Erro: {snapshot.error}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={({ pressed }) => [styles.actionButton, styles.secondaryButton, pressed && styles.pressed]} onPress={loadDiagnostics}>
          <MaterialIcons name="refresh" size={18} color="#ffffff" />
          <Text style={styles.actionButtonText}>Atualizar</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.actionButton, styles.primaryButton, pressed && styles.pressed]} onPress={handleShareReport}>
          <MaterialIcons name="share" size={18} color="#ffffff" />
          <Text style={styles.actionButtonText}>Compartilhar</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f7f8',
  },
  safeAreaDark: {
    backgroundColor: '#1f2438',
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2f333a',
  },
  titleDark: {
    color: '#f3f5ff',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    color: 'rgba(47, 51, 58, 0.72)',
    fontWeight: '500',
  },
  subtitleDark: {
    color: '#aab1cf',
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(64, 68, 76, 0.14)',
  },
  closeButtonDark: {
    backgroundColor: '#2b3350',
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(64, 68, 76, 0.16)',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  sectionDark: {
    backgroundColor: '#262d47',
    borderColor: '#3a4265',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2f333a',
    marginBottom: 8,
  },
  sectionTitleDark: {
    color: '#f3f5ff',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  rowLabel: {
    fontSize: 13,
    color: 'rgba(47, 51, 58, 0.75)',
    fontWeight: '600',
    paddingRight: 10,
    flex: 1,
  },
  rowLabelDark: {
    color: '#aab1cf',
  },
  rowValue: {
    fontSize: 13,
    color: '#2f333a',
    fontWeight: '700',
    flex: 1.2,
    textAlign: 'right',
  },
  rowValueDark: {
    color: '#f3f5ff',
  },
  permissionBlock: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.3)',
  },
  permissionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2f333a',
    marginBottom: 4,
  },
  permissionTitleDark: {
    color: '#f3f5ff',
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 14,
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  primaryButton: {
    backgroundColor: COLORS.destaqueAzul,
  },
  secondaryButton: {
    backgroundColor: COLORS.destaqueCinza,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.98 }],
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  errorText: {
    color: '#ef4444',
    fontWeight: '700',
    fontSize: 12,
  },
});

export default EasterEggScreen;
