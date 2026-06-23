import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, FlatList, StyleSheet, Alert, TextInput, ActivityIndicator, Image, TouchableOpacity, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Animatable from 'react-native-animatable';
import ProductItem from '../../../components/validade/ProductItem';
import TreatmentModal from '../../../components/validade/TreatmentModal';
import DeleteConfirmationModal from '../../../components/validade/DeleteConfirmationModal';
import LogisticsInfoModal from '../../../components/validade/LogisticsInfoModal';
import debounce from 'lodash.debounce';
import { LayoutAnimation } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-toast-message';
import SwipeableListItem from '../../../components/validade/SwipeableListItem';
import ScreenLayout, {
  createScreenHeaderTemplate,
  createHeaderTitleTemplate,
  createHeaderActionsTemplate,
} from '../../../components/ScreenLayout';
import {
  cardEntrance,
  getStaggerDelay,
} from '../../../components/animations/entrancePresets';
import { CORESLIST } from '../../../components/coresAuth';
import { EmptyState } from '../../../components/states';
import useLogisticsLocationConfig from '../../settings/hooks/useLogisticsLocationConfig';
import {
  loadValidadeProducts,
  mergeRemoteProductsWithCachedLocation,
  persistValidadeProducts,
  replaceValidadeProductsCache,
} from '../services/validadeProductsService';
import {
  getLogisticsLocationInfoItems,
  sanitizeLogisticsLocation,
} from '../constants/logisticsLocation';
import {
  listValidadeProducts,
  removeValidadeProduct,
} from '../../../services/validadeSupabaseService';

const COLORS = CORESLIST;

const useProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const loadedProducts = await loadValidadeProducts({ preferRemote: true });
      setProducts(loadedProducts);
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
  }, []);

  const saveProducts = useCallback(async (productsToSave) => {
    try {
      await persistValidadeProducts(productsToSave, { syncRemote: true });
    } catch (error) {
      console.error('Erro ao salvar produtos:', error);
      Toast.show({
        type: 'error',
        text1: 'Erro ao salvar produtos',
        text2: 'Não foi possível salvar os produtos.',
        visibilityTime: 3000,
      });
    }
  }, []);

  return { products, setProducts, loadProducts, saveProducts, loading };
};

