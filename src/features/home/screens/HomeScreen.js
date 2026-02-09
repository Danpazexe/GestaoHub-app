import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, Pressable, useWindowDimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CORESHOME } from '../../../../assets/cores/coresAuth';

const COLORS = CORESHOME;

const HomeScreen = ({ isDarkMode }) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const [pressedCard, setPressedCard] = useState(null);
  const [userName, setUserName] = useState('Usuário');

  const moduleCards = [
    {
      id: 'validade',
      title: "VALIDADE",
      subtitle: "Controle de validade e tratativas",
      icon: "event-note",
      color: COLORS.destaqueAzul,
      actions: [
        { id: 'validade-lista', title: 'Ver lista', icon: 'fact-check', screen: 'ListScreen' },
        { id: 'validade-add', title: 'Adicionar', icon: 'add-circle-outline', screen: 'AddProductScreen' },
        { id: 'validade-dashboard', title: 'Dashboard', icon: 'analytics', screen: 'DashboardScreen' },
        { id: 'validade-tratativas', title: 'Tratativas', icon: 'assignment-turned-in', screen: 'TratarScreen' },
      ],
    },
    {
      id: 'avaria',
      title: "AVARIA",
      subtitle: "Lançamento e gestão de avarias",
      icon: "report-problem",
      color: COLORS.destaqueDourado,
      actions: [
        {
          id: 'avaria-lancar',
          title: 'Lançar avaria',
          icon: 'playlist-add-check-circle',
          screen: 'ModuleBaseScreen',
          routeParams: {
            title: 'Lançamento de Avaria',
            subtitle: 'Registre avarias com motivo, quantidade e evidência',
            icon: 'playlist-add-check-circle',
            color: COLORS.destaqueDourado,
            bullets: ['Captura por código de barras', 'Tipo e motivo da avaria', 'Fluxo de tratativa e aprovação'],
          },
        },
        {
          id: 'avaria-consultar',
          title: 'Consultar avarias',
          icon: 'search',
          screen: 'ModuleBaseScreen',
          routeParams: {
            title: 'Consulta de Avarias',
            subtitle: 'Acompanhe pendências e status das ocorrências',
            icon: 'search',
            color: COLORS.destaqueDourado,
            bullets: ['Filtros por período e situação', 'Histórico por produto e loja', 'Exportação de ocorrências'],
          },
        },
      ],
    },
    {
      id: 'conferencia',
      title: "CONFERÊNCIA",
      subtitle: "Conferência de entrada e saída",
      icon: "inventory-2",
      color: COLORS.destaqueVerde,
      actions: [
        {
          id: 'conferencia-recebimento',
          title: 'Conferência de recebimento',
          icon: 'local-shipping',
          screen: 'ModuleBaseScreen',
          routeParams: {
            title: 'Conferência de Recebimento',
            subtitle: 'Valide entradas por nota, volume e item',
            icon: 'local-shipping',
            color: COLORS.destaqueVerde,
            bullets: ['Conferência por NF e código de barras', 'Registro de divergências', 'Finalização por conferente'],
          },
        },
        {
          id: 'conferencia-saida',
          title: 'Conferência de saída',
          icon: 'assignment',
          screen: 'ModuleBaseScreen',
          routeParams: {
            title: 'Conferência de Saída',
            subtitle: 'Garanta acurácia na expedição de pedidos',
            icon: 'assignment',
            color: COLORS.destaqueVerde,
            bullets: ['Conferência por carga e pedido', 'Validação por etapa', 'Checklist de despacho'],
          },
        },
      ],
    },
    {
      id: 'inventario',
      title: "INVENTÁRIO",
      subtitle: "Contagem cíclica e geral",
      icon: "checklist",
      color: COLORS.destaqueRoxo,
      actions: [
        {
          id: 'inventario-contagem',
          title: 'Contagem cíclica',
          icon: 'playlist-add-check-circle',
          screen: 'ModuleBaseScreen',
          routeParams: {
            title: 'Inventário Cíclico',
            subtitle: 'Planeje e execute contagens periódicas',
            icon: 'playlist-add-check-circle',
            color: COLORS.destaqueRoxo,
            bullets: ['Plano de contagem por setor', 'Execução por coletor', 'Consolidação de divergências'],
          },
        },
        {
          id: 'inventario-recontagem',
          title: 'Recontagem',
          icon: 'published-with-changes',
          screen: 'ModuleBaseScreen',
          routeParams: {
            title: 'Recontagem',
            subtitle: 'Validação dos itens com divergência',
            icon: 'published-with-changes',
            color: COLORS.destaqueRoxo,
            bullets: ['Lista de divergências', 'Conferência dupla', 'Ajuste com trilha de auditoria'],
          },
        },
      ],
    },
    {
      id: 'pedidos',
      title: "PEDIDOS E CARGA",
      subtitle: "Separação e conferência de expedição",
      icon: "local-shipping",
      color: COLORS.destaqueCinza,
      actions: [
        {
          id: 'pedidos-separacao',
          title: 'Separação de pedidos',
          icon: 'shopping-cart-checkout',
          screen: 'ModuleBaseScreen',
          routeParams: {
            title: 'Separação de Pedidos',
            subtitle: 'Organize e acompanhe a separação por onda',
            icon: 'shopping-cart-checkout',
            color: COLORS.destaqueCinza,
            bullets: ['Fila de pedidos por prioridade', 'Conferência por item separado', 'Status por operador'],
          },
        },
        {
          id: 'pedidos-carga',
          title: 'Conferência de carga',
          icon: 'fact-check',
          screen: 'ModuleBaseScreen',
          routeParams: {
            title: 'Conferência de Carga',
            subtitle: 'Valide a montagem final antes da expedição',
            icon: 'fact-check',
            color: COLORS.destaqueCinza,
            bullets: ['Checklist de embarque', 'Conferência por volume', 'Fechamento por rota'],
          },
        },
      ],
    },
    {
      id: 'auditoria',
      title: "AUDITORIA DE PREÇO",
      subtitle: "Emissão e conferência de etiquetas",
      icon: "sell",
      color: COLORS.destaqueAzul,
      actions: [
        {
          id: 'auditoria-etiquetas',
          title: 'Emitir etiquetas',
          icon: 'print',
          screen: 'ModuleBaseScreen',
          routeParams: {
            title: 'Emissão de Etiquetas',
            subtitle: 'Prepare etiquetas de preço e gôndola',
            icon: 'print',
            color: COLORS.destaqueAzul,
            bullets: ['Geração por produto/setor', 'Reimpressão rápida', 'Controle de lotes emitidos'],
          },
        },
        {
          id: 'auditoria-divergencias',
          title: 'Divergências de preço',
          icon: 'rule',
          screen: 'ModuleBaseScreen',
          routeParams: {
            title: 'Divergências de Preço',
            subtitle: 'Identifique e trate inconsistências de preço',
            icon: 'rule',
            color: COLORS.destaqueAzul,
            bullets: ['Registro da divergência', 'Acompanhamento por status', 'Relatório por loja e seção'],
          },
        },
      ],
    },
    {
      id: 'requisicoes',
      title: "REQUISIÇÕES",
      subtitle: "Consumo interno e pedidos entre lojas",
      icon: "storefront",
      color: COLORS.destaqueVerde,
      actions: [
        {
          id: 'requisicoes-consumo',
          title: 'Requisição de consumo',
          icon: 'assignment-add',
          screen: 'ModuleBaseScreen',
          routeParams: {
            title: 'Requisição de Consumo',
            subtitle: 'Solicite itens para uso interno da operação',
            icon: 'assignment-add',
            color: COLORS.destaqueVerde,
            bullets: ['Abertura de requisição', 'Aprovação por responsável', 'Baixa de estoque vinculada'],
          },
        },
        {
          id: 'requisicoes-lojas',
          title: 'Pedido entre lojas',
          icon: 'swap-horiz',
          screen: 'ModuleBaseScreen',
          routeParams: {
            title: 'Pedido Entre Lojas',
            subtitle: 'Gerencie transferências internas de mercadorias',
            icon: 'swap-horiz',
            color: COLORS.destaqueVerde,
            bullets: ['Origem e destino da transferência', 'Conferência de envio/recebimento', 'Rastreio por status'],
          },
        },
      ],
    },
  ];
  const moduleCardsLength = moduleCards.length;
  const headerEstimatedHeight = 150;
  const sectionTitleHeight = 30;
  const verticalGaps = 16 * (moduleCardsLength - 1);
  const availableForCards = Math.max(
    0,
    screenHeight - insets.top - insets.bottom - headerEstimatedHeight - sectionTitleHeight - 70
  );
  const responsiveCardHeight = Math.min(
    96,
    Math.max(64, (availableForCards - verticalGaps) / moduleCardsLength)
  );

  useEffect(() => {
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
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.10,
      shadowRadius: 12,
      elevation: 6,
    },
    menuContainer: {
      flex: 1,
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
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
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
            <Text style={styles.greetingText} numberOfLines={1}>
              Olá, {userName || 'Usuário'}
            </Text>
          </View>
        </View>

        <View style={styles.menuContainer}>
          <Text style={styles.sectionTitle}>Funcionalidades</Text>
          {moduleCards.map((module) => (
            <Pressable
              key={module.id}
              onPressIn={() => setPressedCard(module.id)}
              onPressOut={() => setPressedCard(null)}
              onPress={() => navigation.navigate('ModuleFunctionsScreen', { module })}
              style={({ pressed }) => [styles.menuCardWrapper, pressed && styles.pressedCard]}
            >
              <View
                style={[
                  styles.menuCardGradient,
                  { backgroundColor: module.color, minHeight: responsiveCardHeight },
                  pressedCard === module.id && { opacity: 0.94 },
                ]}
              >
                <View style={styles.iconCircle}>
                  <MaterialIcons name={module.icon} size={32} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuTitle} numberOfLines={1}>{module.title}</Text>
                  <Text style={styles.menuSubtitle} numberOfLines={2}>{module.subtitle}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={26} color="#fff" />
              </View>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
    </View>
  );
};

export default HomeScreen;
