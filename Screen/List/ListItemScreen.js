import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, FlatList, StyleSheet, Alert, TextInput, ActivityIndicator, Image, TouchableOpacity, Text, Modal, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ProductItem from './ProductListItem';
import TreatmentModal from '../Components/TreatmentModalListItem';
import DeleteConfirmationModal from '../Components/DeleteModalListItem';
import debounce from 'lodash.debounce';
import { Animated, LayoutAnimation } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import SwipeableListItem from '../Components/SwipeableListItem';
import firebaseProductService from '../../services/firebaseProductService';

const useProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadProducts = async () => {
    setLoading(true);
    try {
      // Primeiro tenta carregar do Firebase
      const firebaseProducts = await firebaseProductService.getProducts();
      console.log('Produtos carregados do Firebase:', firebaseProducts.length);
      
      // Carrega também do AsyncStorage para produtos locais
      const storedProducts = await AsyncStorage.getItem('products');
      let asyncStorageProducts = [];
      
      if (storedProducts) {
        asyncStorageProducts = JSON.parse(storedProducts);
        console.log('Produtos carregados do AsyncStorage:', asyncStorageProducts.length);
      }
      
      // Combina os produtos, evitando duplicatas
      const firebaseIds = new Set(firebaseProducts.map(p => p.id));
      const localProducts = asyncStorageProducts.filter(p => !firebaseIds.has(p.id));
      
      const allProducts = [...firebaseProducts, ...localProducts];
      setProducts(allProducts);
      
      console.log('Total de produtos carregados:', allProducts.length);
      
    } catch (error) {
      console.error('Erro ao carregar produtos do Firebase:', error);
      
      // Se o erro for de autenticação, mostra mensagem específica
      if (error.message.includes('não autenticado')) {
        Toast.show({
          type: 'info',
          text1: 'Usuário não autenticado',
          text2: 'Carregando produtos locais...',
          visibilityTime: 2000,
        });
      }
      
      // Fallback para AsyncStorage
      try {
        const storedProducts = await AsyncStorage.getItem('products');
        if (storedProducts) {
          const parsedProducts = JSON.parse(storedProducts);
          setProducts(parsedProducts);
          console.log('Produtos carregados do AsyncStorage (fallback):', parsedProducts.length);
        } else {
          setProducts([]);
          console.log('Nenhum produto encontrado');
        }
      } catch (storageError) {
        console.error('Erro ao carregar produtos do AsyncStorage:', storageError);
        Toast.show({
          type: 'error',
          text1: 'Erro ao carregar produtos',
          text2: 'Não foi possível carregar os produtos.',
          visibilityTime: 3000,
        });
        setProducts([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const saveProducts = async (productsToSave) => {
    try {
      // Tenta salvar no Firebase primeiro (se houver produtos com ID do Firebase)
      // IDs do Firebase agora são baseados na descrição, então verificamos se não são IDs numéricos simples
      const firebaseProducts = productsToSave.filter(p => p.id && !/^\d+$/.test(p.id));
      const asyncStorageProducts = productsToSave.filter(p => !p.id || /^\d+$/.test(p.id));
      
      if (firebaseProducts.length > 0) {
        try {
          // Para produtos do Firebase, apenas atualiza o estado local
          // A exclusão já foi feita individualmente
          console.log('Produtos do Firebase atualizados no estado local');
        } catch (firebaseError) {
          console.log('Erro ao atualizar produtos do Firebase:', firebaseError.message);
        }
      }
      
      // Salva no AsyncStorage (todos os produtos)
      await AsyncStorage.setItem('products', JSON.stringify(productsToSave));
      setProducts(productsToSave);
      console.log('Produtos salvos no AsyncStorage');
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
    // Listener em tempo real do Firebase
    const unsubscribe = firebaseProductService.listenProducts((firebaseProducts) => {
      // Carrega também do AsyncStorage para produtos locais
      AsyncStorage.getItem('products').then((storedProducts) => {
        let asyncStorageProducts = [];
        if (storedProducts) {
          asyncStorageProducts = JSON.parse(storedProducts);
        }
        // Combina os produtos, evitando duplicatas
        const firebaseIds = new Set(firebaseProducts.map(p => p.id));
        const localProducts = asyncStorageProducts.filter(p => !firebaseIds.has(p.id));
        const allProducts = [...firebaseProducts, ...localProducts];
        setProducts(allProducts);
      });
    });
    return () => unsubscribe && unsubscribe();
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
          (p) => p.descricao === newProduct.descricao
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
    const headerButtonStyle = {
      padding: 8,
      borderRadius: 8,
      marginLeft: 8,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDarkMode ? '#1e88e5' : 'rgba(255, 255, 255, 0.2)',
    };

    navigation.setOptions({
      headerShown: true,
      headerStyle: {
        backgroundColor: isDarkMode ? '#2e2e2e' : '#0077ed',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
      },
      headerTintColor: '#FFFFFF',
      headerTitleStyle: {
        fontSize: 20,
        fontWeight: '600',
        letterSpacing: 0.5,
      },
      headerTitle: 'Lista de Produtos',
      headerRight: () => (
        <View style={{ flexDirection: 'row', marginRight: 8 }}>
          <TouchableOpacity 
            style={[
              headerButtonStyle,
              showExpiring && { backgroundColor: isDarkMode ? '#ef5350' : '#ff7043' }
            ]}
            onPress={() => setShowExpiring(!showExpiring)}
          >
            <MaterialIcons 
              name="warning" 
              size={24} 
              color="#FFF" 
            />
          </TouchableOpacity>
          <TouchableOpacity 
            style={headerButtonStyle}
            onPress={() => navigation.navigate('AddProductScreen')}
          >
            <MaterialIcons name="add" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, isDarkMode, showExpiring]);

  const handleDeleteProduct = (product) => {
    setProductToDelete(product);
    setDeleteConfirmationVisible(true);
  };

  const confirmDelete = async () => {
    if (productToDelete) {
      try {
        // Remove do estado local
        const updatedProducts = products.filter(p => p.id !== productToDelete.id);
        setProducts(updatedProducts);
        
        // Tenta excluir do Firebase primeiro
        try {
          await firebaseProductService.deleteProduct(productToDelete.id);
          console.log('Produto excluído do Firebase');
        } catch (firebaseError) {
          console.log('Erro ao excluir do Firebase, salvando apenas no AsyncStorage:', firebaseError.message);
        }
        
        // Salva no AsyncStorage como fallback
        await saveProducts(updatedProducts);
        
        Toast.show({
          type: 'success',
          text1: 'Produto excluído',
          text2: 'O produto foi excluído com sucesso!',
          visibilityTime: 2000,
        });
      } catch (error) {
        console.error('Erro ao excluir produto:', error);
        Toast.show({
          type: 'error',
          text1: 'Erro ao excluir produto',
          text2: 'Não foi possível excluir o produto.',
          visibilityTime: 3000,
        });
      }
    }
    setDeleteConfirmationVisible(false);
    setProductToDelete(null);
  };

  const handleEditProduct = (product) => {
    navigation.navigate('AddProductScreen', { product });
  };

  // Função auxiliar para converter data PT-BR para Date
  const parseDate = (dateString) => {
    if (dateString.includes('/')) {
      const [dia, mes, ano] = dateString.split('/').map(Number);
      return new Date(ano, mes - 1, dia);
    }
    return new Date(dateString);
  };

  const calculatediasrestantes = (validade) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const expDate = parseDate(validade);
      expDate.setHours(0, 0, 0, 0);
      
      const timeDiff = expDate - today;
      return Math.max(Math.floor(timeDiff / (1000 * 3600 * 24)), 0);
    } catch (error) {
      console.error('Erro ao calcular dias restantes:', error);
      return 0;
    }
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
      return filteredProducts.sort((a, b) => {
        const dateA = parseDate(a.validade);
        const dateB = parseDate(b.validade);
        return dateA - dateB;
      });
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
        const dateA = parseDate(a.validade);
        const dateB = parseDate(b.validade);
        return dateA - dateB;
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
          const dateA = parseDate(a.validade);
          const dateB = parseDate(b.validade);
          return multiplier * (dateA - dateB);
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
      backgroundColor: isDarkMode ? '#444' : '#e0e0e0',
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
            color={sortOrder.field === 'validade' ? '#FFF' : isDarkMode ? '#FFF' : '#666'} 
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
                color="#FFF"
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
            color={sortOrder.field === 'quantidade' ? '#FFF' : isDarkMode ? '#FFF' : '#666'} 
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
                color="#FFF"
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
            color={sortOrder.field === 'nome' ? '#FFF' : isDarkMode ? '#FFF' : '#666'} 
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
                color="#FFF"
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
        color={isSelected ? '#fff' : (isDarkMode ? '#fff' : '#666')} 
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
            color="#FFF" 
          />
        </TouchableOpacity>
        
        <TextInput
          style={[styles.searchInput, isDarkMode && styles.darkSearchInput]}
          placeholder={
            filterType === 'descricao' ? 'Buscar por nome do produto...' :
            filterType === 'codprod' ? 'Buscar por código interno...' :
            'Buscar por código EAN...'
          }
          placeholderTextColor={isDarkMode ? '#666' : '#888'}
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

      // Tenta atualizar no Firebase se o produto original veio do Firebase
      if (product.id && product.id.length > 20) { // ID do Firebase é mais longo
        try {
          const updatedProduct = flattenedProducts.find(p => p.id === product.id);
          if (updatedProduct) {
            await firebaseProductService.updateProduct(product.id, updatedProduct);
            console.log('Produto atualizado no Firebase');
          }
        } catch (firebaseError) {
          console.log('Erro ao atualizar produto no Firebase:', firebaseError.message);
        }
      }

      // Salva no AsyncStorage e atualiza o estado
      await saveProducts(flattenedProducts);
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
    <View style={[styles.container, isDarkMode && styles.darkBackground]}>
      {renderSearchBar()}
      {renderSortOptions()}
      <View style={styles.statsContainer}>
        <Text style={[styles.statsText, isDarkMode && styles.darkStatsText]}>
          {filterAndSortProducts.length} {filterAndSortProducts.length === 1 ? 'item' : 'itens'}
          {showExpiring ? ' próximos ao vencimento' : ''}
        </Text>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color="#0077ed" style={styles.loadingIndicator} />
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
    </View>
  );
};

const styles = StyleSheet.create({
  // ==================== Estilos do Container Principal ====================
  container: {
    flex: 1,
    padding: 8,
    backgroundColor: '#F5F5F5',
  },
  darkBackground: {
    backgroundColor: '#121212',
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
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  darkSearchContainer: {
    backgroundColor: '#2e2e2e',
    borderColor: '#444',
  },
  filterButton: {
    backgroundColor: '#0077ed',
    padding: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  darkFilterButton: {
    backgroundColor: '#1e88e5',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#333',
  },
  darkSearchInput: {
    color: '#fff',
  },
  
  // ==================== Estilos das Opções de Filtro ====================
  filterOptions: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginTop: 8,
    padding: 8,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    zIndex: 1000,
  },
  darkFilterOptions: {
    backgroundColor: '#2e2e2e',
    borderColor: '#444',
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginVertical: 4,
  },
  filterOptionSelected: {
    backgroundColor: '#0077ed',
  },
  darkFilterOption: {
    borderColor: '#444',
  },
  filterOptionText: {
    marginLeft: 12,
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  
  // ==================== Estilos da Lista de Produtos ====================
  productItem: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginVertical: 4,
    marginHorizontal: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  darkProductItem: {
    backgroundColor: '#333',
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
  },
  darkEmptyText: {
    color: '#999',
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
    color: '#666',
    fontWeight: '500',
  },
  darkStatsText: {
    color: '#aaa',
  },

  // ==================== Estilos de Ordenação ====================
  sortContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 8,
    marginVertical: 6,
    padding: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  darkSortContainer: {
    backgroundColor: '#2e2e2e',
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
    backgroundColor: '#0077ed',
  },
  sortButtonText: {
    marginLeft: 4,
    color: '#666',
    fontSize: 12,
    fontWeight: '500',
  },
  darkSortButtonText: {
    color: '#fff',
  },
  activeSortButtonText: {
    color: '#fff',
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
