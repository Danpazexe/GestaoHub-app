import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from "react-native";
import { useNavigation } from "@react-navigation/native";
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CORESHOME } from '../../assets/cores/coresAuth';

const COLORS = CORESHOME;

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
      color: COLORS.destaqueAzul,
    },
    {
      id: 2,
      title: "Adicionar",
      subtitle: "Novo produto",
      icon: "add-circle-outline",
      screen: "AddProductScreen",
      color: COLORS.destaqueVerde,
    },
    {
      id: 3,
      title: "Dashboard",
      subtitle: "Análise e relatórios",
      icon: "analytics",
      screen: "DashboardScreen",
      color: COLORS.destaqueRoxo,
    },
    {
      id: 4,
      title: "Tratativas",
      subtitle: "Produtos processados",
      icon: "assignment-turned-in",
      screen: "TratarScreen",
      color: COLORS.destaqueCinza,
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
      backgroundColor: COLORS.fundo,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 6,
      backgroundColor: 'transparent',
      marginBottom: 8,
    },
    logo: {
      width: 170,
      height: 64,
    },
    headerText: {
      flex: 1,
    },
    greetingText: {
      marginTop: 6,
      fontSize: 14,
      fontWeight: '600',
      color: COLORS.textoSecundario,
    },
    greetingTitle: {
      marginTop: 2,
      fontSize: 20,
      fontWeight: '700',
      color: COLORS.textoPrincipal,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: COLORS.textoPrincipal,
    },
    headerSubtitle: {
      fontSize: 13,
      marginTop: 2,
      color: COLORS.textoSecundario,
    },
    headerButtons: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
      alignSelf: 'flex-start',
      marginTop: 6,
    },
    headerButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: COLORS.cartao,
      borderWidth: 1,
      borderColor: COLORS.borda,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.10,
      shadowRadius: 12,
      elevation: 6,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 32,
    },
    statsContainer: {
      flexDirection: 'row',
      marginBottom: 18,
      gap: 12,
    },
    statCard: {
      flex: 1,
      backgroundColor: COLORS.cartao,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      justifyContent: 'flex-start',
      borderWidth: 1,
      borderColor: COLORS.borda,
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
      color: COLORS.destaqueAzul,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
      color: COLORS.textoSecundario,
      textAlign: 'center',
    },
    menuContainer: {
      marginTop: 6,
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    menuCardWrapper: {
      marginBottom: 22,
      borderRadius: 22,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.10,
      shadowRadius: 12,
      elevation: 6,
      backgroundColor: 'transparent',
      borderWidth: 0,
      borderColor: 'transparent',
    },
    menuCardGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 22,
      paddingHorizontal: 20,
      borderRadius: 22,
      minHeight: 86,
    },
    menuCardSolid: {
      backgroundColor: COLORS.destaqueCinza,
    },
    iconCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: COLORS.iconeFundo,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
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
    userName: {
      fontSize: 14,
      fontWeight: '600',
      color: COLORS.textoSecundario,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: COLORS.textoPrincipal,
      marginBottom: 12,
      letterSpacing: 0.2,
    },
  });

  const styles = getStyles(isDarkMode);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}> 
      <View style={[styles.header, { paddingTop: 12 }]}>
        <View style={styles.headerText}>
          <Image source={require('../../assets/Image/LOGOCOMFRASE.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.greetingText}>Bem-vindo,</Text>
          <Text style={styles.greetingTitle}>{userName}</Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => navigation.navigate('ProfileScreen')}
          >
            <MaterialIcons 
              name="account-circle" 
              size={24} 
              color={COLORS.destaqueAzul} 
            />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => navigation.navigate('SettingsScreen')}
          >
            <MaterialIcons 
              name="settings" 
              size={24} 
              color={COLORS.destaqueVerde} 
            />
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.menuContainer,
          { paddingBottom: 24 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <MaterialIcons name="inventory-2" size={26} color={COLORS.destaqueAzul} style={styles.statIcon} />
            <Text style={styles.statValue}>{stats.totalProducts}</Text>
            <Text style={styles.statLabel}>Produtos cadastrados</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialIcons name="event" size={26} color={COLORS.destaqueDourado} style={styles.statIcon} />
            <Text style={[styles.statValue, { color: COLORS.destaqueDourado }]}>{stats.expiringSoon}</Text>
            <Text style={styles.statLabel}>Vencendo em 30 dias</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Acesso rápido</Text>
        {menuItems.map((item, idx) => (
          <React.Fragment key={item.id}>
            <TouchableOpacity
              style={styles.menuCardWrapper}
              activeOpacity={0.92}
              onPressIn={() => setPressedCard(item.id)}
              onPressOut={() => setPressedCard(null)}
              onPress={() => navigation.navigate(item.screen)}
            >
              <View
                style={[
                  styles.menuCardGradient,
                  { backgroundColor: item.color },
                  pressedCard === item.id && { opacity: 0.92 },
                ]}
              >
                <View style={styles.iconCircle}>
                  <MaterialIcons name={item.icon} size={40} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuTitle}>{item.title}</Text>
                  <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={30} color="#fff" />
              </View>
            </TouchableOpacity>
            {/* Card de Inventário em manutenção após Adicionar */}
            {item.id === 2 && (
              <View style={[styles.menuCardWrapper, { opacity: 0.5 }]}> 
                <View style={[styles.menuCardGradient, { backgroundColor: COLORS.neutro }]}>
                  <View style={styles.iconCircle}>
                    <MaterialIcons name="inventory-2" size={40} color="#fff" />
                    <MaterialIcons name="lock" size={22} color="#fff" style={{ position: 'absolute', bottom: 2, right: 2, opacity: 0.8 }} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.menuTitle}>Inventário</Text>
                    <Text style={styles.menuSubtitle}>Em manutenção</Text>
                  </View>
                  <MaterialIcons name="block" size={30} color="#fff" />
                </View>
              </View>
            )}
          </React.Fragment>
        ))}

      </ScrollView>
    </SafeAreaView>
  );
};

export default HomeScreen;
