import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  SafeAreaView,
  TouchableOpacity,
  Share,
  Dimensions,
  RefreshControl,
  Modal,
  Animated,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { List, Menu, Divider, FAB, Portal, Provider } from 'react-native-paper';
import ReactNativeBlobUtil from 'react-native-blob-util';
import DocumentPicker from 'react-native-document-picker';
import ShareFile from 'react-native-share';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import { CORESSQL } from '../../components/coresAuth';
import { STORAGE_KEYS } from '../../constants/storage';
import { DATABASE_TABLES } from './constants/schemas';
import { createScreenHeaderTemplate, createHeaderTitleTemplate } from '../../components/ScreenLayout';

const PRIMARY_COLOR = CORESSQL.primary;
const CURRENT_TABLE = DATABASE_TABLES.PRODUCTS;

const { width } = Dimensions.get('window');

const ProductItem = React.memo(({ item, isDarkMode, onPress }) => {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.95)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      tension: 100,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 100,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ scale: scaleAnim }]
      }}
    >
      <TouchableOpacity
        style={[
          styles.item,
          isDarkMode ? styles.itemDark : styles.itemLight,
          styles.itemElevated
        ]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.9}
        accessible={true}
        accessibilityLabel={`Produto ${item.DESCRICAO}`}
        accessibilityHint="Toque para ver detalhes do produto"
      >
        <View style={styles.itemHeader}>
          <View style={styles.codContainer}>
            <Text style={[styles.codprod, isDarkMode ? styles.textDark : styles.textLight]}>
              #{item.CODPROD}
            </Text>
          </View>
          <MaterialIcons
            name="info-outline"
            size={20}
            color={isDarkMode ? '#1E40AF' : '#2563EB'}
          />
        </View>

        <Text style={[styles.descricao, isDarkMode ? styles.textDark : styles.textLight]} numberOfLines={2}>
          {item.DESCRICAO}
        </Text>

        <View style={styles.infoContainer}>
          <View style={styles.brandContainer}>
            <MaterialIcons name="local-offer" size={16} color={isDarkMode ? '#1E40AF' : '#2563EB'} />
            <Text style={[styles.marca, isDarkMode ? styles.textDark : styles.textLight]}>
              {item.MARCA}
            </Text>
          </View>
          <View style={styles.deptContainer}>
            <MaterialIcons name="category" size={16} color={isDarkMode ? '#1E40AF' : '#2563EB'} />
            <Text style={[styles.departamento, isDarkMode ? styles.textDark : styles.textLight]}>
              {item.DEPARTAMENTO}
            </Text>
          </View>
        </View>

        <View style={styles.barcodeContainer}>
          <View style={styles.barcodeItem}>
            <MaterialIcons name="qr-code" size={14} color={isDarkMode ? '#6B7280' : '#9CA3AF'} />
            <Text style={[styles.barcode, isDarkMode ? styles.textDark : styles.textLight]}>
              EAN: {item.CODAUXILIAR}
            </Text>
          </View>
          {Boolean(item.CODAUXILIAR2) && (
            <View style={styles.barcodeItem}>
              <MaterialIcons name="qr-code-2" size={14} color={isDarkMode ? '#6B7280' : '#9CA3AF'} />
              <Text style={[styles.barcode, isDarkMode ? styles.textDark : styles.textLight]}>
                DUN: {item.CODAUXILIAR2}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

const SearchBar = React.memo(({ value, onChangeText, isDarkMode }) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Animated.View
      style={[
        styles.searchContainer,
        isDarkMode ? styles.searchContainerDark : styles.searchContainerLight,
        isFocused && styles.searchContainerFocused
      ]}
    >
      <MaterialIcons
        name="search"
        size={24}
        color={isDarkMode ? '#1E40AF' : '#2563EB'}
      />
      <TextInput
        style={[styles.searchInput, isDarkMode ? styles.searchInputDark : styles.searchInputLight]}
        placeholder="Pesquisar produto..."
        placeholderTextColor={isDarkMode ? '#9CA3AF' : '#6B7280'}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
      {value.length > 0 && (
        <TouchableOpacity
          onPress={() => onChangeText('')}
          style={styles.clearButton}
        >
          <MaterialIcons
            name="close"
            size={20}
            color={isDarkMode ? '#9CA3AF' : '#6B7280'}
          />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
});

const FilterBar = React.memo(({
  filterType,
  setFilterType,
  departamento,
  setDepartamento,
  secao,
  setSecao,
  departamentos,
  secoes,
  isDarkMode
}) => {
  const [filterVisible, setFilterVisible] = useState(false);
  const [deptVisible, setDeptVisible] = useState(false);
  const [secaoVisible, setSecaoVisible] = useState(false);

  const filterTypes = [
    { label: "Todos", value: "ALL", icon: "dashboard" },
    { label: "Código", value: "CODE", icon: "pin" },
    { label: "Descrição", value: "DESC", icon: "description" },
    { label: "Marca", value: "BRAND", icon: "local-offer" },
    { label: "EAN/DUN", value: "BARCODE", icon: "qr-code" },
  ];

  const getFilterIcon = () => {
    const currentFilter = filterTypes.find(f => f.value === filterType);
    return currentFilter?.icon || "filter-list";
  };

  const menuItemSelectedStyle = {
    backgroundColor: isDarkMode ? '#1E40AF20' : '#2563EB20',
  };

  return (
    <View style={styles.filterContainer}>
      <View style={styles.filterRow}>
        <Menu
          visible={filterVisible}
          onDismiss={() => setFilterVisible(false)}
          anchor={
            <TouchableOpacity
              style={[styles.filterChip, isDarkMode ? styles.filterChipDark : styles.filterChipLight]}
              onPress={() => setFilterVisible(true)}
            >
              <MaterialIcons
                name={getFilterIcon()}
                size={20}
                color="#FFFFFF"
              />
              <Text style={styles.filterChipText} numberOfLines={1}>
                {filterTypes.find(f => f.value === filterType)?.label || "Filtrar"}
              </Text>
              <MaterialIcons
                name="expand-more"
                size={20}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          }
          style={[
            styles.menuContent,
            isDarkMode ? styles.menuContentDark : styles.menuContentLight
          ]}
        >
          {filterTypes.map((type) => (
            <Menu.Item
              key={type.value}
              onPress={() => {
                setFilterType(type.value);
                setFilterVisible(false);
              }}
              title={type.label}
              leadingIcon={() => <MaterialIcons name={type.icon} size={24} color={isDarkMode ? '#1E40AF' : '#2563EB'} />}
              style={[
                styles.menuItem,
                filterType === type.value && menuItemSelectedStyle
              ]}
            />
          ))}
        </Menu>

        <Menu
          visible={deptVisible}
          onDismiss={() => setDeptVisible(false)}
          anchor={
            <TouchableOpacity
              style={[styles.filterChip, isDarkMode ? styles.filterChipDark : styles.filterChipLight]}
              onPress={() => setDeptVisible(true)}
            >
              <MaterialIcons
                name="category"
                size={20}
                color="#FFFFFF"
              />
              <Text style={styles.filterChipText} numberOfLines={1}>
                {departamento === 'ALL' ? 'Departamento' : departamento.length > 15 ? departamento.substring(0, 15) + '...' : departamento}
              </Text>
              <MaterialIcons
                name="expand-more"
                size={20}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          }
          style={[
            styles.menuContent,
            isDarkMode ? styles.menuContentDark : styles.menuContentLight
          ]}
        >
          <Menu.Item
            onPress={() => {
              setDepartamento('ALL');
              setDeptVisible(false);
            }}
            title="Todos os departamentos"
            leadingIcon={() => <MaterialIcons name="category" size={24} color={isDarkMode ? '#1E40AF' : '#2563EB'} />}
          />
          <Divider />
          {departamentos.map((dep) => (
            <Menu.Item
              key={dep}
              onPress={() => {
                setDepartamento(dep);
                setDeptVisible(false);
              }}
              title={dep}
              style={[
                styles.menuItem,
                departamento === dep && menuItemSelectedStyle
              ]}
            />
          ))}
        </Menu>

        <Menu
          visible={secaoVisible}
          onDismiss={() => setSecaoVisible(false)}
          anchor={
            <TouchableOpacity
              style={[styles.filterChip, isDarkMode ? styles.filterChipDark : styles.filterChipLight]}
              onPress={() => setSecaoVisible(true)}
            >
              <MaterialIcons
                name="folder-special"
                size={20}
                color="#FFFFFF"
              />
              <Text style={styles.filterChipText} numberOfLines={1}>
                {secao === 'ALL' ? 'Seção' : secao.length > 15 ? secao.substring(0, 15) + '...' : secao}
              </Text>
              <MaterialIcons
                name="expand-more"
                size={20}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          }
          style={[
            styles.menuContent,
            isDarkMode ? styles.menuContentDark : styles.menuContentLight
          ]}
        >
          <Menu.Item
            onPress={() => {
              setSecao('ALL');
              setSecaoVisible(false);
            }}
            title="Todas as seções"
            leadingIcon={() => <MaterialIcons name="folder-special" size={24} color={isDarkMode ? '#1E40AF' : '#2563EB'} />}
          />
          <Divider />
          {secoes.map((sec) => (
            <Menu.Item
              key={sec}
              onPress={() => {
                setSecao(sec);
                setSecaoVisible(false);
              }}
              title={sec}
              style={[
                styles.menuItem,
                secao === sec && menuItemSelectedStyle
              ]}
            />
          ))}
        </Menu>
      </View>
    </View>
  );
});

const ProductDetailsModal = ({ visible, item, onClose, onShare, isDarkMode }) => (
  <Modal
    visible={visible}
    transparent={true}
    animationType="fade"
    onRequestClose={onClose}
  >
    <View style={styles.productModalOverlay}>
      <View style={styles.productModalContent}>
        <TouchableOpacity style={styles.productModalClose} onPress={onClose}>
          <MaterialIcons name="close" size={28} color="#64748B" />
        </TouchableOpacity>
        <View style={styles.productModalIconCircle}>
          <MaterialIcons name="info" size={40} color="#2563EB" />
        </View>
        <Text style={styles.productModalTitle}>Detalhes do {CURRENT_TABLE.label}</Text>
        <View style={styles.productModalBody}>
          {CURRENT_TABLE.fields.map((field) => (
            <View key={field.key} style={styles.productModalRow}>
              <MaterialIcons name={field.icon} size={22} color="#2563EB" />
              <Text style={styles.productModalLabel}>{field.label}</Text>
              <Text style={styles.productModalValue}>{item[field.key] || 'N/A'}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity style={styles.productModalShareButton} onPress={onShare}>
          <MaterialIcons name="share" size={22} color="#fff" />
          <Text style={styles.productModalShareText}>Compartilhar</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const SkeletonItem = ({ isDarkMode }) => {
  const skeletonStyle = {
    backgroundColor: isDarkMode ? '#2D3748' : '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  };

  return (
    <View style={[styles.item, styles.skeletonItem, isDarkMode ? styles.itemDark : styles.itemLight]}>
      <View style={styles.itemHeader}>
        <View style={[skeletonStyle, { width: 80, height: 20 }]} />
        <View style={[skeletonStyle, { width: 20, height: 20, borderRadius: 10 }]} />
      </View>
      <View style={[skeletonStyle, { width: '100%', height: 20, marginVertical: 8 }]} />
      <View style={styles.infoContainer}>
        <View style={[skeletonStyle, { width: '40%', height: 16 }]} />
        <View style={[skeletonStyle, { width: '40%', height: 16 }]} />
      </View>
      <View style={styles.barcodeContainer}>
        <View style={[skeletonStyle, { width: '45%', height: 14 }]} />
        <View style={[skeletonStyle, { width: '45%', height: 14 }]} />
      </View>
    </View>
  );
};

const ClearDatabaseModal = ({ visible, onClose, onConfirm, isDarkMode }) => {
  const [countdown, setCountdown] = useState(3);
  const [isButtonEnabled, setIsButtonEnabled] = useState(false);

  useEffect(() => {
    let timer;

    if (visible) {
      // Reseta estados quando modal abre
      setCountdown(3);
      setIsButtonEnabled(false);

      // Inicia o timer
      timer = setInterval(() => {
        setCountdown((prevCount) => {
          if (prevCount <= 1) {
            clearInterval(timer);
            setIsButtonEnabled(true);
            return 0;
          }
          return prevCount - 1;
        });
      }, 1000);
    }

    // Cleanup function
    return () => {
      if (timer) clearInterval(timer);
      setCountdown(3);
      setIsButtonEnabled(false);
    };
  }, [visible]); // Dependência apenas do visible

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[
          styles.clearModalContent,
          isDarkMode ? styles.modalContentDark : styles.modalContentLight
        ]}>
          <View style={styles.clearModalHeader}>
            <MaterialIcons
              name="warning"
              size={48}
              color="#DC2626"
            />
            <Text style={[styles.clearModalTitle, { color: '#DC2626' }]}>
              Atenção!
            </Text>
          </View>

          <Text style={[
            styles.clearModalText,
            { color: isDarkMode ? '#FFFFFF' : '#000000' }
          ]}>
            Você está prestes a limpar todos os dados do banco. Esta ação não pode ser desfeita.
          </Text>

          <View style={styles.clearModalButtons}>
            <TouchableOpacity
              style={[styles.clearModalButton, styles.cancelButton]}
              onPress={onClose}
            >
              <MaterialIcons name="close" size={20} color="#FFFFFF" />
              <Text style={styles.clearModalButtonText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.clearModalButton,
                styles.confirmButton,
                !isButtonEnabled && styles.confirmButtonDisabled
              ]}
              onPress={onConfirm}
              disabled={!isButtonEnabled}
            >
              <MaterialIcons name="delete-outline" size={20} color="#FFFFFF" />
              <Text style={[
                styles.clearModalButtonText,
                !isButtonEnabled && styles.clearModalButtonTextDisabled
              ]}>
                Limpar {countdown > 0 ? `(${countdown})` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const FabGroup = ({ onImport, onExport, onClear, isDarkMode }) => {
  const [isOpen, setIsOpen] = useState(false);

  const fabIconStyle = {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  };

  return (
    <Portal>
      <FAB.Group
        open={isOpen}
        visible={true}
        icon={isOpen ? 'close' : 'plus'}
        actions={[
          {
            icon: () => (
              <View style={fabIconStyle}>
                <MaterialIcons
                  name="cloud-upload"
                  size={24}
                  color="#FFFFFF"
                />
              </View>
            ),
            label: 'IMPORTAR',
            onPress: onImport,
            style: {
              backgroundColor: isDarkMode ? '#1E40AF' : '#2563EB',
              borderRadius: 16,
              elevation: 8,
            },
            labelStyle: {
              fontSize: 14,
              fontWeight: 'bold',
              color: isDarkMode ? '#E5E7EB' : '#1F2937',
            }
          },
          {
            icon: () => (
              <View style={fabIconStyle}>
                <MaterialIcons
                  name="cloud-download"
                  size={24}
                  color="#FFFFFF"
                />
              </View>
            ),
            label: 'EXPORTAR',
            onPress: onExport,
            style: {
              backgroundColor: isDarkMode ? '#1E40AF' : '#2563EB',
              borderRadius: 16,
              elevation: 8,
            },
            labelStyle: {
              fontSize: 14,
              fontWeight: 'bold',
              color: isDarkMode ? '#E5E7EB' : '#1F2937',
            }
          },
          {
            icon: () => (
              <View style={fabIconStyle}>
                <MaterialIcons
                  name="delete-forever"
                  size={24}
                  color="#FFFFFF"
                />
              </View>
            ),
            label: 'LIMPAR',
            onPress: onClear,
            style: {
              backgroundColor: '#DC2626',
              borderRadius: 16,
              elevation: 8,
            },
            labelStyle: {
              fontSize: 14,
              fontWeight: 'bold',
              color: isDarkMode ? '#E5E7EB' : '#1F2937',
            }
          },
        ]}
        onStateChange={({ open }) => setIsOpen(open)}
        fabStyle={{
          backgroundColor: isDarkMode ? '#1E40AF' : '#2563EB',
          height: 56,
          width: 56,
          borderRadius: 16,
          elevation: 8,
        }}
      />
    </Portal>
  );
};

const SqlScreen = ({ isDarkMode, navigation }) => {
  const [dados, setDados] = useState([]); // Inicia com array vazio
  const [filteredDados, setFilteredDados] = useState([]); // Inicia com array vazio
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [selectedDepartamento, setSelectedDepartamento] = useState('ALL');
  const [selectedSecao, setSelectedSecao] = useState('ALL');
  const [refreshing, setRefreshing] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' ou 'grid'
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);

  const departamentos = useMemo(() => {
    return [...new Set(dados.map(item => item.DEPARTAMENTO))].sort();
  }, [dados]);

  const secoes = useMemo(() => {
    let secoesArray = selectedDepartamento === 'ALL'
      ? [...new Set(dados.map(item => item.SECAO))]
      : [...new Set(dados.filter(item => item.DEPARTAMENTO === selectedDepartamento).map(item => item.SECAO))];
    return secoesArray.sort();
  }, [dados, selectedDepartamento]);

  useEffect(() => {
    applyFilters();
  }, [dados, searchQuery, filterType, selectedDepartamento, selectedSecao]);

  const applyFilters = () => {
    let filtered = [...dados];

    // Filtro por departamento
    if (selectedDepartamento !== 'ALL') {
      filtered = filtered.filter(item => item.DEPARTAMENTO === selectedDepartamento);
    }

    // Filtro por seção
    if (selectedSecao !== 'ALL') {
      filtered = filtered.filter(item => item.SECAO === selectedSecao);
    }

    // Filtro por texto
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => {
        switch (filterType) {
          case 'CODE':
            return item.CODPROD.toString().includes(query);
          case 'DESC':
            return item.DESCRICAO.toLowerCase().includes(query);
          case 'BRAND':
            return item.MARCA.toLowerCase().includes(query);
          case 'BARCODE':
            return String(item.CODAUXILIAR).includes(query) ||
              String(item.CODAUXILIAR2).includes(query);
          case 'DEPT':
            return item.DEPARTAMENTO.toLowerCase().includes(query);
          case 'SECTION':
            return item.SECAO.toLowerCase().includes(query);
          default:
            return item.DESCRICAO.toLowerCase().includes(query) ||
              item.CODPROD.toString().includes(query) ||
              item.MARCA.toLowerCase().includes(query) ||
              String(item.CODAUXILIAR).includes(query) ||
              String(item.CODAUXILIAR2).includes(query) ||
              item.DEPARTAMENTO.toLowerCase().includes(query) ||
              item.SECAO.toLowerCase().includes(query);
        }
      });
    }

    setFilteredDados(filtered);
  };

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    setIsLoading(true);

    try {
      // Carrega dados do cache sem apagar
      const cached = await AsyncStorage.getItem('cached_products');
      if (cached) {
        const parsedCache = JSON.parse(cached);
        setDados(parsedCache);
        setFilteredDados(parsedCache);
        Toast.show({
          type: 'success',
          text1: 'Sucesso',
          text2: 'Dados atualizados com sucesso!',
          visibilityTime: 2000,
        });
      } else {
        // Se não há dados no cache, mantém o estado atual
        Toast.show({
          type: 'info',
          text1: 'Info',
          text2: 'Nenhum dado encontrado. Importe dados primeiro.',
          visibilityTime: 3000,
        });
      }
    } catch (error) {
      console.error('Erro ao atualizar:', error);
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Não foi possível atualizar os dados: ' + error.message,
        visibilityTime: 4000,
      });
    } finally {
      setRefreshing(false);
      setIsLoading(false);
    }
  }, []);

  const exportData = async (format) => {
    switch (format) {
      case 'json':
        await exportJSON();
        break;
      case 'csv':
        await exportCSV();
        break;
      case 'excel':
        await exportExcel();
        break;
    }
  };

  const exportFilteredData = async () => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `produtos_filtrados_${timestamp}.json`;
      const fileString = JSON.stringify(filteredDados, null, 2);

      const filePath = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/${fileName}`;
      await ReactNativeBlobUtil.fs.writeFile(filePath, fileString, 'utf8');

      const fileUrl = filePath.startsWith('file://') ? filePath : `file://${filePath}`;
      await ShareFile.open({
        url: fileUrl,
        type: 'application/json',
        title: 'Exportar dados filtrados',
      });
    } catch (error) {
      console.error('Erro ao exportar:', error);
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Não foi possível exportar os dados: ' + error.message,
        visibilityTime: 4000,
      });
    }
  };

  const exportAllData = async () => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `todos_produtos_${timestamp}.json`;
      const fileString = JSON.stringify(dados, null, 2);

      const filePath = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/${fileName}`;
      await ReactNativeBlobUtil.fs.writeFile(filePath, fileString, 'utf8');

      const fileUrl = filePath.startsWith('file://') ? filePath : `file://${filePath}`;
      await ShareFile.open({
        url: fileUrl,
        type: 'application/json',
        title: 'Exportar dados',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Não foi possível exportar os dados',
        visibilityTime: 3000,
      });
    }
  };

  const importData = async () => {
    try {
      const result = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.json],
        copyTo: 'cachesDirectory',
      });

      const fileUri = result.fileCopyUri || result.uri;
      const normalizedPath = fileUri.startsWith('file://') ? fileUri.replace('file://', '') : fileUri;

      try {
        const content = await ReactNativeBlobUtil.fs.readFile(normalizedPath, 'utf8');
        const parsedData = JSON.parse(content);

        // Verifica se é um array direto ou tem estrutura aninhada
        let produtos = [];
        if (Array.isArray(parsedData)) {
          // Se é um array direto, usa como está
          produtos = parsedData;
        } else if (parsedData.produtos && Array.isArray(parsedData.produtos)) {
          // Se tem estrutura com produtos, extrai
          produtos = parsedData.produtos;
        } else if (parsedData[0] && parsedData[0].produtos) {
          // Se é array com objeto que tem produtos
          produtos = parsedData[0].produtos;
        }

        if (produtos.length > 0) {
          // Validação básica da estrutura dos dados
          const isValidStructure = produtos.every(item =>
            item.hasOwnProperty('CODPROD') || item.hasOwnProperty('id') ||
            item.hasOwnProperty('DESCRICAO') || item.hasOwnProperty('descricao') ||
            item.hasOwnProperty('MARCA') || item.hasOwnProperty('nome')
          );

          if (isValidStructure) {
            // Normaliza os dados para o formato esperado
            const normalizedData = produtos.map(CURRENT_TABLE.normalize);

            try {
              await AsyncStorage.setItem(STORAGE_KEYS.SQL_CACHE, JSON.stringify(normalizedData));

              // Verifica se o dado realmente ficou persistido (evita "sumir" ao sair da tela)
              const persisted = await AsyncStorage.getItem(STORAGE_KEYS.SQL_CACHE);
              let persistedCount = 0;
              if (persisted) {
                const parsedPersisted = JSON.parse(persisted);
                if (Array.isArray(parsedPersisted)) {
                  persistedCount = parsedPersisted.length;
                }
              }

              setDados(normalizedData);
              setFilteredDados(normalizedData);

              if (persistedCount !== normalizedData.length) {
                Toast.show({
                  type: 'error',
                  text1: 'Aviso',
                  text2: 'Os dados foram importados, mas houve falha ao persistir totalmente no armazenamento.',
                  visibilityTime: 4500,
                });
              } else {
                Toast.show({
                  type: 'success',
                  text1: 'Sucesso',
                  text2: `${normalizedData.length} produtos importados com sucesso`,
                  visibilityTime: 3000,
                });
              }
            } catch (storageError) {
              console.error('Erro ao salvar no cache:', storageError);
              setDados(normalizedData);
              setFilteredDados(normalizedData);
              Toast.show({
                type: 'error',
                text1: 'Erro',
                text2: 'Não foi possível salvar o banco no armazenamento do app.',
                visibilityTime: 4500,
              });
            }
          } else {
            Toast.show({
              type: 'error',
              text1: 'Erro',
              text2: 'O arquivo não contém a estrutura de dados esperada',
              visibilityTime: 4000,
            });
          }
        } else {
          Toast.show({
            type: 'error',
            text1: 'Erro',
            text2: 'O arquivo não contém uma lista válida de produtos',
            visibilityTime: 4000,
          });
        }
      } catch (parseError) {
        console.error('Erro ao processar arquivo:', parseError);
        Toast.show({
          type: 'error',
          text1: 'Erro',
          text2: 'O arquivo selecionado não é um JSON válido',
          visibilityTime: 4000,
        });
      }
    } catch (error) {
      if (DocumentPicker.isCancel(error)) {
        return;
      }
      console.error('Erro ao importar:', error);
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Não foi possível importar os dados: ' + error.message,
        visibilityTime: 4000,
      });
    }
  };

  const handleItemPress = (item) => {
    setSelectedItem(item);
    setModalVisible(true);
  };

  const handleShare = async (item) => {
    try {
      const message =
        `Produto: ${item.DESCRICAO}\n` +
        `Código: ${item.CODPROD}\n` +
        `Marca: ${item.MARCA}\n` +
        `Departamento: ${item.DEPARTAMENTO}\n` +
        `Seção: ${item.SECAO}\n` +
        `EAN: ${item.CODAUXILIAR}\n` +
        `DUN: ${item.CODAUXILIAR2 || 'N/A'}`;

      await Share.share({
        message,
        title: 'Detalhes do Produto',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Não foi possível compartilhar os detalhes do produto',
        visibilityTime: 3000,
      });
    }
  };

  const renderItem = ({ item }) => (
    <ProductItem
      item={item}
      isDarkMode={isDarkMode}
      onPress={() => handleItemPress(item)}
    />
  );

  useEffect(() => {
    navigation.setOptions({
      ...createScreenHeaderTemplate({
        isDarkMode,
        lightHeaderColor: '#2563EB',
        darkHeaderColor: '#1E40AF',
        tintColor: '#FFFFFF',
        titleSize: 20,
        titleWeight: '600',
        headerStyleOverride: {
          elevation: 5,
          shadowColor: '#2563EB',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 3,
        },
      }),
      headerTitle: () =>
        createHeaderTitleTemplate({
          title: 'Banco de Dados',
          iconName: 'storage',
          tintColor: '#FFFFFF',
        }),
      headerRight: null,
    });
  }, [navigation, isDarkMode]);

  const AdvancedSearchModal = () => (
    <Modal
      visible={showAdvancedSearch}
      transparent
      animationType="slide"
    >
      <View style={styles.advancedSearchContainer}>
        {/* Adicionar campos de filtro avançado */}
      </View>
    </Modal>
  );

  const cacheData = async (data) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SQL_CACHE, JSON.stringify(data));
    } catch (error) {
      console.error('Erro ao cachear dados:', error);
    }
  };

  const loadCachedData = useCallback(async () => {
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEYS.SQL_CACHE);
      if (!cached) {
        setDados([]);
        setFilteredDados([]);
        return;
      }

      const parsedData = JSON.parse(cached);
      if (!Array.isArray(parsedData)) {
        setDados([]);
        setFilteredDados([]);
        return;
      }

      setDados(parsedData);
      setFilteredDados(parsedData);
    } catch (error) {
      console.error('Erro ao carregar cache:', error);
    }
  }, []);

  const addToHistory = (query) => {
    setSearchHistory(prev => [query, ...prev.slice(0, 4)]);
  };

  // Recarrega sempre que a tela voltar ao foco (garante que o banco "permaneça" no app)
  useFocusEffect(
    useCallback(() => {
      loadCachedData();
    }, [loadCachedData])
  );

  const clearDatabase = async () => {
    try {
      setDados([]);
      setFilteredDados([]);
      await AsyncStorage.setItem(STORAGE_KEYS.SQL_CACHE, JSON.stringify([]));
      Toast.show({
        type: 'success',
        text1: 'Sucesso',
        text2: 'Banco de dados limpo com sucesso!',
        visibilityTime: 3000,
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Não foi possível limpar o banco de dados',
        visibilityTime: 4000,
      });
    } finally {
      setShowClearModal(false);
    }
  };

  return (
    <Provider>
      <SafeAreaView style={[styles.container, isDarkMode ? styles.containerDark : styles.containerLight]}>
        <View style={styles.header}>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            isDarkMode={isDarkMode}
          />

          <FilterBar
            filterType={filterType}
            setFilterType={setFilterType}
            departamento={selectedDepartamento}
            setDepartamento={setSelectedDepartamento}
            secao={selectedSecao}
            setSecao={setSelectedSecao}
            departamentos={departamentos}
            secoes={secoes}
            isDarkMode={isDarkMode}
          />

          <Text
            style={[
              styles.resultCount,
              { color: isDarkMode ? '#2563EB' : '#2563EB' }
            ]}
          >
            {filteredDados.length} produtos encontrados
          </Text>
        </View>

        {isLoading ? (
          <FlatList
            data={[1, 2, 3, 4, 5]}
            renderItem={() => <SkeletonItem isDarkMode={isDarkMode} />}
            keyExtractor={item => String(item)}
          />
        ) : (
          <FlatList
            data={filteredDados}
            renderItem={renderItem}
            keyExtractor={item => String(item.CODPROD)}
            contentContainerStyle={styles.listContainer}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#2563EB']}
                tintColor={isDarkMode ? '#1E40AF' : '#2563EB'}
                progressBackgroundColor={isDarkMode ? '#1E293B' : '#FFFFFF'}
              />
            }
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <View style={[styles.emptyIconContainer, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' }]}>
                  <MaterialIcons
                    name="inbox"
                    size={48}
                    color={isDarkMode ? '#1E40AF' : '#2563EB'}
                  />
                </View>
                <Text style={[
                  styles.emptyText,
                  { color: isDarkMode ? '#E5E7EB' : '#1F2937' }
                ]}>
                  Nenhum produto encontrado
                </Text>
                <Text style={[
                  styles.emptySubtext,
                  { color: isDarkMode ? '#9CA3AF' : '#6B7280' }
                ]}>
                  Importe dados para começar a gerenciar seus produtos
                </Text>
                <TouchableOpacity
                  style={[styles.emptyButton, { backgroundColor: isDarkMode ? '#1E40AF' : '#2563EB' }]}
                  onPress={importData}
                >
                  <MaterialIcons name="cloud-upload" size={20} color="#FFFFFF" />
                  <Text style={styles.emptyButtonText}>Importar Produtos</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        )}

        {selectedItem && (
          <ProductDetailsModal
            visible={modalVisible}
            item={selectedItem}
            onClose={() => setModalVisible(false)}
            onShare={() => handleShare(selectedItem)}
            isDarkMode={isDarkMode}
          />
        )}

        <View style={styles.searchHistoryContainer}>
          {searchHistory.map(query => (
            <TouchableOpacity
              key={query}
              onPress={() => setSearchQuery(query)}
            >
              <Text>{query}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <FabGroup
          onImport={importData}
          onExport={exportFilteredData}
          onClear={() => setShowClearModal(true)}
          isDarkMode={isDarkMode}
        />

        <ClearDatabaseModal
          visible={showClearModal}
          onClose={() => setShowClearModal(false)}
          onConfirm={clearDatabase}
          isDarkMode={isDarkMode}
        />
      </SafeAreaView>
    </Provider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerLight: {
    backgroundColor: '#F8FAFC',
  },
  containerDark: {
    backgroundColor: '#111827',
  },
  header: {
    padding: 16,
    gap: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    padding: 16,
    gap: 12,
    marginHorizontal: 4,
    backgroundColor: '#FFFFFF',
    elevation: 6,
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  searchContainerFocused: {
    borderColor: '#2563EB',
    elevation: 8,
    shadowOpacity: 0.2,
  },
  searchContainerLight: {
    backgroundColor: '#FFFFFF',
  },
  searchContainerDark: {
    backgroundColor: '#1E293B',
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
  },
  searchInputLight: {
    color: '#000000',
  },
  searchInputDark: {
    color: '#FFFFFF',
  },
  clearButton: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  filterContainer: {
    marginVertical: 8,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
  },
  filterChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    minHeight: 46,
  },
  filterChipLight: {
    backgroundColor: '#2563EB',
    borderWidth: 1,
    borderColor: '#2563EB20',
  },
  filterChipDark: {
    backgroundColor: '#1E40AF',
    borderWidth: 1,
    borderColor: '#1E40AF20',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    marginHorizontal: 4,
    textAlign: 'left',
    color: '#FFFFFF',
  },
  resultCount: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'right',
    color: '#2563EB',
    letterSpacing: 0.3,
    marginTop: 4,
  },
  listContainer: {
    padding: 16,
  },
  item: {
    padding: 20,
    borderRadius: 20,
    marginBottom: 16,
    marginHorizontal: 4,
    elevation: 4,
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    borderLeftWidth: 4,
  },
  itemElevated: {
    elevation: 6,
    shadowOpacity: 0.15,
  },
  itemLight: {
    backgroundColor: '#FFFFFF',
    borderLeftColor: '#2563EB',
  },
  itemDark: {
    backgroundColor: '#1E293B',
    borderLeftColor: '#1E40AF',
  },
  itemElevated: {
    elevation: 5,
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  codContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  codContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  codprod: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2563EB',
    letterSpacing: 0.5,
  },
  statusBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  descricao: {
    fontSize: 15,
    marginBottom: 10,
    lineHeight: 22,
    letterSpacing: 0.3,
  },
  infoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 8,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deptContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deptContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  marca: {
    fontSize: 14,
    opacity: 0.9,
    fontWeight: '500',
  },
  departamento: {
    fontSize: 14,
    opacity: 0.9,
    fontWeight: '500',
  },
  barcodeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  barcodeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  barcodeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  barcode: {
    fontSize: 12,
    opacity: 0.6,
  },
  textLight: {
    color: '#000000',
  },
  textDark: {
    color: '#FFFFFF',
  },
  headerButton: {
    marginHorizontal: 6,
    padding: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    borderWidth: 1,
  },
  headerButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  menuContent: {
    minWidth: 220,
    maxWidth: width * 0.85,
    borderRadius: 16,
    elevation: 5,
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    borderLeftWidth: 4,
    overflow: 'hidden',
  },
  menuContentLight: {
    backgroundColor: '#FFFFFF',
    borderLeftColor: '#2563EB',
  },
  menuContentDark: {
    backgroundColor: '#1E293B',
    borderLeftColor: '#1E40AF',
  },
  menuItem: {
    minHeight: 48,
    paddingHorizontal: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalContentLight: {
    backgroundColor: '#FFFFFF',
  },
  modalContentDark: {
    backgroundColor: '#1E293B',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },

  closeButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  modalBody: {
    gap: 16,
  },
  detailRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '500',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    marginTop: 20,
    gap: 8,
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  viewModeButton: {
    marginHorizontal: 6,
    padding: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    borderWidth: 1,
  },
  searchHistoryContainer: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
  },
  skeletonItem: {
    opacity: 0.7,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    elevation: 5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  clearModalContent: {
    width: '85%',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    alignSelf: 'center',
    maxWidth: 400,
  },
  clearModalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  clearModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
  },
  clearModalText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  clearModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  clearModalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  cancelButton: {
    backgroundColor: '#6B7280',
  },
  confirmButton: {
    backgroundColor: '#DC2626',
  },
  confirmButtonDisabled: {
    backgroundColor: '#DC262660',
  },
  clearModalButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  clearModalButtonTextDisabled: {
    opacity: 0.7,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 400,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 16,
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 24,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    gap: 8,
    elevation: 4,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  productModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  productModalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 16,
    position: 'relative',
  },
  productModalClose: {
    position: 'absolute',
    top: 18,
    right: 18,
    zIndex: 2,
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    padding: 4,
    elevation: 2,
  },
  productModalIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  productModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2563EB',
    marginBottom: 18,
    textAlign: 'center',
  },
  productModalBody: {
    width: '100%',
    marginBottom: 24,
  },
  productModalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  productModalLabel: {
    fontSize: 15,
    color: '#2563EB',
    minWidth: 90,
    fontWeight: '600',
  },
  productModalValue: {
    fontSize: 15,
    color: '#374151',
    flex: 1,
    fontWeight: '500',
  },
  productModalShareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 32,
    gap: 8,
    elevation: 4,
  },
  productModalShareText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
});

export default SqlScreen;
