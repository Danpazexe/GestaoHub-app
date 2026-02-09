import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Animated,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PieChart } from 'react-native-chart-kit';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import {
  createScreenHeaderTemplate,
  createHeaderTitleTemplate,
} from '../../../shared/components/ScreenLayout';
import { CORESDASHBOARD } from '../../../../assets/cores/coresAuth';

const COLORS = CORESDASHBOARD;


const DashboardScreen = ({ isDarkMode, navigation }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const [expiringProducts, setExpiringProducts] = useState([]);

  // Estados para modais separados
  const [modalUrgentesVisible, setModalUrgentesVisible] = useState(false);
  const [modalProximosVisible, setModalProximosVisible] = useState(false);

  useEffect(() => {
    loadProducts();
    animateIn();
  }, []);

  useEffect(() => {
    navigation.setOptions({
      ...createScreenHeaderTemplate({
        isDarkMode,
        lightHeaderColor: COLORS.primary,
        darkHeaderColor: COLORS.primary,
        tintColor: COLORS.white,
        titleSize: 20,
        titleWeight: '700',
      }),
      headerTitle: () =>
        createHeaderTitleTemplate({
          title: 'Dashboard',
          iconName: 'dashboard',
          tintColor: COLORS.white,
        }),
    });
  }, [navigation, isDarkMode]);

  const animateIn = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const loadProducts = async () => {
    try {
      const data = await AsyncStorage.getItem('products');
      if (data) {
        const parsedProducts = JSON.parse(data);
        setProducts(parsedProducts);
        
        // Filtrar produtos próximos do vencimento
        const expiring = parsedProducts.filter(p => {
          const days = calculateDaysRemaining(p.validade);
          return !p.status && days >= 0 && days <= 30;
        }).sort((a, b) => calculateDaysRemaining(a.validade) - calculateDaysRemaining(b.validade));
        
        setExpiringProducts(expiring);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProducts();
    setRefreshing(false);
  };

  const calculateDaysRemaining = (date) => {
    const today = new Date();
    const target = new Date(date);
    const diff = target - today;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  // Estatísticas melhoradas
  const getStats = () => {
    const activeProducts = products.filter(p => !p.status).length;
    const expiredProducts = products.filter(p => {
      const days = calculateDaysRemaining(p.validade);
      return !p.status && days < 0;
    }).length;
    const treatedProducts = products.filter(p => p.status === 'treated').length;
    
    // Produtos próximos do vencimento
    const expiringIn7Days = products.filter(p => {
      const days = calculateDaysRemaining(p.validade);
      return !p.status && days >= 0 && days <= 7;
    }).length;
    
    const expiringIn30Days = products.filter(p => {
      const days = calculateDaysRemaining(p.validade);
      return !p.status && days >= 0 && days <= 30;
    }).length;

    return {
      activeProducts,
      expiredProducts,
      treatedProducts,
      expiringIn7Days,
      expiringIn30Days,
    };
  };

  const stats = getStats();

  // Corrigir filtros para garantir que não haja sobreposição
  const urgentProducts = expiringProducts.filter(p => {
    const days = calculateDaysRemaining(p.validade);
    return days >= 0 && days <= 7;
  });
  const nextProducts = expiringProducts.filter(p => {
    const days = calculateDaysRemaining(p.validade);
    return days > 7 && days <= 30;
  });

  // Dados para gráfico pizza
  const pieData = [
    {
      name: 'Ativos',
      count: stats.activeProducts,
      color: COLORS.success,
      legendFontColor: isDarkMode ? COLORS.textDark : COLORS.text,
      legendFontSize: 14,
    },
    {
      name: 'Vencidos',
      count: stats.expiredProducts,
      color: COLORS.danger,
      legendFontColor: isDarkMode ? COLORS.textDark : COLORS.text,
      legendFontSize: 14,
    },
    {
      name: 'Tratados',
      count: stats.treatedProducts,
      color: COLORS.info,
      legendFontColor: isDarkMode ? COLORS.textDark : COLORS.text,
      legendFontSize: 14,
    },
  ].filter(d => d.count > 0);

  // Configuração de cores para os gráficos
  const chartConfig = {
    backgroundGradientFrom: isDarkMode ? COLORS.backgroundDark : COLORS.white,
    backgroundGradientTo: isDarkMode ? COLORS.backgroundDark : COLORS.white,
    color: (opacity = 1) => `rgba(${COLORS.chartColorRgb}, ${opacity})`,
    labelColor: () => (isDarkMode ? COLORS.textDark : COLORS.text),
    strokeWidth: 2,
  };

  const renderExpiringProduct = ({ item }) => {
    const daysRemaining = calculateDaysRemaining(item.validade);
    const isUrgent = daysRemaining <= 7;
    
    return (
      <View style={[
        styles.modalProductCard,
        isDarkMode ? styles.cardDark : styles.cardLight,
        isUrgent && styles.urgentProductCard
      ]}>
        <View style={styles.modalProductHeader}>
          <MaterialIcons
            name={isUrgent ? 'warning' : 'schedule'}
            size={20}
            color={isUrgent ? COLORS.danger : COLORS.warning}
          />
          <Text style={[
            styles.modalProductDays,
            isDarkMode ? styles.textLight : styles.textDark,
            isUrgent && { color: COLORS.danger }
          ]}>
            {daysRemaining} {daysRemaining === 1 ? 'dia' : 'dias'}
          </Text>
        </View>
        <Text style={[
          styles.modalProductName,
          isDarkMode ? styles.textLight : styles.textDark
        ]} numberOfLines={2}>
          {item.descricao}
        </Text>
        <Text style={[
          styles.modalProductDetails,
          isDarkMode ? styles.textLightSecondary : styles.textDarkSecondary
        ]}>
          Qtd: {item.quantidade} | Lote: {item.lote}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={[styles.loadingText, isDarkMode && styles.textLight]}>
          Carregando dashboard...
        </Text>
      </View>
    );
  }

  return (
    <Animated.View 
      style={[
        styles.container, 
        isDarkMode && styles.darkContainer,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
      ]}
    >
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerSection}>
          <Text style={[styles.headerTitle, isDarkMode && styles.textLight]}>
            📊 Resumo Geral
          </Text>
          <Text style={[styles.headerSubtitle, isDarkMode && styles.textLightSecondary]}>
            {new Date().toLocaleDateString('pt-BR', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </Text>
        </View>

        {/* Cards de estatísticas principais */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, isDarkMode ? styles.cardDark : styles.cardLight]}>
            <MaterialIcons name="inventory" size={24} color={COLORS.success} />
            <Text style={[styles.summaryNumber, isDarkMode ? styles.textLight : styles.textDark]}>{stats.activeProducts}</Text>
            <Text style={[styles.summaryLabel, isDarkMode ? styles.textLight : styles.textDark]}>Ativos</Text>
          </View>
          <View style={[styles.summaryCard, isDarkMode ? styles.cardDark : styles.cardLight]}>
            <MaterialIcons name="warning" size={24} color={COLORS.danger} />
            <Text style={[styles.summaryNumber, isDarkMode ? styles.textLight : styles.textDark]}>{stats.expiredProducts}</Text>
            <Text style={[styles.summaryLabel, isDarkMode ? styles.textLight : styles.textDark]}>Vencidos</Text>
          </View>
          <View style={[styles.summaryCard, isDarkMode ? styles.cardDark : styles.cardLight]}>
            <MaterialIcons name="check-circle" size={24} color={COLORS.info} />
            <Text style={[styles.summaryNumber, isDarkMode ? styles.textLight : styles.textDark]}>{stats.treatedProducts}</Text>
            <Text style={[styles.summaryLabel, isDarkMode ? styles.textLight : styles.textDark]}>Tratados</Text>
          </View>
        </View>

        {/* Alertas de produtos próximos do vencimento */}
        {(stats.expiringIn7Days > 0 || stats.expiringIn30Days > 0) && (
          <View style={styles.alertsSection}>
            <Text style={[styles.sectionTitle, isDarkMode ? styles.textLight : styles.textDark]}>
              ⚠️ Alertas
            </Text>
            {/* Alerta Urgentes */}
            {stats.expiringIn7Days > 0 && (
              <TouchableOpacity 
                style={[
                  styles.alertCard, 
                  styles.urgentAlert,
                  isDarkMode ? styles.alertCardDark : styles.alertCardLight
                ]}
                onPress={() => setModalUrgentesVisible(true)}
              >
                <MaterialIcons name="schedule" size={24} color={COLORS.danger} />
                <View style={styles.alertContent}>
                  <Text style={[styles.alertTitle, isDarkMode ? styles.textLight : styles.textDark]}>
                    Produtos Urgentes
                  </Text>
                  <Text style={[styles.alertMessage, isDarkMode ? styles.textLightSecondary : styles.textDarkSecondary]}>
                    {stats.expiringIn7Days} produto(s) vence(m) em até 7 dias
                  </Text>
                </View>
                <MaterialIcons name="visibility" size={20} color={COLORS.danger} />
              </TouchableOpacity>
            )}
            {/* Alerta Próximos do Vencimento */}
            {stats.expiringIn30Days > 0 && (
              <TouchableOpacity 
                style={[
                  styles.alertCard, 
                  styles.warningAlert,
                  isDarkMode ? styles.alertCardDark : styles.alertCardLight
                ]}
                onPress={() => setModalProximosVisible(true)}
              >
                <MaterialIcons name="event" size={24} color={COLORS.warning} />
                <View style={styles.alertContent}>
                  <Text style={[styles.alertTitle, isDarkMode ? styles.textLight : styles.textDark]}>
                    Próximos do Vencimento
                  </Text>
                  <Text style={[styles.alertMessage, isDarkMode ? styles.textLightSecondary : styles.textDarkSecondary]}>
                    {stats.expiringIn30Days} produto(s) vence(m) em 30 dias
                  </Text>
                </View>
                <MaterialIcons name="visibility" size={20} color={COLORS.warning} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Gráfico Pizza - Status */}
        <View style={styles.chartSection}>
          <Text style={[styles.sectionTitle, isDarkMode ? styles.textLight : styles.textDark]}>
            📊 Status dos Produtos
          </Text>
          {pieData.length > 0 ? (
            <PieChart
              data={pieData}
              width={Dimensions.get('window').width - 32}
              height={220}
              chartConfig={chartConfig}
              accessor="count"
              backgroundColor="transparent"
              paddingLeft="15"
              absolute
              hasLegend
            />
          ) : (
            <View style={styles.emptyState}>
              <MaterialIcons name="pie-chart" size={48} color={isDarkMode ? COLORS.textMutedDark : COLORS.border} />
              <Text style={[styles.emptyText, isDarkMode ? styles.textLightSecondary : styles.textDarkSecondary]}>
                Nenhum produto cadastrado
              </Text>
            </View>
          )}
        </View>

      </ScrollView>

      {/* Modal de produtos URGENTES */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalUrgentesVisible}
        onRequestClose={() => setModalUrgentesVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[
            styles.modalContainer,
            isDarkMode ? styles.modalContainerDark : styles.modalContainerLight
          ]}>
            <View style={[styles.modalHeader, isDarkMode && styles.modalHeaderDark]}>
              <Text style={[styles.modalTitle, { color: COLORS.danger }]}>Produtos Urgentes (até 7 dias)</Text>
              <TouchableOpacity 
                onPress={() => setModalUrgentesVisible(false)}
                style={styles.closeButton}
              >
                <MaterialIcons name="close" size={24} color={isDarkMode ? COLORS.textDark : COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalList} showsVerticalScrollIndicator={false}>
              {urgentProducts.length > 0 ? (
                urgentProducts.map(item => renderExpiringProduct({ item }))
              ) : (
                <Text style={{ color: isDarkMode ? COLORS.textDark : COLORS.text, textAlign: 'center', marginTop: 24 }}>
                  Nenhum produto urgente.
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal de produtos PRÓXIMOS DO VENCIMENTO */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalProximosVisible}
        onRequestClose={() => setModalProximosVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[
            styles.modalContainer,
            isDarkMode ? styles.modalContainerDark : styles.modalContainerLight
          ]}>
            <View style={[styles.modalHeader, isDarkMode && styles.modalHeaderDark]}>
              <Text style={[styles.modalTitle, { color: COLORS.warning }]}>Próximos do Vencimento (8 a 30 dias)</Text>
              <TouchableOpacity 
                onPress={() => setModalProximosVisible(false)}
                style={styles.closeButton}
              >
                <MaterialIcons name="close" size={24} color={isDarkMode ? COLORS.textDark : COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalList} showsVerticalScrollIndicator={false}>
              {nextProducts.length > 0 ? (
                nextProducts.map(item => renderExpiringProduct({ item }))
              ) : (
                <Text style={{ color: isDarkMode ? COLORS.textDark : COLORS.text, textAlign: 'center', marginTop: 24 }}>
                  Nenhum produto próximo do vencimento.
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  darkContainer: {
    backgroundColor: COLORS.backgroundDark,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textMuted,
  },
  headerSection: {
    padding: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    textTransform: 'capitalize',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    marginHorizontal: 6,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 3,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  cardLight: {
    backgroundColor: COLORS.card,
  },
  cardDark: {
    backgroundColor: COLORS.cardDark,
  },
  summaryNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  alertsSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    elevation: 3,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  urgentAlert: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.danger,
  },
  warningAlert: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.warning,
  },
  alertContent: {
    flex: 1,
    marginLeft: 12,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  alertMessage: {
    fontSize: 14,
  },
  chartSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlayDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    height: '80%',
    borderRadius: 20,
    elevation: 5,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 10,
  },
  modalContainerLight: {
    backgroundColor: COLORS.card,
  },
  modalContainerDark: {
    backgroundColor: COLORS.cardDark,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalHeaderDark: {
    borderBottomColor: COLORS.borderDark,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  modalList: {
    padding: 20,
  },
  modalProductCard: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
  },
  urgentProductCard: {
    borderWidth: 2,
    borderColor: COLORS.danger,
  },
  modalProductHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalProductDays: {
    fontSize: 14,
    fontWeight: 'bold',
  },

  modalProductName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  modalProductDetails: {
    fontSize: 14,
  },
  textLight: {
    color: COLORS.textDark,
  },
  textDark: {
    color: COLORS.text,
  },
  textLightSecondary: {
    color: COLORS.textMutedDark,
  },
  textDarkSecondary: {
    color: COLORS.textMuted,
  },
  alertCardLight: {
    backgroundColor: COLORS.card,
  },
  alertCardDark: {
    backgroundColor: COLORS.cardDark,
  },
});

export default DashboardScreen;
