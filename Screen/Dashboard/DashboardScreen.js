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
  FlatList,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PieChart } from 'react-native-chart-kit';
import { MaterialIcons } from '@expo/vector-icons';
import ModalProdDash from '../Components/ModalProdDash';


const DashboardScreen = ({ isDarkMode, navigation }) => {
  const styles = getStyles(isDarkMode);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const [modalVisible, setModalVisible] = useState(false);
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
      headerStyle: { backgroundColor: '#C42D2F' },
      headerTintColor: '#FFF',
      headerTitleStyle: { fontWeight: 'bold', fontSize: 20 },
      title: 'Dashboard',
    });
  }, [navigation]);

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
      color: '#28A745',
      legendFontColor: isDarkMode ? '#fff' : '#333',
      legendFontSize: 14,
    },
    {
      name: 'Vencidos',
      count: stats.expiredProducts,
      color: '#DC3545',
      legendFontColor: isDarkMode ? '#fff' : '#333',
      legendFontSize: 14,
    },
    {
      name: 'Tratados',
      count: stats.treatedProducts,
      color: '#17A2B8',
      legendFontColor: isDarkMode ? '#fff' : '#333',
      legendFontSize: 14,
    },
  ].filter(d => d.count > 0);

  // Configuração de cores para os gráficos
  const chartConfig = {
    backgroundGradientFrom: isDarkMode ? '#1a1a1a' : '#ffffff',
    backgroundGradientTo: isDarkMode ? '#1a1a1a' : '#ffffff',
    color: (opacity = 1) => `rgba(196, 45, 47, ${opacity})`,
    labelColor: () => (isDarkMode ? '#ffffff' : '#333333'),
    strokeWidth: 2,
  };

  const renderExpiringProduct = ({ item, highlight }) => (
    <ModalProdDash item={item} isDarkMode={isDarkMode} highlight={highlight} />
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#C42D2F" />
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
          <View style={styles.summaryCard}>
            <View style={[styles.summaryIconCircle, { backgroundColor: '#e6f4ea' }]}> 
              <MaterialIcons name="inventory" size={24} color="#28A745" />
            </View>
            <Text style={[styles.summaryNumber, isDarkMode ? styles.textLight : styles.textDark]}>{stats.activeProducts}</Text>
            <Text style={styles.summaryLabel}>Ativos</Text>
          </View>
          <View style={styles.summaryCard}>
            <View style={[styles.summaryIconCircle, { backgroundColor: '#fde8e8' }]}> 
              <MaterialIcons name="warning" size={24} color="#DC3545" />
            </View>
            <Text style={[styles.summaryNumber, isDarkMode ? styles.textLight : styles.textDark]}>{stats.expiredProducts}</Text>
            <Text style={styles.summaryLabel}>Vencidos</Text>
          </View>
          <View style={styles.summaryCard}>
            <View style={[styles.summaryIconCircle, { backgroundColor: '#e6f7fa' }]}> 
              <MaterialIcons name="check-circle" size={24} color="#17A2B8" />
            </View>
            <Text style={[styles.summaryNumber, isDarkMode ? styles.textLight : styles.textDark]}>{stats.treatedProducts}</Text>
            <Text style={styles.summaryLabel}>Tratados</Text>
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
                <MaterialIcons name="schedule" size={24} color="#DC3545" />
                <View style={styles.alertContent}>
                  <Text style={[styles.alertTitle, isDarkMode ? styles.textLight : styles.textDark]}>
                    Produtos Urgentes
                  </Text>
                  <Text style={[styles.alertMessage, isDarkMode ? styles.textLightSecondary : styles.textDarkSecondary]}>
                    {stats.expiringIn7Days} produto(s) vence(m) em até 7 dias
                  </Text>
                </View>
                <MaterialIcons name="visibility" size={20} color="#DC3545" />
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
                <MaterialIcons name="event" size={24} color="#FFC107" />
                <View style={styles.alertContent}>
                  <Text style={[styles.alertTitle, isDarkMode ? styles.textLight : styles.textDark]}>
                    Próximos do Vencimento
                  </Text>
                  <Text style={[styles.alertMessage, isDarkMode ? styles.textLightSecondary : styles.textDarkSecondary]}>
                    {stats.expiringIn30Days} produto(s) vence(m) em 30 dias
                  </Text>
                </View>
                <MaterialIcons name="visibility" size={20} color="#FFC107" />
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
              <MaterialIcons name="pie-chart" size={48} color={isDarkMode ? '#666' : '#ccc'} />
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
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: '#DC3545' }]}>Produtos Urgentes (até 7 dias)</Text>
              <TouchableOpacity 
                onPress={() => setModalUrgentesVisible(false)}
                style={styles.closeButton}
              >
                <MaterialIcons name="close" size={24} color={isDarkMode ? '#fff' : '#333'} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalList} showsVerticalScrollIndicator={false}>
              {urgentProducts.length > 0 ? (
                urgentProducts.map((item, index) => (
                  <View key={`urgent-${item.id || index}`}>
                    {renderExpiringProduct({ item, highlight: true })}
                  </View>
                ))
              ) : (
                <Text style={{ color: isDarkMode ? '#fff' : '#333', textAlign: 'center', marginTop: 24 }}>
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
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: '#FFC107' }]}>Próximos do Vencimento (8 a 30 dias)</Text>
              <TouchableOpacity 
                onPress={() => setModalProximosVisible(false)}
                style={styles.closeButton}
              >
                <MaterialIcons name="close" size={24} color={isDarkMode ? '#fff' : '#333'} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalList} showsVerticalScrollIndicator={false}>
              {nextProducts.length > 0 ? (
                nextProducts.map((item, index) => (
                  <View key={`next-${item.id || index}`}>
                    {renderExpiringProduct({ item })}
                  </View>
                ))
              ) : (
                <Text style={{ color: isDarkMode ? '#fff' : '#333', textAlign: 'center', marginTop: 24 }}>
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

const getStyles = (isDarkMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDarkMode ? '#121212' : '#f9f9f9',
  },
  darkContainer: {
    backgroundColor: '#121212',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  headerSection: {
    padding: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: isDarkMode ? '#fff' : '#333',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: isDarkMode ? '#ccc' : '#666',
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
    paddingVertical: 22,
    paddingHorizontal: 10,
    borderRadius: 18,
    alignItems: 'center',
    backgroundColor: isDarkMode ? '#181A20' : '#fff',
    borderWidth: 1.5,
    borderColor: isDarkMode ? '#23262F' : '#e0e0e0',
  },
  summaryIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#C42D2F',
    marginBottom: 2,
  },
  summaryLabel: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '600',
    color: isDarkMode ? '#B0B3B8' : '#64748b',
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
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  urgentAlert: {
    borderLeftWidth: 4,
    borderLeftColor: '#DC3545',
  },
  warningAlert: {
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    height: '80%',
    borderRadius: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 10,
  },
  modalContainerLight: {
    backgroundColor: '#fff',
  },
  modalContainerDark: {
    backgroundColor: '#1e1e1e',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
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
    flexDirection: 'column',
    marginBottom: 14,
    padding: 16,
    borderRadius: 14,
    backgroundColor: isDarkMode ? '#181A20' : '#fff',
    borderWidth: 1.2,
    borderColor: isDarkMode ? '#23262F' : '#e0e0e0',
  },
  urgentProductCard: {
    borderWidth: 2,
    borderColor: '#DC3545',
  },
  modalProductHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalProductIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fffbe6',
    marginRight: 6,
  },
  modalProductDays: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#FFC107',
  },
  modalProductName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
    color: isDarkMode ? '#fff' : '#222',
  },
  modalProductDetails: {
    fontSize: 13,
    color: isDarkMode ? '#B0B3B8' : '#888',
  },
  textLight: {
    color: '#fff',
  },
  textDark: {
    color: '#333',
  },
  textLightSecondary: {
    color: '#ccc',
  },
  textDarkSecondary: {
    color: '#666',
  },
  alertCardLight: {
    backgroundColor: '#fff',
  },
  alertCardDark: {
    backgroundColor: '#1e1e1e',
  },
});

export default DashboardScreen;
