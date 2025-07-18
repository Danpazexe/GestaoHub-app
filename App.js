import 'react-native-gesture-handler';
import React, { useEffect, useState, useRef } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme, useNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar, Appearance, BackHandler, ToastAndroid, Platform, Alert, SafeAreaView } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import Toast from 'react-native-toast-message';
import { toastConfig } from './Screen/Constants/toastConfig';
import { Provider as PaperProvider } from 'react-native-paper';
import * as Notifications from 'expo-notifications';
import '@react-native-firebase/app';

// Importações de telas
import EntryScreen from './Screen/Entrada/EntryScreen';
import ListScreen from './Screen/List/ListItemScreen';
import HomeScreen from './Screen/Menu/HomeScreen';
import AddProductScreen from './Screen/Additem/AddProductScreen';
import BarcodeScannerScreen from './Screen/Additem/BarcodeScannerScreen';
import SettingsScreen from './Screen/Opcoes/SettingsScreen';
import DashboardScreen from './Screen/Dashboard/DashboardScreen';
import ExcelScreen from './Screen/Excel/ExcelScreen';
import LoginScreen from './Screen/Entrada/LoginScreen';
import ProfileScreen from "./Screen/Perfil/ProfileScreen";
import TratarScreen from './Screen/Tratativas/TratarScreen';
import NotificationScreen from './Screen/Notificacao/NotificationScreen';
import SqlScreen from './Screen/SQL/SqlScreen';
import RegisterScreen from './Screen/Entrada/RegisterScreen';
import PdfScreen from './Screen/Pdf/PdfScreen';
import PdfViewerScreen from './Screen/Pdf/PdfViewerScreen';
import InventarioMenuScreen from './Screen/Inventario/InventarioMenuScreen';
import InventarioCriarScreen from './Screen/Inventario/InventarioCriarScreen';
import InventarioResultadosScreen from './Screen/Inventario/InventarioResultadosScreen';

const Stack = createStackNavigator();

// Componente StatusBar customizado
const CustomStatusBar = ({ isDarkMode }) => (
  <SafeAreaView style={{ backgroundColor: 'transparent' }}>
    <StatusBar
      translucent
      backgroundColor="transparent"
      animated
      barStyle={isDarkMode ? 'light-content' : 'dark-content'}
      hidden={false}
    />
  </SafeAreaView>
);

// Configure as notificações em segundo plano
const configurePushNotifications = async () => {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return false;
  }

  // Configuração específica para Android
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  return true;
};

// Configuração do handler de notificações (adicionar antes do App component)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(Appearance.getColorScheme() === 'dark');
  const [lastBackPress, setLastBackPress] = useState(0);
  const navigationRef = useNavigationContainerRef();
  const routeNameRef = useRef();

  useEffect(() => {
    configurePushNotifications();
    checkNotificationPermissions();
  }, []);

  const checkNotificationPermissions = async () => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Permissões de notificação não concedidas');
        return false;
      }

      console.log('Permissões de notificação concedidas');
      return true;
    } catch (error) {
      console.error('Erro ao verificar permissões de notificação:', error);
      return false;
    }
  };

  useEffect(() => {
    const configureNotifications = async () => {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        Alert.alert(
          'Permissão Necessária',
          'As notificações são necessárias para alertar sobre produtos próximos do vencimento.'
        );
        return;
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Validade de Produtos',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          sound: true,
        });
      }

      // Adicionar listener para notificações
      const subscription = Notifications.addNotificationReceivedListener(notification => {
        console.log('Notificação recebida:', notification);
      });

      return () => subscription.remove();
    };

    configureNotifications();
  }, []);

  useEffect(() => {
    const updateNavigationBar = async () => {
      await NavigationBar.setBackgroundColorAsync('transparent');
      await NavigationBar.setButtonStyleAsync(isDarkMode ? 'light' : 'dark');
    };
    updateNavigationBar();

    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setIsDarkMode(colorScheme === 'dark');
    });

    return () => subscription?.remove();
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
    <SafeAreaView style={{ flex: 1 }}>
      <PaperProvider>
        <NavigationContainer 
          ref={navigationRef}
          theme={isDarkMode ? DarkTheme : DefaultTheme}
          onReady={() => {
            routeNameRef.current = navigationRef.getCurrentRoute()?.name;
          }}
          onStateChange={() => {
            const currentRouteName = navigationRef.getCurrentRoute()?.name;
            routeNameRef.current = currentRouteName;
          }}
        >
          <CustomStatusBar isDarkMode={isDarkMode} />

          <Stack.Navigator initialRouteName="EntryScreen">

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

            <Stack.Screen name="InventarioMenuScreen">
              {props => <InventarioMenuScreen {...props} isDarkMode={isDarkMode} />}
            </Stack.Screen>

            <Stack.Screen name="InventarioRotativoScreen">
              {props => <InventarioRotativoScreen {...props} isDarkMode={isDarkMode} />}
            </Stack.Screen>
            <Stack.Screen name="InventarioCiclicoScreen">
              {props => <InventarioCiclicoScreen {...props} isDarkMode={isDarkMode} />}
            </Stack.Screen>
            <Stack.Screen name="InventarioCriarScreen">
              {props => <InventarioCriarScreen {...props} isDarkMode={isDarkMode} />}
            </Stack.Screen>
            <Stack.Screen name="InventarioResultadosScreen">
              {props => <InventarioResultadosScreen {...props} isDarkMode={isDarkMode} />}
            </Stack.Screen>

          </Stack.Navigator>

          <Toast config={toastConfig} position="bottom" bottomOffset={20} />
          
        </NavigationContainer>
      </PaperProvider>
    </SafeAreaView>
  );
}
