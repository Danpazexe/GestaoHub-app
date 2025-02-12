import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  Share,
  Dimensions,
  RefreshControl,
  Modal,
  Animated,
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { List, Menu, Divider, FAB, Portal, Provider } from 'react-native-paper';
import dadosIniciais from '../../assets/Dados.json';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

const ProductItem = React.memo(({ item, isDarkMode, onPress }) => {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      <TouchableOpacity 
        style={[styles.item, isDarkMode ? styles.itemDark : styles.itemLight]}
        onPress={onPress}
        activeOpacity={0.7}
        accessible={true}
        accessibilityLabel={`Produto ${item.DESCRICAO}`}
        accessibilityHint="Toque para ver detalhes do produto"
      >
        <View style={styles.itemHeader}>
          <Text style={[styles.codprod, isDarkMode ? styles.textDark : styles.textLight]}>
            #{item.CODPROD}
          </Text>
          <MaterialIcons name="info-outline" size={20} color={isDarkMode ? '#FFFFFF' : '#000000'} />
        </View>

        <Text style={[styles.descricao, isDarkMode ? styles.textDark : styles.textLight]} numberOfLines={2}>
          {item.DESCRICAO}
        </Text>

        <View style={styles.infoContainer}>
          <Text style={[styles.marca, isDarkMode ? styles.textDark : styles.textLight]}>
            {item.MARCA}
          </Text>
          <Text style={[styles.departamento, isDarkMode ? styles.textDark : styles.textLight]}>
            {item.DEPARTAMENTO}
          </Text>
        </View>

        <View style={styles.barcodeContainer}>
          <Text style={[styles.barcode, isDarkMode ? styles.textDark : styles.textLight]}>
            EAN: {item.CODAUXILIAR}
          </Text>
          {Boolean(item.CODAUXILIAR2) && (
            <Text style={[styles.barcode, isDarkMode ? styles.textDark : styles.textLight]}>
              DUN: {item.CODAUXILIAR2}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

const SearchBar = React.memo(({ value, onChangeText, isDarkMode }) => (
  <View style={[styles.searchContainer, isDarkMode ? styles.searchContainerDark : styles.searchContainerLight]}>
    <MaterialIcons 
      name="search" 
      size={24} 
      color={isDarkMode ? '#0F766E' : '#0D9488'} 
    />
    <TextInput
      style={[styles.searchInput, isDarkMode ? styles.searchInputDark : styles.searchInputLight]}
      placeholder="Pesquisar produto..."
      placeholderTextColor={isDarkMode ? '#999' : '#666'}
      value={value}
      onChangeText={onChangeText}
    />
    {value.length > 0 && (
      <TouchableOpacity onPress={() => onChangeText('')}>
        <MaterialIcons name="close" size={24} color={isDarkMode ? '#FFFFFF' : '#000000'} />
      </TouchableOpacity>
    )}
  </View>
));

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
  
  // Refs para os botões de filtro
  const filterRef = useRef();
  const deptRef = useRef();
  const secaoRef = useRef();

  // Função para obter a posição do botão
  const [filterPosition, setFilterPosition] = useState({ x: 0, y: 0, width: 0 });
  const [deptPosition, setDeptPosition] = useState({ x: 0, y: 0, width: 0 });
  const [secaoPosition, setSecaoPosition] = useState({ x: 0, y: 0, width: 0 });

  const updatePosition = (ref, setPosition) => {
    ref.current?.measureInWindow((x, y, width, height) => {
      setPosition({ x, y: y + height, width });
    });
  };

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

  // Adicione o estilo menuItemSelected aqui
  const menuItemSelectedStyle = {
    backgroundColor: isDarkMode ? '#0F766E20' : '#0D948820',
  };

  return (
    <View style={styles.filterContainer}>
      <View style={styles.filterRow}>
        <TouchableOpacity 
          ref={filterRef}
          style={[styles.filterChip, isDarkMode ? styles.filterChipDark : styles.filterChipLight]}
          onPress={() => {
            updatePosition(filterRef, setFilterPosition);
            setFilterVisible(true);
          }}
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

        <TouchableOpacity 
          ref={deptRef}
          style={[styles.filterChip, isDarkMode ? styles.filterChipDark : styles.filterChipLight]}
          onPress={() => {
            updatePosition(deptRef, setDeptPosition);
            setDeptVisible(true);
          }}
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

        <TouchableOpacity 
          ref={secaoRef}
          style={[styles.filterChip, isDarkMode ? styles.filterChipDark : styles.filterChipLight]}
          onPress={() => {
            updatePosition(secaoRef, setSecaoPosition);
            setSecaoVisible(true);
          }}
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
      </View>

      <Portal>
        <Menu
          visible={filterVisible}
          onDismiss={() => setFilterVisible(false)}
          anchor={{ x: filterPosition.x, y: filterPosition.y }}
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
              leadingIcon={() => <MaterialIcons name={type.icon} size={24} color={isDarkMode ? '#0F766E' : '#0D9488'} />}
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
          anchor={{ x: deptPosition.x, y: deptPosition.y }}
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
            leadingIcon={() => <MaterialIcons name="category" size={24} color={isDarkMode ? '#0F766E' : '#0D9488'} />}
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
          anchor={{ x: secaoPosition.x, y: secaoPosition.y }}
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
            leadingIcon={() => <MaterialIcons name="folder-special" size={24} color={isDarkMode ? '#0F766E' : '#0D9488'} />}
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
      </Portal>
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
    <TouchableOpacity 
      style={styles.modalOverlay}
      activeOpacity={1}
      onPress={onClose}
    >
      <View style={[
        styles.modalContent,
        isDarkMode ? styles.modalContentDark : styles.modalContentLight
      ]}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: isDarkMode ? '#0F766E' : '#0D9488' }]}>
            Detalhes do Produto
          </Text>
          <TouchableOpacity onPress={onClose}>
            <MaterialIcons 
              name="close" 
              size={24} 
              color={isDarkMode ? '#0F766E' : '#0D9488'} 
            />
          </TouchableOpacity>
        </View>

        <View style={styles.modalBody}>
          <View style={styles.detailRow}>
            <MaterialIcons name="tag" size={20} color={isDarkMode ? '#0F766E' : '#0D9488'} />
            <View style={styles.detailContent}>
              <Text style={[styles.detailLabel, isDarkMode ? styles.textDark : styles.textLight]}>Código</Text>
              <Text style={[styles.detailValue, isDarkMode ? styles.textDark : styles.textLight]}>
                {item.CODPROD}
              </Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <MaterialIcons name="description" size={20} color={isDarkMode ? '#0F766E' : '#0D9488'} />
            <View style={styles.detailContent}>
              <Text style={[styles.detailLabel, isDarkMode ? styles.textDark : styles.textLight]}>Descrição</Text>
              <Text style={[styles.detailValue, isDarkMode ? styles.textDark : styles.textLight]}>
                {item.DESCRICAO}
              </Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <MaterialIcons name="local-offer" size={20} color={isDarkMode ? '#0F766E' : '#0D9488'} />
            <View style={styles.detailContent}>
              <Text style={[styles.detailLabel, isDarkMode ? styles.textDark : styles.textLight]}>Marca</Text>
              <Text style={[styles.detailValue, isDarkMode ? styles.textDark : styles.textLight]}>
                {item.MARCA}
              </Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <MaterialIcons name="category" size={20} color={isDarkMode ? '#0F766E' : '#0D9488'} />
            <View style={styles.detailContent}>
              <Text style={[styles.detailLabel, isDarkMode ? styles.textDark : styles.textLight]}>Departamento</Text>
              <Text style={[styles.detailValue, isDarkMode ? styles.textDark : styles.textLight]}>
                {item.DEPARTAMENTO}
              </Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <MaterialIcons name="folder-special" size={20} color={isDarkMode ? '#0F766E' : '#0D9488'} />
            <View style={styles.detailContent}>
              <Text style={[styles.detailLabel, isDarkMode ? styles.textDark : styles.textLight]}>Seção</Text>
              <Text style={[styles.detailValue, isDarkMode ? styles.textDark : styles.textLight]}>
                {item.SECAO}
              </Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <MaterialIcons name="qr-code" size={20} color={isDarkMode ? '#0F766E' : '#0D9488'} />
            <View style={styles.detailContent}>
              <Text style={[styles.detailLabel, isDarkMode ? styles.textDark : styles.textLight]}>Códigos de Barras</Text>
              <Text style={[styles.detailValue, isDarkMode ? styles.textDark : styles.textLight]}>
                EAN: {item.CODAUXILIAR}
              </Text>
              {Boolean(item.CODAUXILIAR2) && (
                <Text style={[styles.detailValue, isDarkMode ? styles.textDark : styles.textLight]}>
                  DUN: {item.CODAUXILIAR2}
                </Text>
              )}
            </View>
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.shareButton, { backgroundColor: isDarkMode ? '#0F766E' : '#0D9488' }]}
          onPress={onShare}
        >
          <MaterialIcons name="share" size={20} color="#FFFFFF" />
          <Text style={styles.shareButtonText}>Compartilhar</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
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
              backgroundColor: isDarkMode ? '#134E4A' : '#115E59',
            },
            labelStyle: {
              fontSize: 16,
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
              backgroundColor: isDarkMode ? '#134E4A' : '#115E59',
            },
            labelStyle: {
              fontSize: 16,
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
            },
            labelStyle: {
              fontSize: 16,
              fontWeight: 'bold',
              color: isDarkMode ? '#E5E7EB' : '#1F2937',
            }
          },
        ]}
        onStateChange={({ open }) => setIsOpen(open)}
        fabStyle={{
          backgroundColor: isDarkMode ? '#0F766E' : '#0D9488',
          height: 56,
          width: 56,
        }}
      />
    </Portal>
  );
};

