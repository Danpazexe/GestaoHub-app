import 'react-native-gesture-handler';
import React, { useEffect, useState, useRef } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme, useNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator, TransitionPresets } from '@react-navigation/stack';
import { StatusBar, Appearance, BackHandler, ToastAndroid, Platform, Alert, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets, initialWindowMetrics } from 'react-native-safe-area-context';
import changeNavigationBarColor from 'react-native-navigation-bar-color';
import Toast from 'react-native-toast-message';
import { toastConfig } from './src/shared/components/toastConfig';
import { Provider as PaperProvider, Portal } from 'react-native-paper';
import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { enableScreens } from 'react-native-screens';

// Importações de telas
import EntryScreen from './src/features/auth/screens/EntryScreen';
import ListScreen from './src/features/list/screens/ListScreen';
import HomeScreen from './src/features/home/screens/HomeScreen';
import AddProductScreen from './src/features/additem/screens/AddProductScreen';
import BarcodeScannerScreen from './src/features/additem/screens/BarcodeScannerScreen';
import SettingsScreen from './src/features/settings/screens/SettingsScreen';
import DashboardScreen from './src/features/dashboard/screens/DashboardScreen';
import ExcelScreen from './src/features/excel/screens/ExcelScreen';
import LoginScreen from './src/features/auth/screens/LoginScreen';
import ProfileScreen from "./src/features/profile/screens/ProfileScreen";
import TratarScreen from './src/features/tratar/screens/TratarScreen';
import NotificationScreen from './src/features/notification/screens/NotificationScreen';
import SqlScreen from './src/features/sql/screens/SqlScreen';
import RegisterScreen from './src/features/auth/screens/RegisterScreen';
import PdfScreen from './src/features/pdf/screens/PdfScreen';
import PdfViewerScreen from './src/features/pdf/screens/PdfViewerScreen';

const Stack = createStackNavigator();
// Aggressive fix for iOS status bar background issues.
enableScreens(Platform.OS === 'android');

const getStatusBarBackground = (routeName, isDarkMode) => {
  const light = {
    EntryScreen: '#ffffff',
    LoginScreen: '#ffffff',
    RegisterScreen: '#ffffff',
    HomeScreen: '#f7f7f8',
    ListScreen: '#40444c',
    AddProductScreen: '#40444c',
    DashboardScreen: '#C42D2F',
    SettingsScreen: '#374151',
    ProfileScreen: '#f7f7f8',
    NotificationSettings: '#6cb6a5',
    SqlScreen: '#2563EB',
    TratarScreen: '#FFA500',
    ExcelScreen: '#012677',
    PdfScreen: '#d7263d',
    PdfViewerScreen: '#f7f7f8',
  };

  const dark = {
    EntryScreen: '#2f333a',
    LoginScreen: '#2f333a',
    RegisterScreen: '#2f333a',
    HomeScreen: '#2f333a',
    ListScreen: '#2f333a',
    AddProductScreen: '#2f333a',
    DashboardScreen: '#2f333a',
    SettingsScreen: '#1F2937',
    ProfileScreen: '#2f333a',
    NotificationSettings: '#1a4645',
    SqlScreen: '#1E40AF',
    TratarScreen: '#2e2e2e',
    ExcelScreen: '#012677',
    PdfScreen: '#d7263d',
    PdfViewerScreen: '#2f333a',
  };

  const palette = isDarkMode ? dark : light;
  return palette[routeName] || (isDarkMode ? '#2f333a' : '#f7f7f8');
};

const hexToRgb = (hex) => {
  const normalized = hex.replace('#', '');
  const isShort = normalized.length === 3;
  const full = isShort
    ? normalized.split('').map((c) => c + c).join('')
    : normalized;
  const num = parseInt(full, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
};

const isColorDark = (hex) => {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.6;
};

// Componente StatusBar customizado
const CustomStatusBar = ({ isDarkMode, backgroundColor }) => (
  <View style={{ backgroundColor }}>
    <StatusBar
      translucent
      backgroundColor="transparent"
      animated
      barStyle={isColorDark(backgroundColor) ? 'light-content' : 'dark-content'}
      hidden={false}
    />
  </View>
);

const AppBackground = ({ backgroundColor, children }) => {
  const insets = useSafeAreaInsets();
  const topInset = insets.top || initialWindowMetrics?.insets.top || 0;
  const overlayHeight = Math.max(topInset, 60);

  return (
    <View style={{ flex: 1, backgroundColor, position: 'relative', overflow: 'visible' }}>
      <View style={{ flex: 1 }}>
        {children}
      </View>
    </View>
  );
};

const StatusBarOverlay = ({ color }) => {
  const insets = useSafeAreaInsets();
  const topInset = insets.top || initialWindowMetrics?.insets.top || 0;
  const overlayHeight = Math.max(topInset, 60);
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: overlayHeight,
        backgroundColor: color,
        zIndex: 9999,
      }}
    />
  );
};

