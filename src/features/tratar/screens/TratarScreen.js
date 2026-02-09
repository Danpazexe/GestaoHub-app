import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import Share from 'react-native-share';
import { Menu } from 'react-native-paper';
import Toast from 'react-native-toast-message';
import ReactNativeBlobUtil from 'react-native-blob-util';
import {
  createScreenHeaderTemplate,
  createHeaderTitleTemplate,
} from '../../../shared/components/ScreenLayout';
import { CORESTRATAR } from '../../../../assets/cores/coresAuth';

const COLORS = CORESTRATAR;

const TratarScreen = ({ navigation, isDarkMode }) => {
  const [treatedItems, setTreatedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [menuVisible, setMenuVisible] = useState(false);

  useEffect(() => {
    loadTreatedItems();
    
    navigation.setOptions({
      ...createScreenHeaderTemplate({
        isDarkMode,
        lightHeaderColor: COLORS.primary,
        darkHeaderColor: COLORS.primary,
        tintColor: COLORS.white,
      }),
      headerTitle: () =>
        createHeaderTitleTemplate({
          title: 'Produtos Tratados',
          iconName: 'assignment-turned-in',
          tintColor: COLORS.white,
        }),
      headerRight: () => (
        <View style={{ flexDirection: 'row', marginRight: 10 }}>
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <TouchableOpacity onPress={() => setMenuVisible(true)}>
                <MaterialIcons name="more-vert" size={24} color={COLORS.white} />
              </TouchableOpacity>
            }
          >
            <Menu.Item 
              onPress={exportToPDF} 
              title="Exportar PDF"
              leadingIcon="file-pdf-box"
            />
            <Menu.Item 
              onPress={shareData} 
              title="Compartilhar"
              leadingIcon="share"
            />
          </Menu>
        </View>
      ),
    });
  }, [menuVisible, isDarkMode]);

  const loadTreatedItems = async () => {
    try {
      const products = await AsyncStorage.getItem('products');
      if (products) {
        const parsedProducts = JSON.parse(products);
        const treated = parsedProducts.filter(p => p.status === 'treated');
        setTreatedItems(treated);
      }
    } catch (error) {
      console.error('Erro ao carregar itens tratados:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTreatmentTypeInfo = (type) => {
    const types = {
      sold: { label: 'Vendido', color: COLORS.sold, icon: 'shopping-cart' },
      exchanged: { label: 'Trocado', color: COLORS.exchanged, icon: 'swap-horiz' },
      returned: { label: 'Devolvido', color: COLORS.returned, icon: 'assignment-return' },
      expired: { label: 'Vencido', color: COLORS.expired, icon: 'error' },
    };
    return types[type] || { label: 'Desconhecido', color: COLORS.unknown, icon: 'help' };
  };

  const renderItem = ({ item }) => {
    const treatmentInfo = getTreatmentTypeInfo(item.treatmentType);
    
    return (
      <View style={[styles.itemCard, isDarkMode && styles.darkItemCard]}>
        <View style={styles.itemHeader}>
          <Text style={[styles.itemName, isDarkMode && styles.darkText]}>
            {item.descricao}
          </Text>
          <View style={[styles.badge, { backgroundColor: treatmentInfo.color }]}>
            <MaterialIcons name={treatmentInfo.icon} size={16} color={COLORS.white} />
            <Text style={styles.badgeText}>{treatmentInfo.label}</Text>
          </View>
        </View>
        
        <View style={styles.itemDetails}>
          <Text style={[styles.itemInfo, isDarkMode && styles.darkText]}>
            Código: {item.codprod}
          </Text>
          <Text style={[styles.itemInfo, isDarkMode && styles.darkText]}>
            Lote: {item.lote}
          </Text>
          <View style={styles.quantityContainer}>
            <Text style={[styles.itemInfo, isDarkMode && styles.darkText]}>
              Quantidade: 
            </Text>
            <Text style={[styles.quantityValue, { color: treatmentInfo.color }]}>
              {item.quantidade} unidades
            </Text>
          </View>
          <Text style={[styles.itemInfo, isDarkMode && styles.darkText]}>
            Data da Tratativa: {new Date(item.treatmentDate).toLocaleDateString('pt-BR')}
          </Text>
        </View>
      </View>
    );
  };

  const FilterButton = ({ type, label, icon }) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        selectedFilter === type && styles.filterButtonSelected,
        isDarkMode && styles.darkFilterButton,
        selectedFilter === type && isDarkMode && styles.darkFilterButtonSelected,
      ]}
      onPress={() => setSelectedFilter(type)}
    >
      <MaterialIcons 
        name={icon} 
        size={20} 
        color={selectedFilter === type ? COLORS.white : (isDarkMode ? COLORS.textDark : COLORS.textMuted)}
      />
      <Text style={[
        styles.filterButtonText,
        isDarkMode && styles.darkText,
        selectedFilter === type && styles.filterButtonTextSelected
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const filteredItems = treatedItems.filter(item => 
    selectedFilter === 'all' || item.treatmentType === selectedFilter
  );

  const generatePDFContent = () => {
    const items = filteredItems.map(item => {
      const treatmentInfo = getTreatmentTypeInfo(item.treatmentType);
      return `
        <div style="margin-bottom: 20px; padding: 10px; border: 1px solid ${COLORS.pdfBorder}; border-radius: 5px;">
          <h3 style="margin: 0; color: ${COLORS.pdfText};">${item.descricao}</h3>
          <p style="margin: 5px 0; color: ${treatmentInfo.color};">Status: ${treatmentInfo.label}</p>
          <p>Código: ${item.codprod}</p>
          <p>Lote: ${item.lote}</p>
          <p>Quantidade: ${item.quantidade} unidades</p>
          <p>Data da Tratativa: ${new Date(item.treatmentDate).toLocaleDateString('pt-BR')}</p>
        </div>
      `;
    }).join('');

    return `
      <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <h1 style="color: ${COLORS.pdfHeading}; text-align: center;">Relatório de Produtos Tratados</h1>
          <p style="text-align: center;">Data do relatório: ${new Date().toLocaleDateString('pt-BR')}</p>
          ${items}
        </body>
      </html>
    `;
  };

  const exportToPDF = async () => {
    try {
      const html = generatePDFContent();
      const { filePath } = await RNHTMLtoPDF.convert({
        html,
        fileName: `produtos-tratados-${Date.now()}`,
        directory: 'Documents',
      });

      const fileUrl = filePath.startsWith('file://') ? filePath : `file://${filePath}`;
      await Share.open({
        url: fileUrl,
        type: 'application/pdf',
        title: 'Exportar PDF',
      });
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      Toast.show({
        type: 'error',
        text1: 'Erro ao exportar PDF',
        text2: 'Tente novamente mais tarde'
      });
    }
  };

  const shareData = async () => {
    try {
      const dataToShare = filteredItems.map(item => ({
        descricao: item.descricao,
        status: getTreatmentTypeInfo(item.treatmentType).label,
        codprod: item.codprod,
        lote: item.lote,
        quantidade: item.quantidade,
        data: new Date(item.treatmentDate).toLocaleDateString('pt-BR')
      }));

      const shareText = JSON.stringify(dataToShare, null, 2);

      // Criar arquivo temporário para compartilhar
      const filePath = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/produtos-tratados.txt`;
      await ReactNativeBlobUtil.fs.writeFile(filePath, shareText, 'utf8');

      const fileUrl = filePath.startsWith('file://') ? filePath : `file://${filePath}`;
      await Share.open({
        url: fileUrl,
        type: 'text/plain',
        title: 'Compartilhar dados dos produtos tratados',
      });
    } catch (error) {
      console.error('Erro ao compartilhar dados:', error);
      Toast.show({
        type: 'error',
        text1: 'Erro ao compartilhar dados',
        text2: 'Tente novamente mais tarde'
      });
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={isDarkMode ? COLORS.secondary : COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, isDarkMode && styles.darkContainer]}>
      <View style={styles.filtersContainer}>
        <FilterButton type="all" label="Todos" icon="list" />
        <FilterButton type="sold" label="Vendidos" icon="shopping-cart" />
        <FilterButton type="exchanged" label="Trocados" icon="swap-horiz" />
        <FilterButton type="returned" label="Devolvidos" icon="assignment-return" />
        <FilterButton type="expired" label="Vencidos" icon="error" />
      </View>

      <FlatList
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={[styles.emptyText, isDarkMode && styles.darkText]}>
            Nenhum item tratado encontrado
          </Text>
        }
      />
    </View>
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
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  filtersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 20,
    backgroundColor: COLORS.filterLight,
  },
  darkFilterButton: {
    backgroundColor: COLORS.cardDark,
  },
  darkFilterButtonSelected: {
    backgroundColor: COLORS.secondary,
  },
  filterButtonSelected: {
    backgroundColor: COLORS.primary,
  },
  filterButtonText: {
    marginLeft: 4,
    color: COLORS.textMuted,
    fontSize: 14,
  },
  filterButtonTextSelected: {
    color: COLORS.white,
  },
  listContent: {
    padding: 12,
  },
  itemCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  darkItemCard: {
    backgroundColor: COLORS.cardDark,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    flex: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '500',
  },
  itemDetails: {
    gap: 4,
  },
  itemInfo: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  darkText: {
    color: COLORS.textDark,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: COLORS.textMuted,
    marginTop: 20,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quantityValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default TratarScreen; 
