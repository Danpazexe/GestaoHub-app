import React, { useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, Alert, StyleSheet, TouchableOpacity, TextInput, Animated, ActivityIndicator, Image, Linking, Switch, Platform, ScrollView } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Camera } from 'react-native-vision-camera';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { Menu, Portal, Dialog, Button, Modal } from 'react-native-paper';
import Toast from 'react-native-toast-message';
import ScreenLayout, {
  createScreenHeaderTemplate,
  createHeaderTitleTemplate,
  createHeaderActionsTemplate,
} from '../../../shared/components/ScreenLayout';
import HeaderMenu from '../../../shared/components/HeaderMenu';
import { CORESADDPRODUCT } from '../../../shared/components/coresAuth';

const COLORS = {
  ...CORESADDPRODUCT,
  dangerLight: '#B00020',
  dangerDark: '#FF6B6B',
  successLight: '#4CAF50',
  successDark: '#6EE7B7',
  borderDark: '#3a4265',
  overlaySoft: 'rgba(10, 14, 30, 0.35)',
  overlayStrong: 'rgba(10, 14, 30, 0.55)',
  neutralDark: '#26304a',
  neutralMid: '#6f789b',
  neutralLight: '#c2c8dd',
  placeholderLight: '#7b839e',
  placeholderDark: '#9fa7c7',
  closeDanger: '#E53935',
  fieldIconLight: '#3f476e',
  fieldIconDark: '#d6dbf1',
};

