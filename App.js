import 'react-native-gesture-handler';
import React, { useEffect, useState, useRef } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme, useNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator, TransitionPresets } from '@react-navigation/stack';
import { StatusBar, Appearance, BackHandler, ToastAndroid, Platform, Alert, TouchableOpacity, View, Easing } from 'react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import changeNavigationBarColor from 'react-native-navigation-bar-color';
import Toast from 'react-native-toast-message';
import { toastConfig } from './src/shared/components/toastConfig';
import { Provider as PaperProvider } from 'react-native-paper';
import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { enableScreens } from 'react-native-screens';
import {
  getNavigationBarColor,
  getRouteHeaderBackground,
  getStatusBarStyle,
  isColorDark,
  shouldUseDarkNavigationBarIcons,
} from './src/shared/utils/systemBars';

// Importações de telas
import EntryScreen from './src/features/auth/screens/EntryScreen';
import ListScreen from './src/features/list/screens/ListScreen';
import HomeScreen from './src/features/home/screens/HomeScreen';
import EasterEggScreen from './src/features/home/screens/EasterEggScreen';
import ModuleFunctionsScreen from './src/features/home/screens/ModuleFunctionsScreen';
import ModuleBaseScreen from './src/features/modules/screens/ModuleBaseScreen';
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

const STANDARD_TRANSITION_SPEC = {
  open: {
    animation: 'timing',
    config: {
      duration: 260,
      easing: Easing.out(Easing.poly(4)),
    },
  },
  close: {
    animation: 'timing',
    config: {
      duration: 220,
      easing: Easing.in(Easing.poly(4)),
    },
  },
};

// Componente StatusBar customizado
const CustomStatusBar = ({ backgroundColor, barStyle, hidden = false, translucent = false }) => (
  <StatusBar
    translucent={translucent}
    backgroundColor={backgroundColor}
    animated
    barStyle={barStyle || (isColorDark(backgroundColor) ? 'light-content' : 'dark-content')}
    hidden={hidden}
  />
);

const AppBackground = ({ backgroundColor, children }) => {
  return (
    <View style={{ flex: 1, backgroundColor, position: 'relative', overflow: 'visible' }}>
      <View style={{ flex: 1 }}>
        {children}
      </View>
    </View>
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
  const [currentRoute, setCurrentRoute] = useState({ name: 'EntryScreen', params: undefined });
  const navigationRef = useNavigationContainerRef();
  const routeNameRef = useRef();
  const currentRouteName = currentRoute?.name || 'EntryScreen';
  const theme = isDarkMode ? DarkTheme : DefaultTheme;
  const isHomeRoute = currentRouteName === 'HomeScreen';
  const isScannerRoute = currentRouteName === 'BarcodeScannerScreen';
  const statusBarStyle = getStatusBarStyle(currentRouteName);
  const statusBarColor = isHomeRoute ? 'transparent' : statusBarBackground;
  const statusBarTranslucent = Platform.OS === 'android' && isHomeRoute;
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
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setIsDarkMode(colorScheme === 'dark');
    });

    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android' || isScannerRoute) {
      return;
    }

    const updateNavigationBar = async () => {
      try {
        const navBarColor = getNavigationBarColor(currentRoute, isDarkMode);
        const darkIcons = shouldUseDarkNavigationBarIcons(currentRoute, isDarkMode);
        await changeNavigationBarColor(navBarColor, darkIcons, true);
      } catch (error) {
        console.warn('Não foi possível atualizar a barra de navegação:', error);
      }
    };

    updateNavigationBar();
  }, [currentRoute, isDarkMode, isScannerRoute]);

  useEffect(() => {
    const route = navigationRef.getCurrentRoute() || currentRoute;
    if (route) {
      setStatusBarBackground(getRouteHeaderBackground(route, isDarkMode));
    }
  }, [isDarkMode, currentRoute]);

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
          <NavigationContainer 
            ref={navigationRef}
            theme={themed}
            onReady={() => {
              const route = navigationRef.getCurrentRoute() || { name: 'EntryScreen', params: undefined };
              routeNameRef.current = route.name;
              setCurrentRoute(route);
              setStatusBarBackground(getRouteHeaderBackground(route, isDarkMode));
            }}
            onStateChange={() => {
              const route = navigationRef.getCurrentRoute() || { name: 'EntryScreen', params: undefined };
              routeNameRef.current = route.name;
              setCurrentRoute(route);
              setStatusBarBackground(getRouteHeaderBackground(route, isDarkMode));
            }}
          >
            <CustomStatusBar
              key={`${currentRouteName}-${statusBarStyle}-${statusBarColor}-${statusBarTranslucent ? 'translucent' : 'opaque'}-${isScannerRoute ? 'hidden' : 'shown'}`}
              backgroundColor={statusBarColor}
              barStyle={statusBarStyle}
              hidden={isScannerRoute}
              translucent={statusBarTranslucent}
            />

          <Stack.Navigator
            initialRouteName="EntryScreen"
            screenOptions={({ route }) => {
              const routeColor = getRouteHeaderBackground(route, isDarkMode);
              const transitionBackground = isDarkMode ? '#1f2438' : '#f7f7f8';
              return {
              headerBackTitleVisible: false,
              headerBackTitle: '',
              headerLeftContainerStyle: { paddingLeft: 12 },
              headerTitleAlign: 'left',
              animationEnabled: true,
              gestureEnabled: true,
              gestureDirection: 'horizontal',
              animationTypeForReplace: 'push',
              ...TransitionPresets.SlideFromRightIOS,
              transitionSpec: STANDARD_TRANSITION_SPEC,
              headerLeft: (props) => (
                <BackButton
                  tintColor={props.tintColor}
                  canGoBack={props.canGoBack}
                  onPress={() => navigationRef.current?.goBack()}
                />
              ),
              headerStyle: { backgroundColor: routeColor },
              headerTintColor: isColorDark(routeColor) ? '#FFFFFF' : '#111827',
              cardStyle: { backgroundColor: transitionBackground },
              contentStyle: { backgroundColor: transitionBackground },
            };
            }}
          >

            <Stack.Screen name="EntryScreen">
              {props => <EntryScreen {...props} isDarkMode={isDarkMode} />}
            </Stack.Screen>

            <Stack.Screen name="HomeScreen" options={{ headerShown: false }}>
              {props => <HomeScreen {...props} isDarkMode={isDarkMode} />}
            </Stack.Screen>

            <Stack.Screen name="EasterEggScreen" options={{ headerShown: false }}>
              {props => <EasterEggScreen {...props} isDarkMode={isDarkMode} />}
            </Stack.Screen>

            <Stack.Screen
              name="ModuleFunctionsScreen"
              options={({ route }) => ({
                title: route.params?.module?.title || 'Funcionalidades',
              })}
            >
              {props => <ModuleFunctionsScreen {...props} isDarkMode={isDarkMode} />}
            </Stack.Screen>

            <Stack.Screen
              name="ModuleBaseScreen"
              options={({ route }) => ({
                title: route.params?.title || 'Funcionalidade',
              })}
            >
              {props => <ModuleBaseScreen {...props} isDarkMode={isDarkMode} />}
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

            <Stack.Screen name="BarcodeScannerScreen" options={{ headerShown: false }}>
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
