import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, FlatList, StyleSheet, Alert, TextInput, ActivityIndicator, Image, TouchableOpacity, Text, Modal, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ProductItem from '../../../shared/components/ProductItem';
import TreatmentModal from '../../../shared/components/TreatmentModal';
import DeleteConfirmationModal from '../../../shared/components/DeleteConfirmationModal';
import debounce from 'lodash.debounce';
import { Animated, LayoutAnimation } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-toast-message';
import SwipeableListItem from '../../../shared/components/SwipeableListItem';
import ScreenLayout, {
  createScreenHeaderTemplate,
  createHeaderTitleTemplate,
  createHeaderActionsTemplate,
} from '../../../shared/components/ScreenLayout';
import { CORESLIST } from '../../../../assets/cores/coresAuth';

const COLORS = CORESLIST;

const useProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const storedProducts = await AsyncStorage.getItem('products');
      if (storedProducts) {
        setProducts(JSON.parse(storedProducts));
      }
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      Toast.show({
        type: 'error',
        text1: 'Erro ao carregar produtos',
        text2: 'Não foi possível carregar os produtos.',
        visibilityTime: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const saveProducts = async (productsToSave) => {
    try {
      await AsyncStorage.setItem('products', JSON.stringify(productsToSave));
    } catch (error) {
      console.error('Erro ao salvar produtos:', error);
      Toast.show({
        type: 'error',
        text1: 'Erro ao salvar produtos',
        text2: 'Não foi possível salvar os produtos.',
        visibilityTime: 3000,
      });
    }
  };

  return { products, setProducts, loadProducts, saveProducts, loading };
};

const ListScreen = ({ route, navigation, isDarkMode }) => {
  const { products, setProducts, loadProducts, saveProducts, loading } = useProducts();
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState('descricao');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [showExpiring, setShowExpiring] = useState(false);
  const [treatmentModalVisible, setTreatmentModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [treatmentQuantity, setTreatmentQuantity] = useState('');
  const [sortOrder, setSortOrder] = useState({ field: 'validade', direction: 'asc' });
  const [deleteConfirmationVisible, setDeleteConfirmationVisible] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  const openSwipeRef = useRef(null);
  const swipeRefs = useRef({});

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (route?.params?.newProduct) {
      const newProduct = {
        ...route.params.newProduct,
        id: Date.now().toString(),
        validade: new Date(route.params.newProduct.validade).toISOString(),
      };

      setProducts((prevProducts) => {
        const productExists = prevProducts.some(
          (p) => p.name === newProduct.name || p.codprod === newProduct.codprod
        );

        if (!productExists) {
          const updatedProducts = [...prevProducts, newProduct];
          saveProducts(updatedProducts);
          return updatedProducts;
        } else {
          Toast.show({
            type: 'info',
            text1: 'Produto já existe',
            text2: 'Este produto já está na lista.',
            visibilityTime: 3000,
          });
        }
        return prevProducts;
      });
    }
  }, [route?.params?.newProduct]);

  useEffect(() => {
    navigation.setOptions({
      ...createScreenHeaderTemplate({
        isDarkMode,
        lightHeaderColor: COLORS.primary,
        darkHeaderColor: COLORS.primary,
        tintColor: COLORS.white,
        titleSize: 18,
        titleWeight: '700',
        titleLetterSpacing: 0.4,
        headerStyleOverride: {
          shadowOpacity: 0.06,
        },
      }),
      headerTitle: () =>
        createHeaderTitleTemplate({
          title: 'Lista de Produtos',
          subtitle: 'Gerencie seu estoque',
          iconName: 'list-alt',
          tintColor: COLORS.white,
        }),
      headerRight: () =>
        createHeaderActionsTemplate({
          isDarkMode,
          actions: [
            {
              key: 'toggle-expiring',
              iconName: 'warning',
              onPress: () => setShowExpiring(!showExpiring),
              isActive: showExpiring,
              activeBackgroundColor: COLORS.warningActiveBackground,
              iconColor: COLORS.white,
            },
            {
              key: 'add-product',
              iconName: 'add',
              onPress: () => navigation.navigate('AddProductScreen'),
              iconColor: COLORS.white,
            },
          ],
        }),
    });
  }, [navigation, isDarkMode, showExpiring]);

  const handleDeleteProduct = (product) => {
    setProductToDelete(product);
    setDeleteConfirmationVisible(true);
  };

  const confirmDelete = async () => {
    if (productToDelete) {
      const updatedProducts = products.filter(p => p.id !== productToDelete.id);
      setProducts(updatedProducts);
      await saveProducts(updatedProducts);
      
      Toast.show({
        type: 'success',
        text1: 'Produto excluído',
        text2: 'O produto foi excluído com sucesso!',
        visibilityTime: 2000,
      });
    }
    setDeleteConfirmationVisible(false);
    setProductToDelete(null);
  };

  const handleEditProduct = (product) => {
    navigation.navigate('AddProductScreen', { product });
  };

  const calculatediasrestantes = (validade) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = new Date(validade);
    expDate.setHours(0, 0, 0, 0);
    const timeDiff = expDate - today;
    return Math.max(Math.floor(timeDiff / (1000 * 3600 * 24)), 0);
  };

  const filterAndSortProducts = useMemo(() => {
    const normalizedSearchText = searchText.toLowerCase().trim();
    
    // Primeiro, filtra os produtos não tratados
    let filteredProducts = products.filter(product => !product.status || product.status !== 'treated');
    
    // Filtro de produtos próximos ao vencimento (30 dias)
    if (showExpiring) {
      filteredProducts = filteredProducts.filter(product => {
        const diasrestantes = calculatediasrestantes(product.validade);
        return diasrestantes <= 30;
      });
    }
    
    if (!normalizedSearchText) {
      return filteredProducts.sort((a, b) => new Date(a.validade) - new Date(b.validade));
    }

    return filteredProducts
      .filter((product) => {
        switch (filterType) {
          case 'descricao':
            return product.descricao?.toLowerCase().includes(normalizedSearchText) ||
                   product.lote?.toLowerCase().includes(normalizedSearchText);
          case 'codprod':
            const codprod = product.codprod?.toString().toLowerCase();
            return codprod?.includes(normalizedSearchText);
          case 'codauxiliar':
            const codauxiliar = product.codauxiliar?.toString().toLowerCase();
            return codauxiliar?.includes(normalizedSearchText);
          default:
            return false;
        }
      })
      .sort((a, b) => {
        // Primeiro ordena por correspondência exata
        const aMatch = a[filterType]?.toString().toLowerCase() === normalizedSearchText;
        const bMatch = b[filterType]?.toString().toLowerCase() === normalizedSearchText;
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
        
        // Depois ordena por data de validade
        return new Date(a.validade) - new Date(b.validade);
      });
  }, [products, searchText, filterType, showExpiring]);

  const debouncedSearch = debounce((text) => setSearchText(text), 300);

  const handleModalClose = useCallback(() => {
    setTreatmentModalVisible(false);
    setTreatmentQuantity('');
  }, []);

  const handleQuantityChange = useCallback((value) => {
    setTreatmentQuantity(value);
  }, []);

  const sortProducts = (products) => {
    return [...products].sort((a, b) => {
      const { field, direction } = sortOrder;
      const multiplier = direction === 'asc' ? 1 : -1;

      switch (field) {
        case 'validade':
          return multiplier * (new Date(a.validade) - new Date(b.validade));
        case 'quantidade':
          return multiplier * (a.quantidade - b.quantidade);
        case 'nome':
          return multiplier * a.descricao.localeCompare(b.descricao);
        default:
          return 0;
      }
    });
  };

  const toggleSort = (field) => {
    setSortOrder(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const renderSortOptions = () => {
    const dividerStyle = {
      width: 1,
      backgroundColor: isDarkMode ? COLORS.borderDark : COLORS.border,
      marginHorizontal: 2,
    };

    // Função auxiliar para retornar o ícone correto de ordenação
    const getSortIcon = (field) => {
      if (sortOrder.field === field) {
        return sortOrder.direction === 'asc' ? 'arrow-upward' : 'arrow-downward';
      }
      return null;
    };

    return (
      <View style={[styles.sortContainer, isDarkMode && styles.darkSortContainer]}>
        <TouchableOpacity 
          style={[
            styles.sortButton, 
            sortOrder.field === 'validade' && styles.activeSortButton
          ]}
          onPress={() => toggleSort('validade')}
        >
          <MaterialIcons 
            name="event" 
            size={16} 
            color={sortOrder.field === 'validade' ? COLORS.white : isDarkMode ? COLORS.textDark : COLORS.textMuted} 
          />
          <Text style={[
            styles.sortButtonText,
            isDarkMode && styles.darkSortButtonText,
            sortOrder.field === 'validade' && styles.activeSortButtonText
          ]}>
            Validade
            {sortOrder.field === 'validade' && (
              <MaterialIcons 
                name={getSortIcon('validade')}
                size={12}
                color={COLORS.white}
                style={{ marginLeft: 2 }}
              />
            )}
          </Text>
        </TouchableOpacity>

        <View style={dividerStyle} />

        <TouchableOpacity 
          style={[
            styles.sortButton, 
            sortOrder.field === 'quantidade' && styles.activeSortButton
          ]}
          onPress={() => toggleSort('quantidade')}
        >
          <MaterialIcons 
            name="sort" 
            size={16} 
            color={sortOrder.field === 'quantidade' ? COLORS.white : isDarkMode ? COLORS.textDark : COLORS.textMuted} 
          />
          <Text style={[
            styles.sortButtonText,
            isDarkMode && styles.darkSortButtonText,
            sortOrder.field === 'quantidade' && styles.activeSortButtonText
          ]}>
            Qtd
            {sortOrder.field === 'quantidade' && (
              <MaterialIcons 
                name={getSortIcon('quantidade')}
                size={12}
                color={COLORS.white}
                style={{ marginLeft: 2 }}
              />
            )}
          </Text>
        </TouchableOpacity>

        <View style={dividerStyle} />

        <TouchableOpacity 
          style={[
            styles.sortButton, 
            sortOrder.field === 'nome' && styles.activeSortButton
          ]}
          onPress={() => toggleSort('nome')}
        >
          <MaterialIcons 
            name="sort-by-alpha" 
            size={16} 
            color={sortOrder.field === 'nome' ? COLORS.white : isDarkMode ? COLORS.textDark : COLORS.textMuted} 
          />
          <Text style={[
            styles.sortButtonText,
            isDarkMode && styles.darkSortButtonText,
            sortOrder.field === 'nome' && styles.activeSortButtonText
          ]}>
            Nome
            {sortOrder.field === 'nome' && (
              <MaterialIcons 
                name={getSortIcon('nome')}
                size={12}
                color={COLORS.white}
                style={{ marginLeft: 2 }}
              />
            )}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const handleSwipeableOpen = (ref) => {
    if (openSwipeRef.current && openSwipeRef.current !== ref) {
      openSwipeRef.current.close();
    }
    openSwipeRef.current = ref;
  };

  const handleCloseSwipe = () => {
    if (openSwipeRef.current) {
      openSwipeRef.current.close();
      openSwipeRef.current = null;
    }
  };

  const renderProductItem = ({ item }) => {
    const diasrestantes = calculatediasrestantes(item.validade);
    if (!swipeRefs.current[item.id]) {
      swipeRefs.current[item.id] = React.createRef();
    }
    return (
      <SwipeableListItem
        ref={swipeRefs.current[item.id]}
        item={item}
        onTreat={() => {
          setSelectedProduct(item);
          setTreatmentModalVisible(true);
        }}
        onEdit={handleEditProduct}
        onDelete={handleDeleteProduct}
        isDarkMode={isDarkMode}
        onSwipeableOpen={() => handleSwipeableOpen(swipeRefs.current[item.id].current)}
        onRequestClose={handleCloseSwipe}
      >
        <ProductItem
          product={{
            ...item,
            validade: new Date(item.validade).toLocaleDateString('pt-BR'),
            diasrestantes,
          }}
          isDarkMode={isDarkMode}
        />
      </SwipeableListItem>
    );
  };

  const toggleFilter = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsFilterVisible((prev) => !prev);
  };

  const setSelectedFilter = (filter) => {
    setFilterType(filter);
    setIsFilterVisible(false);
  };

  const renderEmptyList = () => (
    <View style={styles.emptyList}>
      <Text style={[styles.emptyText, isDarkMode && styles.darkEmptyText]}>
        Nenhum produto encontrado.{'\n'}
        Adicione produtos para começar!
      </Text>
    </View>
  );

  const FilterOption = ({ label, icon, isSelected, onPress }) => (
    <TouchableOpacity 
      style={[
        styles.filterOption,
        isSelected && styles.filterOptionSelected,
        isDarkMode && styles.darkFilterOption,
        isSelected && isDarkMode && styles.darkFilterOptionSelected
      ]} 
      onPress={onPress}
    >
      <MaterialIcons 
        name={icon} 
        size={20} 
        color={isSelected ? COLORS.white : (isDarkMode ? COLORS.textDark : COLORS.textMuted)} 
      />
      <Text style={[
        styles.filterOptionText,
        isSelected && styles.filterOptionTextSelected,
        isDarkMode && styles.darkFilterOptionText
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderSearchBar = () => (
    <View style={styles.searchWrapper}>
      <View style={[styles.searchContainer, isDarkMode && styles.darkSearchContainer]}>
        <TouchableOpacity 
          style={[styles.filterButton, isDarkMode && styles.darkFilterButton]} 
          onPress={toggleFilter}
        >
          <MaterialIcons 
            name={filterType === 'descricao' ? 'text-fields' : 
                  filterType === 'codprod' ? 'code' : 'qr-code'} 
            size={24} 
            color={COLORS.white}
          />
        </TouchableOpacity>
        
        <TextInput
          style={[styles.searchInput, isDarkMode && styles.darkSearchInput]}
          placeholder={
            filterType === 'descricao' ? 'Buscar por nome do produto...' :
            filterType === 'codprod' ? 'Buscar por código interno...' :
            'Buscar por código EAN...'
          }
          placeholderTextColor={isDarkMode ? COLORS.textMutedDark : COLORS.placeholderLight}
          onChangeText={debouncedSearch}
          keyboardType={filterType !== 'descricao' ? 'numeric' : 'default'}
        />
      </View>
      
      {isFilterVisible && (
        <Animated.View style={[styles.filterOptions, isDarkMode && styles.darkFilterOptions]}>
          <FilterOption
            label="Nome do Produto"
            icon="text-fields"
            isSelected={filterType === 'descricao'}
            onPress={() => setSelectedFilter('descricao')}
          />
          <FilterOption
            label="Código Interno"
            icon="code"
            isSelected={filterType === 'codprod'}
            onPress={() => setSelectedFilter('codprod')}
          />
          <FilterOption
            label="Código EAN"
            icon="qr-code"
            isSelected={filterType === 'codauxiliar'}
            onPress={() => setSelectedFilter('codauxiliar')}
          />
        </Animated.View>
      )}
    </View>
  );

  const handleTreatProduct = async (product, treatmentType) => {
    try {
      const quantity = parseInt(treatmentQuantity);
      
      if (isNaN(quantity) || quantity <= 0) {
        Toast.show({
          type: 'error',
          text1: 'Quantidade Inválida',
          text2: 'Por favor, insira uma quantidade válida',
          visibilityTime: 3000,
        });
        return;
      }

      if (quantity > product.quantidade) {
        Toast.show({
          type: 'error',
          text1: 'Quantidade Excede Estoque',
          text2: 'A quantidade não pode ser maior que o estoque disponível',
          visibilityTime: 3000,
        });
        return;
      }

      const updatedProducts = products.map(p => {
        if (p.id === product.id) {
          const remainingQuantity = p.quantidade - quantity;
          
          if (remainingQuantity > 0) {
            // Se ainda sobrar quantidade, cria um novo produto tratado e atualiza o original
            const treatedProduct = {
              ...p,
              id: Date.now().toString(), // Novo ID para o produto tratado
              status: 'treated',
              treatmentType,
              treatmentDate: new Date().toISOString(),
              quantidade: quantity,
            };
            
            // Atualiza a quantidade do produto original
            p.quantidade = remainingQuantity;
            
            // Retorna um array com ambos os produtos
            return [p, treatedProduct];
          } else {
            // Se toda a quantidade foi tratada, apenas marca o produto como tratado
            return [{
              ...p,
              status: 'treated',
              treatmentType,
              treatmentDate: new Date().toISOString(),
              quantidade: quantity,
            }];
          }
        }
        return [p];
      });

      // Flatten o array de produtos
      const flattenedProducts = updatedProducts.flat();

      await AsyncStorage.setItem('products', JSON.stringify(flattenedProducts));
      setProducts(flattenedProducts);
      setTreatmentModalVisible(false);
      setSelectedProduct(null);
      setTreatmentQuantity('');

      Toast.show({
        type: 'success',
        text1: 'Produto Tratado',
        text2: `${quantity} unidades ${
          treatmentType === 'sold' ? 'vendidas' : 
          treatmentType === 'exchanged' ? 'trocadas' : 
          treatmentType === 'returned' ? 'devolvidas' : 
          'vencidas'
        }`,
        visibilityTime: 2000,
      });
    } catch (error) {
      console.error('Erro ao tratar produto:', error);
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Não foi possível tratar o produto',
        visibilityTime: 3000,
      });
    }
  };

  return (
    <ScreenLayout
      isDarkMode={isDarkMode}
      lightBackground={COLORS.background}
      darkBackground={COLORS.darkBackground}
      contentStyle={[styles.container, isDarkMode && styles.darkBackground]}
    >
      {renderSearchBar()}
      {renderSortOptions()}
      <View style={styles.statsContainer}>
        <Text style={[styles.statsText, isDarkMode && styles.darkStatsText]}>
          {filterAndSortProducts.length} {filterAndSortProducts.length === 1 ? 'item' : 'itens'}
          {showExpiring ? ' próximos ao vencimento' : ''}
        </Text>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color={COLORS.accent} style={styles.loadingIndicator} />
      ) : (
        <FlatList
          data={sortProducts(filterAndSortProducts)}
          renderItem={renderProductItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            filterAndSortProducts.length === 0 ? { flex: 1 } : { paddingBottom: 20 },
            { paddingTop: 8 }
          ]}
          ListEmptyComponent={renderEmptyList}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={10}
          onScrollBeginDrag={() => setIsFilterVisible(false)}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}
      <TreatmentModal
        visible={treatmentModalVisible}
        onClose={handleModalClose}
        onTreat={handleTreatProduct}
        selectedProduct={selectedProduct}
        isDarkMode={isDarkMode}
        quantity={treatmentQuantity}
        onQuantityChange={handleQuantityChange}
      />
      <DeleteConfirmationModal
        visible={deleteConfirmationVisible}
        onClose={() => {
          setDeleteConfirmationVisible(false);
          setProductToDelete(null);
        }}
        onConfirm={confirmDelete}
        product={productToDelete}
        isDarkMode={isDarkMode}
      />
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  // ==================== Estilos do Container Principal ====================
  container: {
    flex: 1,
    padding: 8,
    backgroundColor: COLORS.background,
  },
  darkBackground: {
    backgroundColor: COLORS.darkBackground,
  },

  // ==================== Estilos da Barra de Pesquisa ====================
  searchWrapper: {
    zIndex: 999,
    marginBottom: 12,
    position: 'relative',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 3,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  darkSearchContainer: {
    backgroundColor: COLORS.cardDark,
    borderColor: COLORS.borderDark,
  },
  filterButton: {
    backgroundColor: COLORS.accent,
    padding: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  darkFilterButton: {
    backgroundColor: COLORS.secondary,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: COLORS.text,
  },
  darkSearchInput: {
    color: COLORS.textDark,
  },
  
  // ==================== Estilos das Opções de Filtro ====================
  filterOptions: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    marginTop: 8,
    padding: 8,
    elevation: 5,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    zIndex: 1000,
  },
  darkFilterOptions: {
    backgroundColor: COLORS.cardDark,
    borderColor: COLORS.borderDark,
    borderWidth: 1,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginVertical: 4,
  },
  filterOptionSelected: {
    backgroundColor: COLORS.accent,
  },
  darkFilterOption: {
    borderColor: COLORS.borderDark,
  },
  darkFilterOptionSelected: {
    backgroundColor: COLORS.secondary,
  },
  darkFilterOptionText: {
    color: COLORS.textDark,
  },
  filterOptionText: {
    marginLeft: 12,
    fontSize: 15,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  
  // ==================== Estilos da Lista de Produtos ====================
  productItem: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    marginVertical: 4,
    marginHorizontal: 2,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  darkProductItem: {
    backgroundColor: COLORS.cardDark,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 10,
  },
  darkEmptyText: {
    color: COLORS.textMutedDark,
  },
  
  // ==================== Estilos das Estatísticas ====================
  statsContainer: {
    paddingHorizontal: 4,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsText: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  darkStatsText: {
    color: COLORS.textMutedDark,
  },

  // ==================== Estilos de Ordenação ====================
  sortContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    borderRadius: 8,
    marginVertical: 6,
    padding: 4,
    elevation: 2,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  darkSortContainer: {
    backgroundColor: COLORS.cardDark,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    borderRadius: 6,
    flex: 1,
    justifyContent: 'center',
  },
  activeSortButton: {
    backgroundColor: COLORS.accent,
  },
  sortButtonText: {
    marginLeft: 4,
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  darkSortButtonText: {
    color: COLORS.textDark,
  },
  activeSortButtonText: {
    color: COLORS.white,
  },

  // ==================== Estilos das Ações da Esquerda ====================
  leftActionsContainer: {
    width: 100,
    height: '100%',
    flexDirection: 'row',
    backgroundColor: 'transparent',
    marginLeft: 10,
  },
  leftActionsWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 6,
  },
  loadingIndicator: {
    marginTop: 20,
  },
});

export default ListScreen;