const BackButton = ({ tintColor, canGoBack, onPress }) => {
  if (!canGoBack) return null;
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ paddingHorizontal: 12, paddingVertical: 8 }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <MaterialIcons name="arrow-back" size={24} color={tintColor} />
    </TouchableOpacity>
  );
};

// Configure as notificações em segundo plano
const configurePushNotifications = async () => {
  try {
    await notifee.requestPermission();

    if (Platform.OS === 'android') {
      await notifee.createChannel({
        id: 'default',
        name: 'Validade de Produtos',
        importance: AndroidImportance.HIGH,
        vibration: true,
        vibrationPattern: [0, 250, 250, 250],
        lights: true,
        lightColor: '#FF231F7C',
        sound: 'notification',
      });
    }

    return true;
  } catch (error) {
    console.error('Erro ao configurar notificações:', error);
    return false;
  }
};

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(Appearance.getColorScheme() === 'dark');
  const [lastBackPress, setLastBackPress] = useState(0);
  const [statusBarBackground, setStatusBarBackground] = useState('#f7f7f8');
  const navigationRef = useNavigationContainerRef();
  const routeNameRef = useRef();
  const theme = isDarkMode ? DarkTheme : DefaultTheme;
  const themed = {
    ...theme,
    colors: {
      ...theme.colors,
      background: statusBarBackground,
    },
  };

  useEffect(() => {
    configurePushNotifications();
    checkNotificationPermissions();
  }, []);

  const checkNotificationPermissions = async () => {
    try {
      await notifee.requestPermission();
      console.log('Permissões de notificação solicitadas');
      return true;
    } catch (error) {
      console.error('Erro ao verificar permissões de notificação:', error);
      return false;
    }
  };

  useEffect(() => {
    let unsubscribe;

    const configureNotifications = async () => {
      await notifee.requestPermission();

      if (Platform.OS === 'android') {
        await notifee.createChannel({
          id: 'default',
          name: 'Validade de Produtos',
          importance: AndroidImportance.HIGH,
          vibration: true,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          sound: 'notification',
        });
      }

      unsubscribe = notifee.onForegroundEvent(({ type, detail }) => {
        if (type === EventType.DELIVERED) {
          console.log('Notificação recebida:', detail.notification);
        }
      });
    };

    configureNotifications();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    const updateNavigationBar = async () => {
      try {
        await changeNavigationBarColor('transparent', !isDarkMode);
      } catch (error) {
        console.warn('Não foi possível atualizar a barra de navegação:', error);
      }
    };
    updateNavigationBar();

    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setIsDarkMode(colorScheme === 'dark');
    });

    return () => subscription?.remove();
  }, [isDarkMode]);

  useEffect(() => {
    const currentRouteName = navigationRef.getCurrentRoute()?.name;
    if (currentRouteName) {
      setStatusBarBackground(getStatusBarBackground(currentRouteName, isDarkMode));
    }
  }, [isDarkMode]);

  useEffect(() => {
    const backAction = () => {
      const currentRoute = routeNameRef.current;
      
      // Verifica se está na tela HomeScreen ou LoginScreen
      if (currentRoute === 'HomeScreen' || 
        currentRoute === 'LoginScreen'
      ) {
        const currentTime = new Date().getTime();
        
        if (currentTime - lastBackPress < 2000) {
          BackHandler.exitApp();
          return true;
        }

        setLastBackPress(currentTime);
        
        if (Platform.OS === 'android') {
          ToastAndroid.show('Pressione voltar novamente para sair', ToastAndroid.SHORT);
        } else {
          Alert.alert(
            'Sair do App',
            'Pressione voltar novamente para sair',
            [{ text: 'OK' }],
            { cancelable: false }
          );
        }
        
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, [lastBackPress]);

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <AppBackground backgroundColor={statusBarBackground}>
        <PaperProvider>
          <Portal>
            <StatusBarOverlay color={statusBarBackground} />
          </Portal>
          <NavigationContainer 
            ref={navigationRef}
            theme={themed}
            onReady={() => {
              routeNameRef.current = navigationRef.getCurrentRoute()?.name;
              setStatusBarBackground(getStatusBarBackground(routeNameRef.current, isDarkMode));
            }}
            onStateChange={() => {
              const currentRouteName = navigationRef.getCurrentRoute()?.name;
              routeNameRef.current = currentRouteName;
              setStatusBarBackground(getStatusBarBackground(currentRouteName, isDarkMode));
            }}
          >
            <CustomStatusBar isDarkMode={isDarkMode} backgroundColor={statusBarBackground} />

          <Stack.Navigator
            initialRouteName="EntryScreen"
            screenOptions={({ route }) => {
              const routeColor = getStatusBarBackground(route?.name, isDarkMode);
              return {
              headerBackTitleVisible: false,
              headerBackTitle: '',
              headerLeftContainerStyle: { paddingLeft: 12 },
              headerTitleAlign: 'left',
              animationEnabled: true,
              ...TransitionPresets.SlideFromRightIOS,
              headerLeft: (props) => (
                <BackButton
                  tintColor={props.tintColor}
                  canGoBack={props.canGoBack}
                  onPress={() => navigationRef.current?.goBack()}
                />
              ),
              headerStyle: { backgroundColor: routeColor },
              headerTintColor: isColorDark(routeColor) ? '#FFFFFF' : '#111827',
              cardStyle: { backgroundColor: routeColor },
              contentStyle: { backgroundColor: routeColor },
            };
            }}
          >

            <Stack.Screen name="EntryScreen">
              {props => <EntryScreen {...props} isDarkMode={isDarkMode} />}
            </Stack.Screen>

            <Stack.Screen name="HomeScreen" options={{ headerShown: false }}>
              {props => <HomeScreen {...props} isDarkMode={isDarkMode} />}
            </Stack.Screen>

            <Stack.Screen name="ListScreen">
              {props => <ListScreen {...props} isDarkMode={isDarkMode} />}
            </Stack.Screen>

            <Stack.Screen name="AddProductScreen">
              {props => <AddProductScreen {...props} isDarkMode={isDarkMode} />}
            </Stack.Screen>

            <Stack.Screen name="DashboardScreen">
              {props => <DashboardScreen {...props} isDarkMode={isDarkMode} />}
            </Stack.Screen>

            <Stack.Screen name="ExcelScreen">
              {props => <ExcelScreen {...props} isDarkMode={isDarkMode} />}
            </Stack.Screen>

            <Stack.Screen name="ProfileScreen">
              {props => <ProfileScreen {...props} isDarkMode={isDarkMode} />}
            </Stack.Screen>

            <Stack.Screen name="LoginScreen" options={{ headerShown: false }}>
              {props => <LoginScreen {...props} isDarkMode={isDarkMode} />}
            </Stack.Screen>

            <Stack.Screen name="RegisterScreen" options={{ headerShown: false }}>
              {props => <RegisterScreen {...props} isDarkMode={isDarkMode} />}
            </Stack.Screen>

            <Stack.Screen name="BarcodeScannerScreen">
              {props => <BarcodeScannerScreen {...props} />}
            </Stack.Screen>

            <Stack.Screen name="SettingsScreen">
              {props => <SettingsScreen {...props} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />}
            </Stack.Screen>

            <Stack.Screen name="TratarScreen">
              {props => <TratarScreen {...props} isDarkMode={isDarkMode} />}
            </Stack.Screen>



            <Stack.Screen name="NotificationSettings">
              {props => <NotificationScreen {...props} isDarkMode={isDarkMode} />}
            </Stack.Screen>

            <Stack.Screen name="SqlScreen">
              {props => <SqlScreen {...props} isDarkMode={isDarkMode} />}
            </Stack.Screen>

            <Stack.Screen name="PdfScreen">
              {props => <PdfScreen {...props} isDarkMode={isDarkMode} />}
            </Stack.Screen>

            <Stack.Screen name="PdfViewerScreen">
              {props => <PdfViewerScreen {...props} />}
            </Stack.Screen>

          </Stack.Navigator>

          <Toast config={toastConfig} position="bottom" bottomOffset={20} />
          
          </NavigationContainer>
        </PaperProvider>
      </AppBackground>
    </SafeAreaProvider>
  );
}
