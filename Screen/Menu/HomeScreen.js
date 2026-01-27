import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Image } from "react-native";
import { useNavigation } from "@react-navigation/native";
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const HomeScreen = ({ isDarkMode }) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState({ totalProducts: 0, expiringSoon: 0 });
  const [pressedCard, setPressedCard] = useState(null);
  const [userName, setUserName] = useState('Usuário');

  const menuItems = [
    {
      id: 1,
      title: "Ver Lista",
      subtitle: "Acompanhar produtos",
      icon: "fact-check",
      screen: "ListScreen",
      gradient: ['#2563eb', '#1d4ed8'],
    },
    {
      id: 2,
      title: "Adicionar",
      subtitle: "Novo produto",
      icon: "add-circle-outline",
      screen: "AddProductScreen",
      gradient: ['#059669', '#047857'],
    },
    {
      id: 3,
      title: "Dashboard",
      subtitle: "Análise e relatórios",
      icon: "analytics",
      screen: "DashboardScreen",
      gradient: ['#dc2626', '#b91c1c'],
    },
    {
      id: 4,
      title: "Tratativas",
      subtitle: "Produtos processados",
      icon: "assignment-turned-in",
      screen: "TratarScreen",
      gradient: ['#d97706', '#b45309'],
    }
  ];

  useEffect(() => {
    const loadStats = async () => {
      try {
        const productsJson = await AsyncStorage.getItem('products');
        if (productsJson) {
          const products = JSON.parse(productsJson);
          const totalProducts = products.length;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const thirtyDaysFromNow = new Date(today);
          thirtyDaysFromNow.setDate(today.getDate() + 30);
          const expiringSoon = products.filter(product => {
            if (product.validade) {
              const expirationDate = new Date(product.validade);
              expirationDate.setHours(0, 0, 0, 0);
              return expirationDate >= today && expirationDate <= thirtyDaysFromNow;
            }
            return false;
          }).length;
          setStats({ totalProducts, expiringSoon });
        }
      } catch (e) {
        setStats({ totalProducts: 0, expiringSoon: 0 });
      }
    };

    const loadUserName = async () => {
      try {
        const userData = await AsyncStorage.getItem('userData');
        if (userData) {
          const user = JSON.parse(userData);
          if (user.name) {
            setUserName(user.name);
          }
        }
      } catch (e) {
        console.log('Erro ao carregar nome do usuário:', e);
      }
    };

    loadStats();
    loadUserName();
  }, []);

  const getStyles = (isDarkMode) => StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: isDarkMode ? '#181A20' : '#f8fafc',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 20,
      backgroundColor: 'transparent',
      marginBottom: 8,
    },
    logo: {
      width: 200,
      height: 80,
    },
    headerText: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: 'bold',
    },
    headerSubtitle: {
      fontSize: 13,
      marginTop: 2,
    },
    headerButtons: {
      flexDirection: 'row',
      gap: 8,
    },
    headerButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDarkMode ? '#23262F' : '#fff',
      borderWidth: 1,
      borderColor: isDarkMode ? '#23262F' : 'rgba(0,0,0,0.05)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.10,
      shadowRadius: 12,
      elevation: 6,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 80,
    },
    statsContainer: {
      flexDirection: 'row',
      marginBottom: 18,
      gap: 12,
    },
    statCard: {
      flex: 1,
      backgroundColor: '#fff',
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      justifyContent: 'flex-start',
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
    },
    statIcon: {
      marginBottom: 8,
      opacity: 0.8,
    },
    statValue: {
      fontSize: 22,
      fontWeight: 'bold',
      color: '#2563eb',
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
      color: '#64748b',
      textAlign: 'center',
    },
    menuContainer: {
      marginTop: 24,
      paddingHorizontal: 20,
      paddingBottom: 32,
    },
    menuCardWrapper: {
      marginBottom: 22,
      borderRadius: 22,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.10,
      shadowRadius: 12,
      elevation: 6,
      backgroundColor: isDarkMode ? '#23262F' : 'transparent',
      borderWidth: isDarkMode ? 1 : 0,
      borderColor: isDarkMode ? '#23262F' : 'transparent',
    },
    menuCardGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 26,
      paddingHorizontal: 22,
      borderRadius: 22,
      minHeight: 90,
    },
    iconCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: 'rgba(255,255,255,0.18)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 18,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.10,
      shadowRadius: 6,
    },
    menuTitle: {
      fontSize: 19,
      fontWeight: 'bold',
      color: '#fff',
      marginBottom: 2,
      letterSpacing: 0.2,
    },
    menuSubtitle: {
      fontSize: 14,
      color: 'rgba(255,255,255,0.92)',
      marginTop: 1,
      fontWeight: '500',
      letterSpacing: 0.1,
    },
    userInfoContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      position: 'absolute',
      bottom: 12,
      left: 0,
      right: 0,
    },
    userName: {
      fontSize: 14,
      fontWeight: '500',
      marginLeft: 6,
      opacity: 0.8,
      color: isDarkMode ? '#B0B3B8' : '#64748b',
    },
  });

  const styles = getStyles(isDarkMode);

  return (
    <SafeAreaView style={styles.safeArea}> 
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Image source={require('../../assets/Image/LOGOSEMFRASE.png')} style={styles.logo} resizeMode="contain" />
        <View style={styles.headerText}></View>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={[styles.headerButton, { backgroundColor: isDarkMode ? '#23262F' : '#fff' }]}
            onPress={() => navigation.navigate('ProfileScreen')}
          >
            <MaterialIcons 
              name="account-circle" 
              size={24} 
              color="#3b82f6" 
            />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.headerButton, { backgroundColor: isDarkMode ? '#23262F' : '#fff' }]}
            onPress={() => navigation.navigate('SettingsScreen')}
          >
            <MaterialIcons 
              name="settings" 
              size={24} 
              color="#10b981" 
            />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.menuContainer}>
        {menuItems.map((item, idx) => (
          <React.Fragment key={item.id}>
            <TouchableOpacity
              style={styles.menuCardWrapper}
              activeOpacity={0.92}
              onPressIn={() => setPressedCard(item.id)}
              onPressOut={() => setPressedCard(null)}
              onPress={() => navigation.navigate(item.screen)}
            >
              <LinearGradient
                colors={pressedCard === item.id ? [item.gradient[1], item.gradient[0]] : item.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.menuCardGradient}
              >
                <View style={styles.iconCircle}>
                  <MaterialIcons name={item.icon} size={40} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuTitle}>{item.title}</Text>
                  <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={30} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
            {/* Card de Inventário em manutenção após Adicionar */}
            {item.id === 2 && (
              <View style={[styles.menuCardWrapper, { opacity: 0.5 }]}> 
                <LinearGradient
                  colors={["#64748b", "#94a3b8"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.menuCardGradient}
                >
                  <View style={styles.iconCircle}>
                    <MaterialIcons name="inventory-2" size={40} color="#fff" />
                    <MaterialIcons name="lock" size={22} color="#fff" style={{ position: 'absolute', bottom: 2, right: 2, opacity: 0.8 }} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.menuTitle}>Inventário</Text>
                    <Text style={styles.menuSubtitle}>Em manutenção</Text>
                  </View>
                  <MaterialIcons name="block" size={30} color="#fff" />
                </LinearGradient>
              </View>
            )}
          </React.Fragment>
        ))}
      </View>
      
      <View style={styles.userInfoContainer}>
        <MaterialIcons 
          name="person" 
          size={16} 
          color={isDarkMode ? '#B0B3B8' : '#64748b'} 
        />
        <Text style={[styles.userName, { color: isDarkMode ? '#B0B3B8' : '#64748b' }]}>
          {userName}
        </Text>
      </View>
    </SafeAreaView>
  );
};

export default HomeScreen;
