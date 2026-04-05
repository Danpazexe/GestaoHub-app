import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, Pressable, ScrollView, Platform } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import * as Animatable from 'react-native-animatable';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { readStoredUserSummary } from '../../../services/userSessionStorageService';
import {
  cardEntrance,
  fadeInUpSoft,
  getStaggerDelay,
} from '../../../components/animations/entrancePresets';
import { functionalityTheme, homeTheme } from '../../../theme/domains/home';

const COLORS = homeTheme;
const FUNC_COLORS = functionalityTheme;
const DEV_EASTER_EGG_TAP_TARGET = 7;
const DEV_EASTER_EGG_TAP_WINDOW_MS = 1800;

const hexToRgb = (hex) => {
  const normalized = String(hex || '').replace('#', '');
  const full = normalized.length === 3
    ? normalized.split('').map((value) => value + value).join('')
    : normalized;
  const num = parseInt(full, 16);

  if (Number.isNaN(num)) {
    return { r: 64, g: 68, b: 76 };
  }

  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
};

const withAlpha = (hex, alpha) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const isDarkColor = (hex) => {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.58;
};

const HomeScreen = ({ isDarkMode }) => {
  const navigation = useNavigation();
  const [pressedCard, setPressedCard] = useState(null);
  const [userName, setUserName] = useState('Usuário');
  const [animationCycle, setAnimationCycle] = useState(0);
  const logoTapCountRef = useRef(0);
  const logoTapTimerRef = useRef(null);
  const hasFocusedOnceRef = useRef(false);

  const modules = [
    {
      id: 'validade',
      title: 'VALIDADE',
      subtitle: 'Controle de validade e tratativas',
      icon: 'event-note',
      color: FUNC_COLORS.modules.validade,
      actions: [
        { id: 'validade-lista', title: 'Ver lista', icon: 'fact-check', screen: 'ListScreen', color: FUNC_COLORS.actions['validade-lista'] },
        { id: 'validade-add', title: 'Adicionar', icon: 'add-circle-outline', screen: 'AddProductScreen', color: FUNC_COLORS.actions['validade-add'] },
        { id: 'validade-dashboard', title: 'Dashboard', icon: 'analytics', screen: 'DashboardScreen', color: FUNC_COLORS.actions['validade-dashboard'] },
        { id: 'validade-tratativas', title: 'Tratativas', icon: 'assignment-turned-in', screen: 'TratarScreen', color: FUNC_COLORS.actions['validade-tratativas'] },
        { id: 'validade-excel', title: 'Exportar/Importar', icon: 'table-chart', screen: 'ExcelScreen', color: FUNC_COLORS.actions['validade-excel'] },
      ],
    },
    {
      id: 'conferencia',
      title: 'CONFERÊNCIA',
      subtitle: 'Recebimento, saída e divergências',
      icon: 'fact-check',
      color: FUNC_COLORS.modules.conferencia,
      actions: [
        {
          id: 'conferencia-recebimento',
          title: 'Conferência de recebimento',
          icon: 'inventory',
          screen: 'ConferenciaRecebimentoScreen',
          color: FUNC_COLORS.actions['conferencia-recebimento'],
        },
        {
          id: 'conferencia-saida',
          title: 'Conferência de saída',
          icon: 'local-shipping',
          screen: 'ConferenciaSaidaScreen',
          color: FUNC_COLORS.actions['conferencia-saida'],
        },
        {
          id: 'conferencia-divergencias',
          title: 'Divergências',
          icon: 'rule',
          screen: 'ConferenciaDivergenciasScreen',
          color: FUNC_COLORS.actions['conferencia-divergencias'],
        },
        {
          id: 'conferencia-tratativas-recebimento',
          title: 'Tratativas receb.',
          icon: 'assignment-turned-in',
          screen: 'ConferenciaTratativasRecebimentoScreen',
          color: FUNC_COLORS.actions['conferencia-tratativas-recebimento'],
        },
      ],
    },
    {
      id: 'avaria',
      title: 'AVARIA',
      subtitle: 'Lançamento e gestão de avarias',
      icon: 'report-problem',
      color: FUNC_COLORS.modules.avaria,
      actions: [
        { id: 'avaria-lancar', title: 'Lançar avaria', icon: 'playlist-add-check-circle', color: FUNC_COLORS.actions['avaria-lancar'], screen: 'AvariaEntryScreen' },
        { id: 'avaria-consultar', title: 'Consultar avarias', icon: 'search', color: FUNC_COLORS.actions['avaria-consultar'], screen: 'AvariaListScreen' },
        { id: 'avaria-historico', title: 'Histórico', icon: 'history', color: FUNC_COLORS.actions['avaria-historico'], screen: 'AvariaHistoryScreen' },
        { id: 'avaria-dashboard', title: 'Dashboard de Avaria', icon: 'bar-chart', color: FUNC_COLORS.actions['avaria-dashboard'], screen: 'AvariaDashboardScreen' },
      ],
    },
    {
      id: 'utilitarios',
      title: 'UTILITÁRIOS',
      subtitle: 'Exportação, PDF e banco local',
      icon: 'build',
      color: FUNC_COLORS.modules.utilitarios,
      actions: [
        {
          id: 'utilitarios-excel',
          title: 'Exportar/Importar Excel',
          icon: 'table-chart',
          screen: 'ExcelScreen',
          color: FUNC_COLORS.actions['utilitarios-excel'],
        },
        {
          id: 'utilitarios-pdf',
          title: 'Exportar relatórios PDF',
          icon: 'picture-as-pdf',
          screen: 'PdfScreen',
          color: FUNC_COLORS.actions['utilitarios-pdf'],
        },
        {
          id: 'utilitarios-sql',
          title: 'Gerenciar banco de dados',
          icon: 'storage',
          screen: 'SqlScreen',
          color: FUNC_COLORS.actions['utilitarios-sql'],
        },
      ],
    },
  ];

  useEffect(() => {
    const loadUserName = async () => {
      try {
        const summary = await readStoredUserSummary();
        setUserName(summary.name);
      } catch (e) {
        console.log('Erro ao carregar nome do usuário:', e);
      }
    };

    loadUserName();
  }, []);

  useEffect(() => {
    return () => {
      if (logoTapTimerRef.current) {
        clearTimeout(logoTapTimerRef.current);
      }
    };
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      if (hasFocusedOnceRef.current) {
        setAnimationCycle((previousCycle) => previousCycle + 1);
        return undefined;
      }

      hasFocusedOnceRef.current = true;
      return undefined;
    }, [])
  );

  const handleLogoPress = () => {
    if (!__DEV__) {
      return;
    }

    if (logoTapTimerRef.current) {
      clearTimeout(logoTapTimerRef.current);
      logoTapTimerRef.current = null;
    }

    logoTapCountRef.current += 1;

    if (logoTapCountRef.current >= DEV_EASTER_EGG_TAP_TARGET) {
      logoTapCountRef.current = 0;
      navigation.navigate('EasterEggScreen');
      return;
    }

    logoTapTimerRef.current = setTimeout(() => {
      logoTapCountRef.current = 0;
      logoTapTimerRef.current = null;
    }, DEV_EASTER_EGG_TAP_WINDOW_MS);
  };

  const getStyles = (isDarkMode) => {
    const shadowColor = withAlpha(COLORS.textoPrincipal, isDarkMode ? 0.5 : 0.25);
    const headerButtonShadow = Platform.select({
      ios: {
        shadowColor,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.54,
        shadowRadius: 2,
      },
      android: {
        elevation: 3,
      },
      default: {},
    });
    const menuCardShadow = Platform.select({
      ios: {
        shadowColor,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.54,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
      default: {},
    });

    return StyleSheet.create({
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
    logoButton: {
      borderRadius: 10,
    },
    headerText: {
      marginTop: 2,
    },
    greetingText: {
      fontSize: 20,
      fontWeight: '800',
      color: COLORS.textoPrincipal,
      letterSpacing: 0.2,
    },
    greetingTitle: {
      fontSize: 20,
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
      ...headerButtonShadow,
    },
    menuContainer: {
      flex: 1,
      paddingHorizontal: 22,
      paddingBottom: 24,
    },
    menuCardWrapper: {
      marginBottom: 12,
      borderRadius: 16,
      ...menuCardShadow,
    },
    menuButton: {
      position: 'relative',
      overflow: 'hidden',
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 13,
      paddingHorizontal: 14,
      borderRadius: 16,
      minHeight: 72,
      borderWidth: 1,
      backgroundColor: COLORS.cartao,
    },
    menuButtonTint: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    menuButtonAccent: {
      width: 4,
      alignSelf: 'stretch',
      borderRadius: 4,
      marginRight: 12,
    },
    menuButtonIconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    menuButtonText: {
      flex: 1,
    },
    menuButtonTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: COLORS.textoPrincipal,
      marginBottom: 2,
    },
    menuButtonSubtitle: {
      fontSize: 12,
      fontWeight: '600',
      color: COLORS.textoSecundario,
    },
    chevronBadge: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
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
  };

  const styles = getStyles(isDarkMode);

  return (
    <View style={styles.safeArea}>
      <SafeAreaView style={styles.content} edges={['top', 'left', 'right']}>
        <View style={styles.backgroundGlowTop} />
        <View style={styles.backgroundGlowBottom} />
        <Animatable.View
          key={`home-header-${animationCycle}`}
          animation={fadeInUpSoft}
          duration={360}
          easing="ease-out"
          useNativeDriver
        >
          <View style={styles.header}>
            <View style={styles.topRow}>
              <TouchableOpacity
                style={styles.logoButton}
                onPress={handleLogoPress}
                activeOpacity={0.85}
              >
                <Image source={require('../../../../assets/Image/LOGOCOMFRASE.png')} style={styles.logo} resizeMode="contain" />
              </TouchableOpacity>
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
              <Text style={styles.greetingText} numberOfLines={1}>
                Olá, {userName || 'Usuário'}
              </Text>
            </View>
          </View>
        </Animatable.View>

        <View style={styles.menuContainer}>
          <Animatable.View
            key={`home-section-title-${animationCycle}`}
            animation={fadeInUpSoft}
            duration={360}
            delay={90}
            easing="ease-out"
            useNativeDriver
          >
            <Text style={styles.sectionTitle}>Funcionalidades</Text>
          </Animatable.View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10 }}>
            {modules.map((module, index) => {
              const moduleColor = module.color || COLORS.destaqueAzul;
              const onModuleColor = isDarkColor(moduleColor) ? '#ffffff' : '#1f2937';
              const tintedBackground = withAlpha(moduleColor, isDarkMode ? 0.18 : 0.09);
              const borderColor = withAlpha(moduleColor, isDarkMode ? 0.46 : 0.24);
              const iconBg = withAlpha(moduleColor, isDarkMode ? 0.94 : 0.88);
              const chevronBg = withAlpha(moduleColor, isDarkMode ? 0.25 : 0.14);
              const chevronColor = isDarkMode ? '#e7ecff' : moduleColor;

              return (
                <Animatable.View
                  key={`home-card-${module.id}-${animationCycle}`}
                  animation={cardEntrance}
                  duration={460}
                  delay={getStaggerDelay(index, { baseDelay: 150, step: 70, maxIndex: 6 })}
                  easing="ease-out"
                  useNativeDriver
                >
                  <Pressable
                    onPressIn={() => setPressedCard(module.id)}
                    onPressOut={() => setPressedCard(null)}
                    onPress={() => navigation.navigate('ModuleFunctionsScreen', { module })}
                    style={({ pressed }) => [styles.menuCardWrapper, pressed && styles.pressedCard]}
                  >
                    <View
                      style={[
                        styles.menuButton,
                        { borderColor },
                        pressedCard === module.id && { opacity: 0.95 },
                      ]}
                    >
                      <View style={[styles.menuButtonTint, { backgroundColor: tintedBackground }]} />
                      <View style={[styles.menuButtonAccent, { backgroundColor: moduleColor }]} />
                      <View style={[styles.menuButtonIconCircle, { backgroundColor: iconBg }]}>
                        <MaterialIcons name={module.icon || 'chevron-right'} size={22} color={onModuleColor} />
                      </View>
                      <View style={styles.menuButtonText}>
                        <Text style={styles.menuButtonTitle} numberOfLines={1}>{module.title}</Text>
                        <Text style={styles.menuButtonSubtitle} numberOfLines={1}>{module.subtitle}</Text>
                      </View>
                      <View style={[styles.chevronBadge, { backgroundColor: chevronBg }]}>
                        <MaterialIcons name="chevron-right" size={22} color={chevronColor} />
                      </View>
                    </View>
                  </Pressable>
                </Animatable.View>
              );
            })}
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  );
};

export default HomeScreen;