const AddProductScreen = ({ navigation, route, isDarkMode }) => {
  const LOOKUP_SQL_PREF_KEY = 'addProduct_lookupFromSql';
  const [productName, setProductName] = useState('');
  const [lote, setBatch] = useState('');
  const [quantidade, setQuantity] = useState('');
  const [codprod, setcodprod] = useState('');
  const [codauxiliar, setEan] = useState('');
  const [validade, setExpirationDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [productId, setProductId] = useState(null);
  const [showErrors, setShowErrors] = useState(false);
  const [isSavePressed, setIsSavePressed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const scrollRef = useRef(null);
  const [recentProducts, setRecentProducts] = useState([]);

  const [productImage, setProductImage] = useState(null);
  const [showImageOptions, setShowImageOptions] = useState(false);
  const [isSqlLookupEnabled, setIsSqlLookupEnabled] = useState(true);
  const [isSqlLookupLoaded, setIsSqlLookupLoaded] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [historyDialogVisible, setHistoryDialogVisible] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [activeSearchField, setActiveSearchField] = useState(null); // 'productName', 'codprod', 'codauxiliar'
  const searchTimeout = useRef(null);

  useEffect(() => {
    const loadSqlLookupPreference = async () => {
      try {
        const savedValue = await AsyncStorage.getItem(LOOKUP_SQL_PREF_KEY);
        if (savedValue !== null) {
          setIsSqlLookupEnabled(savedValue === 'true');
        }
      } catch (error) {
        console.error('Erro ao carregar preferência de busca:', error);
      } finally {
        setIsSqlLookupLoaded(true);
      }
    };

    loadSqlLookupPreference();
  }, []);

  const persistSqlLookupPreference = async (nextValue) => {
    setIsSqlLookupEnabled(nextValue);
    try {
      await AsyncStorage.setItem(LOOKUP_SQL_PREF_KEY, String(nextValue));
      Toast.show({
        type: 'success',
        text1: 'Opções atualizadas',
        text2: nextValue ? 'Busca no banco ativada.' : 'Busca no banco desativada.',
        visibilityTime: 2000,
      });
    } catch (error) {
      console.error('Erro ao salvar preferência de busca:', error);
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Não foi possível salvar sua preferência.',
        visibilityTime: 2500,
      });
    }
  };

  const performSearch = async (query, field) => {
    // Atualiza o estado do campo primeiro
    if (field === 'productName') setProductName(query);
    else if (field === 'codprod') setcodprod(query.replace(/[^0-9]/g, ''));
    else if (field === 'codauxiliar') setEan(query.replace(/[^0-9]/g, ''));

    setActiveSearchField(field);

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    const cleanQuery = query.toLowerCase().trim();

    if (!cleanQuery || !isSqlLookupEnabled) {
      setSearchResults([]);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      try {
        const cachedProducts = await AsyncStorage.getItem('cached_products');
        if (cachedProducts) {
          const produtos = JSON.parse(cachedProducts);

          const filtered = produtos.filter(p => {
            const val = (key) => {
              const value = p[key.toUpperCase()] ?? p[key.toLowerCase()] ?? '';
              return String(value).toLowerCase();
            };

            const desc = val('DESCRICAO');
            const brand = val('MARCA');
            const cod = val('CODPROD');
            const ean1 = val('CODAUXILIAR');
            const ean2 = val('CODAUXILIAR2');

            // Busca em múltiplos campos independente de qual campo está digitando
            return desc.includes(cleanQuery) ||
              brand.includes(cleanQuery) ||
              cod.includes(cleanQuery) ||
              ean1.includes(cleanQuery) ||
              ean2.includes(cleanQuery);
          }).slice(0, 15); // Aumentado para 15 resultados

          setSearchResults(filtered);
        }
      } catch (error) {
        console.error('Erro ao pesquisar:', error);
      }
    }, 350);
  };

  const handleSelectProduct = (product) => {
    const val = (key) => product[key.toUpperCase()] ?? product[key.toLowerCase()] ?? '';

    setProductName(String(val('DESCRICAO')));
    setcodprod(String(val('CODPROD')));
    setEan(String(val('CODAUXILIAR') || val('CODAUXILIAR2')));
    setSearchResults([]);
    setActiveSearchField(null);

    Toast.show({
      type: 'success',
      text1: 'Produto Selecionado',
      text2: 'Dados preenchidos automaticamente',
      visibilityTime: 1500,
    });
  };

  const handleBarcodeScan = async (scannedEan) => {
    try {
      if (!isSqlLookupEnabled) return;

      const formattedScannedEan = String(scannedEan).trim();
      const cachedProducts = await AsyncStorage.getItem('cached_products');

      if (cachedProducts) {
        const produtos = JSON.parse(cachedProducts);
        const normalize = (value) => String(value ?? '').trim();
        const product = produtos.find((p) => {
          const ean1 = normalize(p.CODAUXILIAR || p.codauxiliar);
          const ean2 = normalize(p.CODAUXILIAR2 || p.codauxiliar2);
          return ean1 === formattedScannedEan || ean2 === formattedScannedEan;
        });

        if (product) {
          handleSelectProduct(product);
          // Toast já disparado no handleSelectProduct
        } else {
          Toast.show({
            type: 'error',
            text1: 'Produto não encontrado',
            text2: 'Não foi possível encontrar o produto com o EAN fornecido.',
            visibilityTime: 3000,
          });
        }
      }
    } catch (error) {
      console.error('Erro ao buscar produto:', error);
    }
  };

  const loadRecentProducts = async () => {
    const existingProducts = await AsyncStorage.getItem('products');
    let products = existingProducts ? JSON.parse(existingProducts) : [];
    setRecentProducts(products.slice(-5));
  };



  useEffect(() => {
    if (!route.params?.product) return;

    const { id, descricao, lote, quantidade, codprod, codauxiliar, validade, imageUrl, foto } = route.params.product;
    setProductId(id);
    setProductName(descricao);
    setBatch(lote);
    setQuantity(quantidade.toString());
    setcodprod(String(codprod));
    setEan(String(codauxiliar));
    setExpirationDate(new Date(validade));
    setProductImage(imageUrl || foto || null);
    setIsEditing(true);
  }, [route.params?.product]);

  useEffect(() => {
    if (!route.params?.barcodeData) return;

    setEan(route.params.barcodeData);
    if (!isSqlLookupLoaded) return;
    if (!isSqlLookupEnabled) return;

    handleBarcodeScan(route.params.barcodeData);
  }, [route.params?.barcodeData, isSqlLookupLoaded, isSqlLookupEnabled]);

  useEffect(() => {
    navigation.setOptions({
      ...createScreenHeaderTemplate({
        isDarkMode,
        lightHeaderColor: COLORS.primary,
        darkHeaderColor: COLORS.primary,
        tintColor: COLORS.white,
        titleSize: 20,
        titleWeight: '600',
        titleLetterSpacing: 0.5,
      }),
      headerTitle: () =>
        createHeaderTitleTemplate({
          title: isEditing ? 'Editar Produto' : 'Cadastrar Produto',
          iconName: isEditing ? 'edit' : 'add-circle-outline',
          tintColor: COLORS.white,
        }),
      headerRight: () => (
        <View style={{ flexDirection: 'row', marginRight: 8 }}>
          <HeaderMenu
            visible={menuVisible}
            onOpen={() => setMenuVisible(true)}
            onDismiss={() => setMenuVisible(false)}
            items={[
              {
                key: 'history',
                title: 'Produtos Recentes',
                icon: 'history',
                onPress: () => {
                  loadRecentProducts();
                  setHistoryDialogVisible(true);
                }
              },
              {
                key: 'lookup',
                title: isSqlLookupEnabled ? "Busca no Banco: Ativada" : "Busca no Banco: Desativada",
                icon: isSqlLookupEnabled ? "database-search" : "database-search-outline",
                onPress: () => persistSqlLookupPreference(!isSqlLookupEnabled)
              }
            ]}
          />
        </View>
      ),
    });
  }, [navigation, isDarkMode, isEditing, historyDialogVisible, isSqlLookupEnabled, menuVisible]);





  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    if (!showDatePicker) return;

    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, [showDatePicker]);

  const handleSaveProduct = async () => {
    setIsSaving(true);
    setShowErrors(true);

    const hasEmptyFields = ['productName', 'lote', 'quantidade', 'codprod', 'codauxiliar', 'validade'].some(field =>
      checkEmptyFields(field)
    );

    if (hasEmptyFields) {
      Toast.show({
        type: 'error',
        text1: 'Campos Obrigatórios',
        text2: 'Por favor, preencha todos os campos obrigatórios.',
        visibilityTime: 3000,
      });
      setIsSaving(false);
      return;
    }

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      validade.setHours(0, 0, 0, 0);

      const timeDiff = validade - today;
      const diasrestantes = Math.ceil(timeDiff / (1000 * 3600 * 24));

      const product = {
        id: productId || Date.now().toString(),
        codprod,
        descricao: productName,
        codauxiliar,
        lote,
        validade: validade.toISOString(),
        quantidade: parseInt(quantidade, 10),
        diasrestantes,
        imageUrl: productImage,
      };

      const existingProducts = await AsyncStorage.getItem('products');
      let products = existingProducts ? JSON.parse(existingProducts) : [];

      if (isEditing) {
        products = products.map((p) => (p.id === productId ? product : p));
      } else {
        products.push(product);
      }

      await AsyncStorage.setItem('products', JSON.stringify(products));

      Toast.show({
        type: 'success',
        text1: 'Sucesso',
        text2: isEditing ? 'Produto atualizado com sucesso!' : 'Produto salvo com sucesso!',
        visibilityTime: 2000,
      });
      navigation.navigate('HomeScreen');
    } catch (error) {
      console.error("Erro ao salvar produto:", error);
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Erro ao salvar produto',
        visibilityTime: 3000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const result = await launchCamera({
        mediaType: 'photo',
        quality: 0.8,
        saveToPhotos: true,
      });
      if (!result.didCancel && result.assets?.[0]) {
        setProductImage(result.assets[0].uri);
        setShowImageOptions(false);
      }
    } catch (error) {
      console.error('Erro ao tirar foto:', error);
    }
  };

  const handleChooseFromGallery = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
      });
      if (!result.didCancel && result.assets?.[0]) {
        setProductImage(result.assets[0].uri);
        setShowImageOptions(false);
      }
    } catch (error) {
      console.error('Erro ao escolher da galeria:', error);
    }
  };

  const handleScanBarcode = async () => {
    try {
      const currentStatus = Camera.getCameraPermissionStatus();
      if (currentStatus === 'granted' || currentStatus === true) {
        navigation.navigate('BarcodeScannerScreen');
        return;
      }
      const requestStatus = await Camera.requestCameraPermission();
      if (requestStatus === true || requestStatus === 'authorized' || requestStatus === 'granted') {
        navigation.navigate('BarcodeScannerScreen');
      } else {
        Alert.alert('Câmera', 'Habilite o acesso à câmera nas configurações.', [{ text: 'OK' }]);
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Erro', text2: 'Scanner não iniciou.' });
    }
  };

  const toggleDatePicker = () => {
    setHistoryDialogVisible(false);
    setMenuVisible(false);
    setShowImageOptions(false);
    setShowDatePicker((prev) => !prev);
  };

  const onChangeDate = (event, selectedDate) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selectedDate) setExpirationDate(selectedDate);
  };

  const checkEmptyFields = (field) => {
    switch (field) {
      case 'productName': return !productName.trim();
      case 'lote': return !lote.trim();
      case 'quantidade': return !quantidade.trim();
      case 'codprod': return !codprod.trim();
      case 'codauxiliar': return !codauxiliar.trim();
      case 'validade': return !validade || validade.toString() === 'Invalid Date';
      default: return false;
    }
  };

  const renderFieldStatus = (field) => {
    if (!showErrors) return null;
    const color = isDarkMode ? COLORS.dangerDark : COLORS.dangerLight;
    const successColor = isDarkMode ? COLORS.successDark : COLORS.successLight;
    if (checkEmptyFields(field)) return <MaterialIcons name="error-outline" size={24} color={color} style={styles.fieldIcon} />;
    return <MaterialIcons name="check-circle" size={24} color={successColor} style={styles.fieldIcon} />;
  };

  // Renderizador da Lista de Sugestões
  const renderSuggestions = (field) => {
    if (searchResults.length === 0 || activeSearchField !== field) return null;

    return (
      <View style={styles.suggestionsContainer}>
        <ScrollView
          style={{ maxHeight: 250 }}
          nestedScrollEnabled={true}
          keyboardShouldPersistTaps="handled"
        >
          {searchResults.map((item, index) => {
            const d = item.DESCRICAO || item.descricao || '';
            const m = item.MARCA || item.marca || '';
            const c = item.CODPROD || item.codprod || '';
            const e = item.CODAUXILIAR || item.codauxiliar || '';
            return (
              <TouchableOpacity
                key={index}
                style={styles.suggestionItem}
                onPress={() => handleSelectProduct(item)}
              >
                <View style={styles.suggestionIcon}>
                  <MaterialCommunityIcons name="package-variant-closed" size={20} color={isDarkMode ? COLORS.neutralLight : COLORS.accent} />
                </View>
                <View style={styles.suggestionTextContainer}>
                  <Text style={styles.suggestionTitle} numberOfLines={1}>{d}</Text>
                  <Text style={styles.suggestionSubtitle}>
                    {m ? `${m} | ` : ''}Cód: {c} | EAN: {e}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const styles = StyleSheet.create({
    container: { flex: 1, padding: 12 },
    formCard: {
      flex: 1, padding: 16, borderRadius: 12, backgroundColor: isDarkMode ? COLORS.cardDark : COLORS.card,
      elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84,
    },
    scrollView: { flex: 1 },
    scrollViewContent: { flexGrow: 1, paddingBottom: 20 },
    fieldContainer: { marginBottom: 12, position: 'relative' },
    rowContainer: { flexDirection: 'row', justifyContent: 'space-between' },
    label: { fontSize: 14, fontWeight: '600', marginBottom: 4, color: isDarkMode ? COLORS.white : COLORS.text },
    inputContainer: {
      flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, borderColor: isDarkMode ? COLORS.borderDark : COLORS.border,
      backgroundColor: isDarkMode ? COLORS.inputDark : COLORS.card, padding: 4, elevation: 1,
    },
    input: { flex: 1, height: 40, paddingHorizontal: 12, fontSize: 14, color: isDarkMode ? COLORS.white : COLORS.text },
    eanContainer: { flexDirection: 'row', alignItems: 'center' },
    scanButton: { width: 40, height: 40, backgroundColor: isDarkMode ? COLORS.secondary : COLORS.accent, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    dateButton: { height: 40, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderRadius: 8 },
    dateText: { marginLeft: 8, fontSize: 14 },
    saveButton: { flexDirection: 'row', backgroundColor: isDarkMode ? COLORS.secondary : COLORS.accent, height: 48, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 12, elevation: 5 },
    saveButtonText: { color: COLORS.white, fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
    fieldIcon: { marginRight: 12, marginLeft: 4 },
    requiredText: { fontSize: 12, marginTop: 4, color: isDarkMode ? COLORS.dangerDark : COLORS.dangerLight },
    emptyField: { borderColor: isDarkMode ? COLORS.dangerDark : COLORS.dangerLight, borderWidth: 2, backgroundColor: isDarkMode ? '#3a2733' : '#FFF5F7' },
    suggestionsContainer: {
      backgroundColor: isDarkMode ? '#1e2540' : '#ffffff', borderRadius: 8, borderWidth: 1,
      borderColor: isDarkMode ? COLORS.borderDark : 'rgba(60, 68, 108, 0.2)', marginTop: 2,
      elevation: 10, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5, shadowOffset: { width: 0, height: 4 },
      zIndex: 9999, overflow: 'hidden'
    },
    suggestionItem: {
      flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
    },
    suggestionIcon: { marginRight: 10 },
    suggestionTextContainer: { flex: 1 },
    suggestionTitle: { fontSize: 14, fontWeight: '600', color: isDarkMode ? COLORS.white : COLORS.text },
    suggestionSubtitle: { fontSize: 12, color: isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', marginTop: 2 },
    photoContainer: { alignItems: 'center', marginTop: 8 },
    photoPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: isDarkMode ? COLORS.neutralDark : '#edf0fa', borderWidth: 2, borderColor: isDarkMode ? COLORS.neutralMid : COLORS.neutralLight, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    photoPlaceholderText: { fontSize: 11, marginTop: 4, textAlign: 'center' },
    photoPreview: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: isDarkMode ? COLORS.neutralMid : COLORS.neutralLight },
    removePhotoButton: { position: 'absolute', top: -5, right: -5, backgroundColor: COLORS.closeDanger, borderRadius: 15, width: 26, height: 26, justifyContent: 'center', alignItems: 'center' },
    retakePhotoButton: { flexDirection: 'row', backgroundColor: isDarkMode ? COLORS.secondary : COLORS.accent, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15 },
    retakePhotoText: { color: COLORS.white, fontSize: 12, fontWeight: '600', marginLeft: 4 },

    historyItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: isDarkMode ? COLORS.borderDark : 'rgba(60, 68, 108, 0.15)' },
    historyText: { marginLeft: 12, fontSize: 16 },
    darkText: { color: COLORS.fieldIconDark },
    lightText: { color: COLORS.text },
    bottomSheet: {
      backgroundColor: isDarkMode ? COLORS.cardDark : COLORS.card,
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    },
    sheetTitle: { fontSize: 20, fontWeight: 'bold', color: isDarkMode ? COLORS.white : COLORS.text, marginBottom: 8, textAlign: 'center' },
    sheetSubtitle: { fontSize: 14, color: isDarkMode ? COLORS.placeholderDark : COLORS.placeholderLight, marginBottom: 24, textAlign: 'center' },
    sheetButton: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: isDarkMode ? COLORS.neutralDark : '#f0f3ff',
      padding: 16, borderRadius: 12, marginBottom: 12,
    },
    sheetButtonText: { fontSize: 16, fontWeight: '600', color: isDarkMode ? COLORS.white : COLORS.text, marginLeft: 16 },
    sheetIconContainer: {
      width: 44, height: 44, borderRadius: 22, backgroundColor: isDarkMode ? COLORS.secondary : COLORS.accent,
      justifyContent: 'center', alignItems: 'center',
    },
  });

  return (
    <ScreenLayout isDarkMode={isDarkMode} lightBackground={COLORS.background} darkBackground={COLORS.darkBackground} contentStyle={styles.container}>
      <View style={styles.formCard}>
        <ScrollView ref={scrollRef} style={styles.scrollView} contentContainerStyle={styles.scrollViewContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Foto */}
          <View style={styles.fieldContainer}>
            <Text style={[styles.label, isDarkMode ? styles.darkText : styles.lightText]}>
              <MaterialCommunityIcons name="camera" size={18} color={isDarkMode ? COLORS.fieldIconDark : COLORS.fieldIconLight} /> Foto
            </Text>
            <View style={styles.photoContainer}>
              {productImage ? (
                <View style={{ position: 'relative', marginBottom: 10 }}>
                  <Image source={{ uri: productImage }} style={styles.photoPreview} />
                  <TouchableOpacity style={styles.removePhotoButton} onPress={() => setProductImage(null)}>
                    <MaterialIcons name="close" size={18} color="#FFF" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.photoPlaceholder} onPress={() => setShowImageOptions(true)}>
                  <MaterialCommunityIcons name="camera-plus" size={40} color={isDarkMode ? COLORS.neutralMid : COLORS.neutralLight} />
                  <Text style={[styles.photoPlaceholderText, isDarkMode ? styles.darkText : styles.lightText]}>Foto</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Nome do Produto */}
          <View style={styles.fieldContainer}>
            <Text style={[styles.label, isDarkMode ? styles.darkText : styles.lightText]}>
              <MaterialCommunityIcons name="package-variant" size={18} color={isDarkMode ? COLORS.fieldIconDark : COLORS.fieldIconLight} /> Nome do Produto
            </Text>
            <View style={[styles.inputContainer, showErrors && checkEmptyFields('productName') && styles.emptyField]}>
              <TextInput placeholder="Ex: Sabão em Pó" value={productName} onChangeText={(t) => performSearch(t, 'productName')} style={styles.input} placeholderTextColor={isDarkMode ? COLORS.placeholderDark : COLORS.placeholderLight} />
              {renderFieldStatus('productName')}
            </View>
            {renderSuggestions('productName')}
          </View>

          {/* Lote e Qtd */}
          <View style={styles.rowContainer}>
            <View style={[styles.fieldContainer, { flex: 1, marginRight: 10 }]}>
              <Text style={[styles.label, isDarkMode ? styles.darkText : styles.lightText]}>Lote</Text>
              <View style={[styles.inputContainer, showErrors && checkEmptyFields('lote') && styles.emptyField]}>
                <TextInput placeholder="Ex: 123" value={lote} onChangeText={setBatch} style={styles.input} placeholderTextColor={isDarkMode ? COLORS.placeholderDark : COLORS.placeholderLight} />
              </View>
            </View>
            <View style={[styles.fieldContainer, { flex: 1 }]}>
              <Text style={[styles.label, isDarkMode ? styles.darkText : styles.lightText]}>Qtd</Text>
              <View style={[styles.inputContainer, showErrors && checkEmptyFields('quantidade') && styles.emptyField]}>
                <TextInput placeholder="Ex: 10" value={quantidade} onChangeText={t => setQuantity(t.replace(/[^0-9]/g, ''))} keyboardType="numeric" style={styles.input} placeholderTextColor={isDarkMode ? COLORS.placeholderDark : COLORS.placeholderLight} />
              </View>
            </View>
          </View>

          {/* Código Interno */}
          <View style={styles.fieldContainer}>
            <Text style={[styles.label, isDarkMode ? styles.darkText : styles.lightText]}>
              <MaterialCommunityIcons name="identifier" size={18} color={isDarkMode ? COLORS.fieldIconDark : COLORS.fieldIconLight} /> Código Interno
            </Text>
            <View style={[styles.inputContainer, showErrors && checkEmptyFields('codprod') && styles.emptyField]}>
              <TextInput placeholder="Ex: 1001" value={codprod} onChangeText={(t) => performSearch(t, 'codprod')} keyboardType="numeric" style={styles.input} placeholderTextColor={isDarkMode ? COLORS.placeholderDark : COLORS.placeholderLight} />
              {renderFieldStatus('codprod')}
            </View>
            {renderSuggestions('codprod')}
          </View>

          {/* EAN */}
          <View style={styles.fieldContainer}>
            <Text style={[styles.label, isDarkMode ? styles.darkText : styles.lightText]}>
              <MaterialCommunityIcons name="barcode" size={18} color={isDarkMode ? COLORS.fieldIconDark : COLORS.fieldIconLight} /> EAN
            </Text>
            <View style={styles.eanContainer}>
              <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }, showErrors && checkEmptyFields('codauxiliar') && styles.emptyField]}>
                <TextInput placeholder="Ex: 789..." value={codauxiliar} onChangeText={(t) => performSearch(t, 'codauxiliar')} keyboardType="numeric" style={styles.input} placeholderTextColor={isDarkMode ? COLORS.placeholderDark : COLORS.placeholderLight} />
                {renderFieldStatus('codauxiliar')}
              </View>
              <TouchableOpacity style={styles.scanButton} onPress={handleScanBarcode}>
                <MaterialCommunityIcons name="barcode-scan" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            {renderSuggestions('codauxiliar')}
          </View>

          {/* Data */}
          <View style={styles.fieldContainer}>
            <Text style={[styles.label, isDarkMode ? styles.darkText : styles.lightText]}>Validade</Text>
            <TouchableOpacity style={styles.inputContainer} onPress={toggleDatePicker}>
              <Text style={[styles.input, { paddingVertical: 10 }]}>{validade.toLocaleDateString('pt-BR')}</Text>
            </TouchableOpacity>
          </View>
          {showDatePicker && (
            <DateTimePicker value={validade} mode="date" display="spinner" onChange={onChangeDate} minimumDate={new Date()} locale="pt-BR" />
          )}

          <TouchableOpacity style={styles.saveButton} onPress={handleSaveProduct} disabled={isSaving}>
            {isSaving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>{isEditing ? 'Atualizar' : 'Salvar'}</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>



      {/* Modal de Seleção de Imagem (Bottom Sheet Style) */}
      <Portal>
        <Modal
          visible={showImageOptions}
          onDismiss={() => setShowImageOptions(false)}
          contentContainerStyle={[styles.bottomSheet, { position: 'absolute', bottom: 0, left: 0, right: 0 }]}
        >
          <Text style={styles.sheetTitle}>Foto do Produto</Text>
          <Text style={styles.sheetSubtitle}>Como deseja adicionar a imagem?</Text>

          <TouchableOpacity style={styles.sheetButton} onPress={handleTakePhoto}>
            <View style={styles.sheetIconContainer}>
              <MaterialCommunityIcons name="camera" size={24} color="#FFF" />
            </View>
            <Text style={styles.sheetButtonText}>Tirar nova foto agora</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sheetButton} onPress={handleChooseFromGallery}>
            <View style={styles.sheetIconContainer}>
              <MaterialCommunityIcons name="image-multiple" size={24} color="#FFF" />
            </View>
            <Text style={styles.sheetButtonText}>Escolher da galeria</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sheetButton, { backgroundColor: 'transparent', marginTop: 8, borderWidth: 1, borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}
            onPress={() => setShowImageOptions(false)}
          >
            <Text style={[styles.sheetButtonText, { marginLeft: 0, width: '100%', textAlign: 'center', color: isDarkMode ? COLORS.dangerDark : COLORS.dangerLight }]}>
              Cancelar
            </Text>
          </TouchableOpacity>
        </Modal>
      </Portal>

      <Portal>
        <Dialog visible={historyDialogVisible} onDismiss={() => setHistoryDialogVisible(false)} style={{ backgroundColor: isDarkMode ? COLORS.cardDark : COLORS.card }}>
          <Dialog.Title>Produtos Recentes</Dialog.Title>
          <Dialog.Content>
            {recentProducts.map((p, i) => (
              <TouchableOpacity key={i} style={styles.historyItem} onPress={() => { handleSelectProduct(p); setHistoryDialogVisible(false); }}>
                <Text style={[styles.historyText, isDarkMode ? styles.darkText : styles.lightText]}>{p.descricao}</Text>
              </TouchableOpacity>
            ))}
          </Dialog.Content>
        </Dialog>
      </Portal>
    </ScreenLayout>
  );
};

export default AddProductScreen;