const SqlScreen = ({ isDarkMode, navigation }) => {
  const [dados, setDados] = useState(dadosIniciais);
  const [filteredDados, setFilteredDados] = useState(dadosIniciais);
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
  }, [searchQuery, filterType, selectedDepartamento, selectedSecao]);

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
      const cached = await AsyncStorage.getItem('cached_products');
      if (cached) {
        const parsedCache = JSON.parse(cached);
        setDados(parsedCache);
        setFilteredDados(parsedCache); // Atualiza também os dados filtrados
      } else {
        setDados(dadosIniciais);
        setFilteredDados(dadosIniciais); // Atualiza também os dados filtrados
        await AsyncStorage.setItem('cached_products', JSON.stringify(dadosIniciais));
      }
      
      Alert.alert('Sucesso', 'Dados atualizados com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar:', error);
      Alert.alert('Erro', 'Não foi possível atualizar os dados: ' + error.message);
    } finally {
      setRefreshing(false);
      setIsLoading(false);
    }
  }, []);

  const exportData = async (format) => {
    switch(format) {
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
      
      // Garante que o diretório existe
      const dirInfo = await FileSystem.getInfoAsync(FileSystem.documentDirectory);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(FileSystem.documentDirectory);
      }
      
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, fileString, {
        encoding: FileSystem.EncodingType.UTF8
      });
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Exportar dados filtrados'
        });
      } else {
        Alert.alert('Erro', 'Compartilhamento não disponível neste dispositivo');
      }
    } catch (error) {
      console.error('Erro ao exportar:', error);
      Alert.alert('Erro', 'Não foi possível exportar os dados: ' + error.message);
    }
  };

  const exportAllData = async () => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `todos_produtos_${timestamp}.json`;
      const fileString = JSON.stringify(dados, null, 2);
      
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, fileString);
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      }
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível exportar os dados');
    }
  };

  const importData = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        // Novo formato do DocumentPicker
        const file = result.assets[0];
        
        try {
          const content = await FileSystem.readAsStringAsync(file.uri);
          const parsedData = JSON.parse(content);
          
          if (Array.isArray(parsedData) && parsedData.length > 0) {
            // Validação básica da estrutura dos dados
            const isValidStructure = parsedData.every(item => 
              item.hasOwnProperty('CODPROD') && 
              item.hasOwnProperty('DESCRICAO') &&
              item.hasOwnProperty('MARCA')
            );

            if (isValidStructure) {
              await AsyncStorage.setItem('cached_products', JSON.stringify(parsedData));
              setDados(parsedData);
              setFilteredDados(parsedData); // Atualiza também os dados filtrados
              Alert.alert('Sucesso', `${parsedData.length} produtos importados com sucesso`);
            } else {
              Alert.alert('Erro', 'O arquivo não contém a estrutura de dados esperada');
            }
          } else {
            Alert.alert('Erro', 'O arquivo não contém uma lista válida de produtos');
          }
        } catch (parseError) {
          console.error('Erro ao processar arquivo:', parseError);
          Alert.alert('Erro', 'O arquivo selecionado não é um JSON válido');
        }
      } else if (result.type === 'success') {
        // Formato antigo do DocumentPicker
        try {
          const content = await FileSystem.readAsStringAsync(result.uri);
          const parsedData = JSON.parse(content);
          
          if (Array.isArray(parsedData) && parsedData.length > 0) {
            const isValidStructure = parsedData.every(item => 
              item.hasOwnProperty('CODPROD') && 
              item.hasOwnProperty('DESCRICAO') &&
              item.hasOwnProperty('MARCA')
            );

            if (isValidStructure) {
              await AsyncStorage.setItem('cached_products', JSON.stringify(parsedData));
              setDados(parsedData);
              setFilteredDados(parsedData); // Atualiza também os dados filtrados
              Alert.alert('Sucesso', `${parsedData.length} produtos importados com sucesso`);
            } else {
              Alert.alert('Erro', 'O arquivo não contém a estrutura de dados esperada');
            }
          } else {
            Alert.alert('Erro', 'O arquivo não contém uma lista válida de produtos');
          }
        } catch (parseError) {
          console.error('Erro ao processar arquivo:', parseError);
          Alert.alert('Erro', 'O arquivo selecionado não é um JSON válido');
        }
      }
    } catch (error) {
      console.error('Erro ao importar:', error);
      Alert.alert('Erro', 'Não foi possível importar os dados: ' + error.message);
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
      Alert.alert('Erro', 'Não foi possível compartilhar os detalhes do produto');
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
      headerTitle: 'Produtos',
      headerTitleStyle: {
        color: isDarkMode ? '#FFFFFF' : '#000000',
        fontSize: 20,
        fontWeight: '600',
      },
      headerStyle: {
        backgroundColor: isDarkMode ? '#0F766E' : '#0D9488',
        elevation: 5,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
      },
      headerTintColor: '#FFFFFF',
      headerShadowVisible: true,
      // Removendo headerRight para eliminar os botões
      headerRight: null
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
      await AsyncStorage.setItem('cached_products', JSON.stringify(data));
    } catch (error) {
      console.error('Erro ao cachear dados:', error);
    }
  };

  const loadCachedData = async () => {
    try {
      const cached = await AsyncStorage.getItem('cached_products');
      if (cached) {
        setDados(JSON.parse(cached));
      }
    } catch (error) {
      console.error('Erro ao carregar cache:', error);
    }
  };

  const addToHistory = (query) => {
    setSearchHistory(prev => [query, ...prev.slice(0, 4)]);
  };

  // Carregamento inicial dos dados
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const cached = await AsyncStorage.getItem('cached_products');
        if (cached) {
          setDados(JSON.parse(cached));
        } else {
          setDados(dadosIniciais);
          await cacheData(dadosIniciais);
        }
        applyFilters();
      } catch (error) {
        console.error('Erro ao carregar dados iniciais:', error);
        setDados(dadosIniciais);
        applyFilters();
      }
    };

    loadInitialData();
  }, []);

  const clearDatabase = async () => {
    try {
      setDados([]);
      setFilteredDados([]);
      await AsyncStorage.setItem('cached_products', JSON.stringify([]));
      Toast.show({
        type: 'success',
        text1: 'Sucesso',
        text2: 'Banco de dados limpo com sucesso!'
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Não foi possível limpar o banco de dados'
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
              { color: isDarkMode ? '#0F766E' : '#0D9488' }
            ]}
          >
            {filteredDados.length} produtos encontrados
          </Text>
        </View>

        {isLoading ? (
          <FlatList
            data={[1,2,3,4,5]}
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
                colors={['#0D9488']}
                tintColor={isDarkMode ? '#0F766E' : '#0D9488'}
                progressBackgroundColor={isDarkMode ? '#1E293B' : '#FFFFFF'}
              />
            }
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
    borderRadius: 16,
    padding: 14,
    gap: 12,
    marginHorizontal: 4,
    backgroundColor: '#FFFFFF',
    elevation: 4,
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    minHeight: 46,
  },
  filterChipLight: {
    backgroundColor: '#0D9488',
    borderWidth: 1,
    borderColor: '#0D948820',
  },
  filterChipDark: {
    backgroundColor: '#0F766E',
    borderWidth: 1,
    borderColor: '#0F766E20',
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
    color: '#0D9488',
    letterSpacing: 0.3,
    marginTop: 4,
  },
  listContainer: {
    padding: 16,
  },
  item: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    marginHorizontal: 4,
    elevation: 3,
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderLeftWidth: 4,
  },
  itemLight: {
    backgroundColor: '#FFFFFF',
    borderLeftColor: '#0D9488',
  },
  itemDark: {
    backgroundColor: '#1E293B',
    borderLeftColor: '#0F766E',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  codprod: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0D9488',
    letterSpacing: 0.5,
  },
  descricao: {
    fontSize: 15,
    marginBottom: 10,
    lineHeight: 22,
    letterSpacing: 0.3,
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
    marginTop: 4,
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
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    borderLeftWidth: 4,
    overflow: 'hidden',
  },
  menuContentLight: {
    backgroundColor: '#FFFFFF',
    borderLeftColor: '#0D9488',
  },
  menuContentDark: {
    backgroundColor: '#1E293B',
    borderLeftColor: '#0F766E',
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
    marginBottom: 20,
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
});

export default SqlScreen;