const ListScreen = ({ route, navigation, isDarkMode }) => {
  const { products, setProducts, loadProducts, saveProducts, loading } = useProducts();
  const { config: logisticsLocationConfig } = useLogisticsLocationConfig();
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
  const [locationInfoVisible, setLocationInfoVisible] = useState(false);
  const [productForLocationInfo, setProductForLocationInfo] = useState(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncingRemote, setIsSyncingRemote] = useState(false);
  const openSwipeRef = useRef(null);
  const swipeRefs = useRef({});
  const localProductsRef = useRef([]);
  const pendingRemoteSnapshotRef = useRef(null);
  const lastSyncDiffSignatureRef = useRef('');
  const inFlightRemoteFetchRef = useRef(null);
  const isCheckingRemoteRef = useRef(false);
  const isSyncingRemoteRef = useRef(false);
  const animatedCardIdsRef = useRef(new Set());

  useEffect(() => {
    localProductsRef.current = products;
  }, [products]);

  useEffect(() => {
    const prefetchImages = async () => {
      const urls = products
        .map((item) => item?.imageUrl)
        .filter((url) => typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://')))
        .slice(0, 24);

      if (urls.length === 0) return;
      await Promise.all(urls.map((url) => Image.prefetch(url).catch(() => null)));
    };

    prefetchImages();
  }, [products]);

  const getProductFingerprint = useCallback((product) => (
    JSON.stringify({
      id: String(product?.id || ''),
      codprod: String(product?.codprod || ''),
      descricao: String(product?.descricao || ''),
      codauxiliar: String(product?.codauxiliar || ''),
      lote: String(product?.lote || ''),
      validade: String(product?.validade || ''),
      quantidade: Number(product?.quantidade || 0),
      diasrestantes: Number(product?.diasrestantes || 0),
      status: String(product?.status || ''),
      treatmentType: String(product?.treatmentType || ''),
      treatmentQuantity: Number(product?.treatmentQuantity || 0),
      treatmentDate: String(product?.treatmentDate || ''),
      imagePath: String(product?.imagePath || ''),
      location: sanitizeLogisticsLocation(product?.location),
    })
  ), []);

  const applyRemoteSnapshot = useCallback(async (remoteProducts, showToast = true) => {
    setProducts(remoteProducts);
    await replaceValidadeProductsCache(remoteProducts);
    pendingRemoteSnapshotRef.current = null;
    setPendingSyncCount(0);
    lastSyncDiffSignatureRef.current = '';

    if (showToast) {
      Toast.show({
        type: 'success',
        text1: 'Lista atualizada',
        text2: 'Produtos sincronizados com sucesso.',
        visibilityTime: 2200,
      });
    }
  }, [setProducts]);

  const fetchRemoteProductsDedup = useCallback(async () => {
    if (inFlightRemoteFetchRef.current) {
      return inFlightRemoteFetchRef.current;
    }

    inFlightRemoteFetchRef.current = listValidadeProducts()
      .then((remoteProducts) => mergeRemoteProductsWithCachedLocation(remoteProducts, localProductsRef.current))
      .finally(() => {
        inFlightRemoteFetchRef.current = null;
      });

    return inFlightRemoteFetchRef.current;
  }, []);

  const synchronizeNow = useCallback(async (showToast = true) => {
    if (isSyncingRemoteRef.current) return;
    isSyncingRemoteRef.current = true;
    setIsSyncingRemote(true);
    try {
      const remoteProducts = pendingRemoteSnapshotRef.current || await fetchRemoteProductsDedup();
      if (Array.isArray(remoteProducts)) {
        await applyRemoteSnapshot(remoteProducts, showToast);
      }
    } catch (error) {
      console.warn('Falha ao sincronizar atualização remota.', error?.message || error);
      if (showToast) {
        Toast.show({
          type: 'error',
          text1: 'Falha na sincronização',
          text2: 'Não foi possível atualizar agora.',
          visibilityTime: 2500,
        });
      }
    } finally {
      isSyncingRemoteRef.current = false;
      setIsSyncingRemote(false);
    }
  }, [applyRemoteSnapshot, fetchRemoteProductsDedup]);

  const checkForIncomingProducts = useCallback(async () => {
    if (isSyncingRemoteRef.current || isCheckingRemoteRef.current) {
      return;
    }
    isCheckingRemoteRef.current = true;
    try {
      const remoteProducts = await fetchRemoteProductsDedup();
      if (!Array.isArray(remoteProducts)) {
        pendingRemoteSnapshotRef.current = null;
        setPendingSyncCount(0);
        lastSyncDiffSignatureRef.current = '';
        return;
      }

      const localProducts = Array.isArray(localProductsRef.current) ? localProductsRef.current : [];
      const localMap = new Map(localProducts.map((item) => [String(item.id), item]));
      const remoteMap = new Map(remoteProducts.map((item) => [String(item.id), item]));

      let addedCount = 0;
      let updatedCount = 0;
      let removedCount = 0;

      for (const remoteId of remoteMap.keys()) {
        if (!localMap.has(remoteId)) {
          addedCount += 1;
          continue;
        }

        const localItem = localMap.get(remoteId);
        const remoteItem = remoteMap.get(remoteId);
        if (getProductFingerprint(localItem) !== getProductFingerprint(remoteItem)) {
          updatedCount += 1;
        }
      }

      for (const localId of localMap.keys()) {
        if (!remoteMap.has(localId)) {
          removedCount += 1;
        }
      }

      const totalChanges = addedCount + updatedCount + removedCount;

      if (totalChanges === 0) {
        pendingRemoteSnapshotRef.current = null;
        setPendingSyncCount(0);
        lastSyncDiffSignatureRef.current = '';
        return;
      }

      const diffSignature = `${addedCount}:${updatedCount}:${removedCount}`;
      pendingRemoteSnapshotRef.current = remoteProducts;
      setPendingSyncCount(totalChanges);

      if (lastSyncDiffSignatureRef.current !== diffSignature) {
        lastSyncDiffSignatureRef.current = diffSignature;
        Toast.show({
          type: 'info',
          text1: totalChanges === 1 ? '1 atualização disponível' : `${totalChanges} atualizações disponíveis`,
          text2: 'Toque para sincronizar',
          visibilityTime: 4500,
          onPress: () => synchronizeNow(true),
        });
      }
    } catch (error) {
      console.warn('Falha ao verificar novos itens.', error?.message || error);
    } finally {
      isCheckingRemoteRef.current = false;
    }
  }, [fetchRemoteProductsDedup, getProductFingerprint, synchronizeNow]);

  useFocusEffect(useCallback(() => {
    let cancelled = false;

    const initialize = async () => {
      await loadProducts();
      if (!cancelled) {
        await checkForIncomingProducts();
      }
    };

    initialize();

    const intervalId = setInterval(() => {
      checkForIncomingProducts();
    }, 20000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [loadProducts, checkForIncomingProducts]));

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
    const headerActions = [
      {
        key: 'toggle-expiring',
        iconName: 'warning',
        accessibilityLabel: 'Mostrar apenas produtos vencendo',
        onPress: () => setShowExpiring(!showExpiring),
        isActive: showExpiring,
        activeBackgroundColor: COLORS.warningActiveBackground,
        iconColor: COLORS.white,
        iconSize: 20,
      },
      {
        key: 'sync-products',
        iconName: 'sync',
        accessibilityLabel: 'Sincronizar produtos',
        onPress: () => synchronizeNow(true),
        isActive: isSyncingRemote,
        activeBackgroundColor: COLORS.warningActiveBackground,
        iconColor: COLORS.white,
        iconSize: 20,
      },
      {
        key: 'add-product',
        iconName: 'add',
        accessibilityLabel: 'Adicionar produto',
        onPress: () => navigation.push('AddProductScreen', {
          screenMode: 'create',
          resetFormToken: Date.now(),
        }),
        iconColor: COLORS.white,
        iconSize: 20,
      },
    ];

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
          title: 'Produtos',
          subtitle: 'Gerencie seu estoque',
          iconName: 'list-alt',
          tintColor: COLORS.white,
        }),
      headerRight: () =>
        createHeaderActionsTemplate({
          isDarkMode,
          actions: headerActions,
        }),
    });
  }, [navigation, isDarkMode, showExpiring, synchronizeNow, isSyncingRemote]);

  const handleDeleteProduct = (product) => {
    setProductToDelete(product);
    setDeleteConfirmationVisible(true);
  };

  const handleOpenLocationInfo = useCallback((product) => {
    setProductForLocationInfo(product);
    setLocationInfoVisible(true);
  }, []);

  const handleCloseLocationInfo = useCallback(() => {
    setLocationInfoVisible(false);
    setProductForLocationInfo(null);
  }, []);

  const confirmDelete = async () => {
    if (productToDelete) {
      const updatedProducts = products.filter(p => p.id !== productToDelete.id);
      setProducts(updatedProducts);
      await saveProducts(updatedProducts);
      try {
        await removeValidadeProduct(productToDelete.id);
      } catch (remoteError) {
        console.warn('Falha ao excluir produto no Supabase.', remoteError?.message || remoteError);
      }

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
    let filteredProducts = products.filter(product => !product.status || (product.status !== 'treated' && product.status !== 'resolved'));

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
    setSelectedProduct(null);
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

  // Coordena "uma linha aberta por vez" rastreando o id (estável) da linha
  // aberta — não o objeto handle, cuja identidade muda entre renders e fazia
  // a reabertura da mesma linha ser interpretada como "outra" e fechá-la.
  const handleSwipeableOpen = (id) => {
    if (openSwipeRef.current != null && openSwipeRef.current !== id) {
      swipeRefs.current[openSwipeRef.current]?.current?.close();
    }
    openSwipeRef.current = id;
  };

  const handleSwipeableClose = (id) => {
    if (openSwipeRef.current === id) {
      openSwipeRef.current = null;
    }
  };

  const renderProductItem = ({ item, index }) => {
    const diasrestantes = calculatediasrestantes(item.validade);
    const animationKey = item.id?.toString() || item.codprod?.toString() || index.toString();
    const shouldAnimateEntry = !animatedCardIdsRef.current.has(animationKey);
    const hasLocationInfo = getLogisticsLocationInfoItems(item?.location, logisticsLocationConfig).length > 0;

    if (shouldAnimateEntry) {
      animatedCardIdsRef.current.add(animationKey);
    }

    if (!swipeRefs.current[item.id]) {
      swipeRefs.current[item.id] = React.createRef();
    }

    return (
      <Animatable.View
        animation={shouldAnimateEntry ? cardEntrance : undefined}
        duration={shouldAnimateEntry ? 460 : 0}
        delay={shouldAnimateEntry ? getStaggerDelay(index) : 0}
        easing="ease-out"
        useNativeDriver
      >
        <SwipeableListItem
          ref={swipeRefs.current[item.id]}
          item={item}
          onLocation={handleOpenLocationInfo}
          onTreat={() => {
            setSelectedProduct(item);
            setTreatmentQuantity(String(item.quantidade || ''));
            setTreatmentModalVisible(true);
          }}
          onEdit={handleEditProduct}
          onDelete={handleDeleteProduct}
          showLocationAction={hasLocationInfo}
          isDarkMode={isDarkMode}
          onSwipeableOpen={() => handleSwipeableOpen(item.id)}
          onSwipeableClose={() => handleSwipeableClose(item.id)}
        >
          <ProductItem
            product={{
              ...item,
              validade: new Date(item.validade).toLocaleDateString('pt-BR'),
              diasrestantes,
            }}
            isDarkMode={isDarkMode}
            shouldAnimateEntry={shouldAnimateEntry}
          />
        </SwipeableListItem>
      </Animatable.View>
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
    <EmptyState
      icon="inventory-2"
      title="Nenhum produto encontrado"
      message="Adicione o primeiro produto para começar a controlar a validade."
      ctaLabel="Adicionar produto"
      onCtaPress={() => navigation.push('AddProductScreen', {
        screenMode: 'create',
        resetFormToken: Date.now(),
      })}
    />
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
        <View style={[styles.filterOptions, isDarkMode && styles.darkFilterOptions]}>
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
        </View>
      )}
    </View>
  );

  const handleTreatProduct = async (product, treatmentType) => {
    try {
      const quantity = parseInt(treatmentQuantity, 10);

      if (Number.isNaN(quantity) || quantity <= 0) {
        Toast.show({
          type: 'error',
          text1: 'Quantidade Invalida',
          text2: 'Por favor, insira uma quantidade valida',
          visibilityTime: 3000,
        });
        return;
      }

      if (quantity > product.quantidade) {
        Toast.show({
          type: 'error',
          text1: 'Quantidade Excede Estoque',
          text2: 'A quantidade nao pode ser maior que o estoque disponivel',
          visibilityTime: 3000,
        });
        return;
      }

      const updatedProducts = products.flatMap((p) => {
        if (p.id === product.id) {
          const remainingQuantity = p.quantidade - quantity;

          if (remainingQuantity > 0) {
            const treatedProduct = {
              ...p,
              id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
              status: 'treated',
              treatmentType,
              treatmentDate: new Date().toISOString(),
              quantidade: quantity,
            };

            return [{ ...p, quantidade: remainingQuantity }, treatedProduct];
          }

          return [{
            ...p,
            status: 'treated',
            treatmentType,
            treatmentDate: new Date().toISOString(),
            quantidade: quantity,
          }];
        }
        return [p];
      });

      setProducts(updatedProducts);
      await saveProducts(updatedProducts);
      handleModalClose();

      Toast.show({
        type: 'success',
        text1: 'Produto Tratado',
        text2: `${quantity} unidades ${treatmentType === 'sold'
          ? 'vendidas'
          : treatmentType === 'exchanged'
            ? 'trocadas'
            : treatmentType === 'returned'
              ? 'devolvidas'
              : 'vencidas'}`,
        visibilityTime: 2000,
      });
    } catch (error) {
      console.error('Erro ao tratar produto:', error);
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Nao foi possivel tratar o produto',
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
      {pendingSyncCount > 0 && (
        <View style={[styles.syncNoticeContainer, isDarkMode && styles.darkSyncNoticeContainer]}>
          <Text style={[styles.syncNoticeText, isDarkMode && styles.darkSyncNoticeText]}>
            {pendingSyncCount === 1 ? '1 item para sincronizar' : `${pendingSyncCount} itens para sincronizar`}
          </Text>
          <TouchableOpacity
            style={styles.syncNoticeButton}
            onPress={() => synchronizeNow(true)}
            disabled={isSyncingRemote}
          >
            <Text style={styles.syncNoticeButtonText}>{isSyncingRemote ? 'Atualizando...' : 'Sincronizar agora'}</Text>
          </TouchableOpacity>
        </View>
      )}
      {loading ? (
        <ActivityIndicator size="large" color={COLORS.accent} style={styles.loadingIndicator} />
      ) : (
        <FlatList
          data={sortProducts(filterAndSortProducts)}
          renderItem={renderProductItem}
          keyExtractor={(item, index) => item.id?.toString() || item.codprod?.toString() || index.toString()}
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
      <LogisticsInfoModal
        visible={locationInfoVisible}
        onClose={handleCloseLocationInfo}
        product={productForLocationInfo}
        isDarkMode={isDarkMode}
        locationConfig={logisticsLocationConfig}
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
  syncNoticeContainer: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.accent,
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  darkSyncNoticeContainer: {
    backgroundColor: COLORS.cardDark,
    borderColor: COLORS.secondary,
  },
  syncNoticeText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
  darkSyncNoticeText: {
    color: COLORS.textDark,
  },
  syncNoticeButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  syncNoticeButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
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
