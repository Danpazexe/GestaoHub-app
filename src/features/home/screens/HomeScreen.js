import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CORESHOME } from '../../../../assets/cores/coresAuth';

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
    backgroundGlowTop: {
      position: 'absolute',
      top: -120,
      right: -80,
      width: 260,
      height: 260,
      borderRadius: 130,
      backgroundColor: COLORS.destaqueAzul,
      opacity: 0.12,
    },
    backgroundGlowBottom: {
      position: 'absolute',
      bottom: -140,
      left: -80,
      width: 300,
      height: 300,
      borderRadius: 150,
      backgroundColor: COLORS.destaqueVerde,
      opacity: 0.10,
    },
    content: {
      flex: 1,
    },
    header: {
      paddingHorizontal: 22,
      paddingTop: 18,
      paddingBottom: 14,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    logo: {
      width: 140,
      height: 52,
    },
    headerText: {
      flex: 1,
    },
    greetingText: {
      fontSize: 13,
      fontWeight: '600',
      color: COLORS.textoSecundario,
      letterSpacing: 0.2,
    },
    greetingTitle: {
      marginTop: 2,
      fontSize: 22,
      fontWeight: '800',
      color: COLORS.textoPrincipal,
      letterSpacing: 0.2,
    },
    headerButtons: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'center',
    },
    headerButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
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
    statsContainer: {
      flexDirection: 'row',
      marginTop: 14,
      marginBottom: 10,
      gap: 12,
    },
    statCard: {
      flex: 1,
      backgroundColor: COLORS.cartao,
      borderRadius: 14,
      padding: 14,
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
      fontSize: 24,
      fontWeight: '800',
      color: COLORS.destaqueAzul,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
      color: COLORS.textoSecundario,
      textAlign: 'center',
    },
    menuContainer: {
      paddingHorizontal: 22,
      paddingBottom: 24,
    },
    menuCardWrapper: {
      marginBottom: 16,
      borderRadius: 18,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
      elevation: 6,
      backgroundColor: 'transparent',
      borderWidth: 0,
      borderColor: 'transparent',
    },
    menuCardGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 18,
      paddingHorizontal: 18,
      borderRadius: 18,
      minHeight: 82,
    },
    menuCardSolid: {
      backgroundColor: COLORS.destaqueCinza,
    },
    iconCircle: {
      width: 50,
      height: 50,
      borderRadius: 25,
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
      fontSize: 18,
      fontWeight: '800',
      color: '#fff',
      marginBottom: 2,
      letterSpacing: 0.2,
    },
    menuSubtitle: {
      fontSize: 13,
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
      fontSize: 14,
      fontWeight: '800',
      color: COLORS.textoPrincipal,
      marginTop: 8,
      marginBottom: 10,
      letterSpacing: 0.2,
    },
    pressedCard: {
      transform: [{ scale: 0.985 }],
      opacity: 0.94,
    },
  });

  const styles = getStyles(isDarkMode);

  return (
    <View style={styles.safeArea}>
      <SafeAreaView style={styles.content} edges={['top', 'left', 'right']}>
        <View style={styles.backgroundGlowTop} />
        <View style={styles.backgroundGlowBottom} />
        <ScrollView
          style={styles.content}
          contentContainerStyle={[
            styles.menuContainer,
            { paddingBottom: 28 + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
        >
        <View style={styles.header}>
          <View style={styles.topRow}>
            <Image source={require('../../../../assets/Image/LOGOCOMFRASE.png')} style={styles.logo} resizeMode="contain" />
            <View style={styles.headerButtons}>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => navigation.navigate('ProfileScreen')}
              >
                <MaterialIcons
                  name="account-circle"
                  size={26}
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
          <View style={styles.headerText}>
            <Text style={styles.greetingText}>Olá,</Text>
            <Text style={styles.greetingTitle}>{userName}</Text>
          </View>
          <View style={styles.statsContainer}>
            <Pressable
              onPress={() => navigation.navigate('ListScreen')}
              style={({ pressed }) => [styles.statCard, pressed && styles.pressedCard]}
            >
              <MaterialIcons name="inventory-2" size={26} color={COLORS.destaqueAzul} style={styles.statIcon} />
              <Text style={styles.statValue}>{stats.totalProducts}</Text>
              <Text style={styles.statLabel}>Produtos cadastrados</Text>
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('DashboardScreen')}
              style={({ pressed }) => [styles.statCard, pressed && styles.pressedCard]}
            >
              <MaterialIcons name="event" size={26} color={COLORS.destaqueDourado} style={styles.statIcon} />
              <Text style={[styles.statValue, { color: COLORS.destaqueDourado }]}>{stats.expiringSoon}</Text>
              <Text style={styles.statLabel}>Vencendo em 30 dias</Text>
            </Pressable>
          </View>
        </View>

          <Text style={styles.sectionTitle}>Acesso rápido</Text>
          {menuItems.map((item) => (
            <React.Fragment key={item.id}>
              <Pressable
                onPressIn={() => setPressedCard(item.id)}
                onPressOut={() => setPressedCard(null)}
                onPress={() => navigation.navigate(item.screen)}
                style={({ pressed }) => [styles.menuCardWrapper, pressed && styles.pressedCard]}
              >
                <View
                  style={[
                    styles.menuCardGradient,
                    { backgroundColor: item.color },
                    pressedCard === item.id && { opacity: 0.94 },
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
              </Pressable>
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
    </View>
  );
};

export default HomeScreen;
