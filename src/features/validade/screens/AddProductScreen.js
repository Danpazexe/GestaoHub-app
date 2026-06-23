import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Alert, StyleSheet, TouchableOpacity, TextInput, Animated, ActivityIndicator, Image, Linking, Switch, Platform, ScrollView, PermissionsAndroid } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Camera } from 'react-native-vision-camera';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { Portal, Dialog, Modal } from 'react-native-paper';
import Toast from 'react-native-toast-message';
import ScreenLayout, {
  createScreenHeaderTemplate,
  createHeaderTitleTemplate,
} from '../../../components/ScreenLayout';
import HeaderMenu from '../../../components/HeaderMenu';
import { isLocalImageUri, persistImageToAppStorage } from '../../../services/localImageService';
import { buildLookupSelection, findCachedProductByEan, searchCachedProducts } from '../../../services/productLookupService';
import {
  readValidadeProductsCache,
  writeValidadeProductsCache,
} from '../storage/validadeProductsStorage';
import { getCurrentUserId, upsertValidadeProduct } from '../../../services/validadeSupabaseService';
import { getSignedProductImageUrl, uploadProductImageToSupabase } from '../../../services/supabaseStorageService';
import { addProductTheme } from '../../../theme/domains/validade';
import haptics from '../../../utils/haptics';
import { useLookupSqlPreference } from '../hooks/useLookupSqlPreference';
import useLogisticsLocationConfig from '../../settings/hooks/useLogisticsLocationConfig';
import {
  createEmptyLogisticsLocationState,
  getEnabledLogisticsLocationFields,
  hydrateLogisticsLocation,
  sanitizeLogisticsLocation,
} from '../constants/logisticsLocation';

const COLORS = addProductTheme;
// Plano FREE: imagens leves (Storage limitado). 0.3 + 900px mantém data/lote legível (~50-120KB).
const IMAGE_UPLOAD_QUALITY = 0.3;
const IMAGE_UPLOAD_MAX_WIDTH = 900;
const IMAGE_UPLOAD_MAX_HEIGHT = 900;

const AddProductScreen = ({ navigation, route, isDarkMode }) => {
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
  const [locationForm, setLocationForm] = useState(createEmptyLogisticsLocationState);

  const scrollRef = useRef(null);
  const [recentProducts, setRecentProducts] = useState([]);

  const [productImage, setProductImage] = useState(null);
  const [productImagePath, setProductImagePath] = useState(null);
  const [showImageOptions, setShowImageOptions] = useState(false);
  const {
    isSqlLookupEnabled,
    isSqlLookupLoaded,
    persistSqlLookupPreference,
  } = useLookupSqlPreference();
  const [menuVisible, setMenuVisible] = useState(false);
  const [historyDialogVisible, setHistoryDialogVisible] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [activeSearchField, setActiveSearchField] = useState(null); // 'productName', 'codprod', 'codauxiliar'
  const searchTimeout = useRef(null);
  const {
    config: logisticsLocationConfig,
    isLoaded: isLogisticsLocationConfigLoaded,
  } = useLogisticsLocationConfig();
  const visibleLocationFields = getEnabledLogisticsLocationFields(logisticsLocationConfig);

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
        const filtered = await searchCachedProducts(cleanQuery, 15);
        setSearchResults(filtered);
      } catch (error) {
        console.error('Erro ao pesquisar:', error);
      }
    }, 350);
  };

  const handleSelectProduct = (product) => {
    const selection = buildLookupSelection(product);
    setProductName(selection.descricao);
    setcodprod(selection.codprod);
    setEan(selection.codauxiliar);
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

      const product = await findCachedProductByEan(scannedEan);

      if (product) {
        handleSelectProduct(product);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Produto não encontrado',
          text2: 'Não foi possível encontrar o produto com o EAN fornecido.',
          visibilityTime: 3000,
        });
      }
    } catch (error) {
      console.error('Erro ao buscar produto:', error);
    }
  };

  const loadRecentProducts = async () => {
    const products = await readValidadeProductsCache();
    const recent = products.slice(-5);
    const resolvedRecent = await Promise.all(recent.map(async (item) => {
      const imageUrl = await resolveProductImageUrl(item);
      return {
        ...item,
        previewImageUrl: imageUrl,
      };
    }));
    setRecentProducts(resolvedRecent);
  };



  useEffect(() => {
    if (route.params?.product) return;
    if (route.params?.screenMode !== 'create') return;

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    setProductName('');
    setBatch('');
    setQuantity('');
    setcodprod('');
    setEan('');
    setExpirationDate(new Date());
    setShowDatePicker(false);
    setIsEditing(false);
    setProductId(null);
    setShowErrors(false);
    setIsSavePressed(false);
    setIsSaving(false);
    setLocationForm(createEmptyLogisticsLocationState());
    setRecentProducts([]);
    setProductImage(null);
    setProductImagePath(null);
    setShowImageOptions(false);
    setMenuVisible(false);
    setHistoryDialogVisible(false);
    setSearchResults([]);
    setActiveSearchField(null);
  }, [route.params?.product, route.params?.resetFormToken, route.params?.screenMode]);

  useEffect(() => {
    if (!route.params?.product) return;

    const { id, descricao, lote, quantidade, codprod, codauxiliar, validade, imageUrl, imagePath, foto, location } = route.params.product;
    setProductId(id);
    setProductName(descricao);
    setBatch(lote);
    setQuantity(quantidade.toString());
    setcodprod(String(codprod));
    setEan(String(codauxiliar));
    setExpirationDate(new Date(validade));
    setProductImage(imageUrl || foto || null);
    setProductImagePath(imagePath || null);
    setLocationForm(hydrateLogisticsLocation(location));
    setShowErrors(false);
    setSearchResults([]);
    setActiveSearchField(null);
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

    if (!isLogisticsLocationConfigLoaded) {
      Toast.show({
        type: 'info',
        text1: 'Carregando configurações',
        text2: 'Aguarde a configuração logística ser carregada.',
        visibilityTime: 2500,
      });
      setIsSaving(false);
      return;
    }

    const hasEmptyFields = ['productName', 'lote', 'quantidade', 'codprod', 'codauxiliar', 'validade'].some(field =>
      checkEmptyFields(field)
    );
    const sanitizedLocation = sanitizeLogisticsLocation(locationForm);
    const hasMissingLocationFields = visibleLocationFields.some((field) => (
      Boolean(logisticsLocationConfig?.[field.key]?.required)
      && !sanitizedLocation[field.key]
    ));

    if (hasEmptyFields || hasMissingLocationFields) {
      haptics.error();
      Toast.show({
        type: 'error',
        text1: 'Campos Obrigatórios',
        text2: 'Preencha os campos destacados em vermelho.',
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
        imagePath: productImagePath,
        location: sanitizedLocation,
      };

      let productToPersist = product;
      try {
        let imagePath = product.imagePath || null;
        if (isLocalImageUri(product.imageUrl)) {
          const userId = await getCurrentUserId();
          imagePath = await uploadProductImageToSupabase({
            userId,
            productId: String(product.id),
            localUri: product.imageUrl,
          });
        }

        const remoteProduct = await upsertValidadeProduct({
          ...product,
          imagePath,
        });
        const remoteImagePath = remoteProduct?.image_path || imagePath || null;
        const signedImageUrl = remoteImagePath ? await getSignedProductImageUrl(remoteImagePath) : null;

        productToPersist = {
          ...product,
          imageUrl: signedImageUrl || product.imageUrl || null,
          imagePath: remoteImagePath,
        };
      } catch (syncError) {
        console.warn('Falha ao sincronizar no Supabase. Mantendo dados locais.', syncError?.message || syncError);
      }

      let products = await readValidadeProductsCache();

      if (isEditing) {
        products = products.map((p) => (p.id === productId ? productToPersist : p));
      } else {
        products.push(productToPersist);
      }

      await writeValidadeProductsCache(products);

      haptics.success();
      Toast.show({
        type: 'success',
        text1: 'Sucesso',
        text2: isEditing ? 'Produto atualizado com sucesso!' : 'Produto salvo com sucesso!',
        visibilityTime: 2000,
      });
      navigation.navigate('ListScreen');
    } catch (error) {
      console.error("Erro ao salvar produto:", error);
      haptics.error();
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
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Permissão da Câmera',
            message: 'Precisamos da câmera para tirar a foto do produto.',
            buttonPositive: 'Permitir',
            buttonNegative: 'Negar',
          }
        );

        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
            Alert.alert(
              'Permissão bloqueada',
              'Ative a câmera nas configurações do app para tirar fotos.',
              [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Abrir configurações', onPress: () => Linking.openSettings() },
              ]
            );
            return;
          }
          Toast.show({
            type: 'error',
            text1: 'Permissão negada',
            text2: 'Ative a câmera nas configurações para tirar foto.',
            visibilityTime: 2800,
          });
          return;
        }
      }

      const result = await launchCamera({
        mediaType: 'photo',
        quality: IMAGE_UPLOAD_QUALITY,
        maxWidth: IMAGE_UPLOAD_MAX_WIDTH,
        maxHeight: IMAGE_UPLOAD_MAX_HEIGHT,
        assetRepresentationMode: 'compatible',
        saveToPhotos: true,
      });

      if (result?.errorCode) {
        console.error('Erro ao abrir câmera:', result?.errorCode, result?.errorMessage);
        Toast.show({
          type: 'error',
          text1: 'Falha ao abrir câmera',
          text2: result?.errorMessage || 'Tente novamente.',
          visibilityTime: 3000,
        });
        return;
      }

      if (result?.didCancel) {
        return;
      }

      if (!result.didCancel && result.assets?.[0]) {
        const persistedImageUri = await persistImageToAppStorage(result.assets[0].uri);
        setProductImage(persistedImageUri);
        setProductImagePath(null);
        setShowImageOptions(false);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Imagem não capturada',
          text2: 'Não foi possível obter a foto da câmera.',
          visibilityTime: 2500,
        });
      }
    } catch (error) {
      console.error('Erro ao tirar foto:', error);
      Toast.show({
        type: 'error',
        text1: 'Erro na câmera',
        text2: 'Não foi possível abrir a câmera agora.',
        visibilityTime: 3000,
      });
    }
  };

  const handleChooseFromGallery = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: IMAGE_UPLOAD_QUALITY,
        maxWidth: IMAGE_UPLOAD_MAX_WIDTH,
        maxHeight: IMAGE_UPLOAD_MAX_HEIGHT,
        assetRepresentationMode: 'compatible',
      });
      if (!result.didCancel && result.assets?.[0]) {
        const persistedImageUri = await persistImageToAppStorage(result.assets[0].uri);
        setProductImage(persistedImageUri);
        setProductImagePath(null);
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

  const isLocationFieldRequired = (fieldKey) => (
    Boolean(logisticsLocationConfig?.[fieldKey]?.enabled && logisticsLocationConfig?.[fieldKey]?.required)
  );

  const isLocationFieldEmpty = (fieldKey) => !String(locationForm?.[fieldKey] ?? '').trim();

  const updateLocationField = (fieldKey, value) => {
    setLocationForm((previousForm) => ({
      ...previousForm,
      [fieldKey]: value,
    }));
  };

  const renderLocationField = (field, { isCompact = false } = {}) => {
    const isObservationField = field.key === 'observacao';
    const isRequired = isLocationFieldRequired(field.key);
    const hasError = showErrors && isRequired && isLocationFieldEmpty(field.key);

    return (
      <View
        key={field.key}
        style={[
          styles.fieldContainer,
          isCompact && styles.locationGridItem,
        ]}
      >
        <Text style={[styles.label, isDarkMode ? styles.darkText : styles.lightText]}>
          {field.label}{isRequired ? ' *' : ''}
        </Text>
        <View
          style={[
            styles.inputContainer,
            isObservationField && styles.multilineInputContainer,
            hasError && styles.emptyField,
          ]}
        >
          <TextInput
            placeholder={field.placeholder}
            value={locationForm[field.key]}
            onChangeText={(value) => updateLocationField(field.key, value)}
            style={[styles.input, isObservationField && styles.multilineInput]}
            placeholderTextColor={isDarkMode ? COLORS.placeholderDark : COLORS.placeholderLight}
            multiline={isObservationField}
            textAlignVertical={isObservationField ? 'top' : 'center'}
          />
        </View>
        {hasError ? (
          <Text style={styles.requiredText}>Campo obrigatório.</Text>
        ) : null}
      </View>
    );
  };

  const handleSelectRecentProduct = async (product) => {
    haptics.selection();
    setProductName(String(product?.descricao ?? ''));
    setBatch(String(product?.lote ?? ''));
    setQuantity(String(product?.quantidade ?? ''));
    setcodprod(String(product?.codprod ?? ''));
    setEan(String(product?.codauxiliar ?? ''));
    if (product?.validade) {
      const parsedDate = new Date(product.validade);
      if (!Number.isNaN(parsedDate.getTime())) {
        setExpirationDate(parsedDate);
      }
    }
    const resolvedImage = product?.previewImageUrl || await resolveProductImageUrl(product);
    setProductImage(resolvedImage || null);
    setProductImagePath(product?.imagePath || null);
    setLocationForm(hydrateLogisticsLocation(product?.location));
    setHistoryDialogVisible(false);
    setSearchResults([]);
    setActiveSearchField(null);
  };

  const resolveProductImageUrl = async (product) => {
    const raw = product?.imageUrl || product?.imagePath || product?.foto || '';
    if (!raw) return null;

    const value = String(raw);
    const isHttp = value.startsWith('http://') || value.startsWith('https://');
    const isLocal = value.startsWith('file://') || value.startsWith('content://') || value.startsWith('/');
    if (isHttp || isLocal) return value;

    try {
      return await getSignedProductImageUrl(value, 86400);
    } catch (error) {
      return null;
    }
  };

  const formatDateLabel = (dateValue) => {
    if (!dateValue) return 'Nao informada';
    const parsedDate = new Date(dateValue);
    if (Number.isNaN(parsedDate.getTime())) return 'Nao informada';
    return parsedDate.toLocaleDateString('pt-BR');
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

  const concentratedShadow = Platform.select({
    ios: {
      shadowColor: COLORS.shadowStrong,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.54,
      shadowRadius: 2,
    },
    android: {
      elevation: 3,
    },
    default: {},
  });

  const subtleConcentratedShadow = Platform.select({
    ios: {
      shadowColor: COLORS.shadowSoft,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.42,
      shadowRadius: 2,
    },
    android: {
      elevation: 2,
    },
    default: {},
  });

  const compactLocationFields = visibleLocationFields.filter((field) => field.key !== 'observacao');
  const observationLocationField = visibleLocationFields.find((field) => field.key === 'observacao');
  const locationFieldRows = compactLocationFields.reduce((rows, field, index) => {
    if (index % 2 === 0) {
      rows.push([field]);
      return rows;
    }

    rows[rows.length - 1].push(field);
    return rows;
  }, []);
  const styles = createStyles(isDarkMode, concentratedShadow, subtleConcentratedShadow);

  return (
    <ScreenLayout isDarkMode={isDarkMode} lightBackground={COLORS.background} darkBackground={COLORS.darkBackground} contentStyle={styles.container}>
      <View style={styles.formCard}>
        <ScrollView ref={scrollRef} style={styles.scrollView} contentContainerStyle={styles.scrollViewContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}>

          {/* Foto */}
          <View style={styles.fieldContainer}>
            <Text style={[styles.label, isDarkMode ? styles.darkText : styles.lightText]}>
              <MaterialCommunityIcons name="camera" size={18} color={isDarkMode ? COLORS.fieldIconDark : COLORS.fieldIconLight} /> Foto
            </Text>
            <View style={styles.photoContainer}>
              {productImage ? (
                <View style={{ position: 'relative', marginBottom: 10 }}>
                  <Image source={{ uri: productImage }} style={styles.photoPreview} />
                  <TouchableOpacity
                    style={styles.removePhotoButton}
                    accessibilityRole="button"
                    accessibilityLabel="Remover foto"
                    onPress={() => {
                      setProductImage(null);
                      setProductImagePath(null);
                    }}
                  >
                    <MaterialIcons name="close" size={18} color={COLORS.white} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.photoPlaceholder} onPress={() => setShowImageOptions(true)} accessibilityRole="button" accessibilityLabel="Adicionar foto do produto">
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
              <Text style={styles.requiredMark}> *</Text>
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
              <Text style={[styles.label, isDarkMode ? styles.darkText : styles.lightText]}>Lote<Text style={styles.requiredMark}> *</Text></Text>
              <View style={[styles.inputContainer, showErrors && checkEmptyFields('lote') && styles.emptyField]}>
                <TextInput placeholder="Ex: 123" value={lote} onChangeText={setBatch} style={styles.input} placeholderTextColor={isDarkMode ? COLORS.placeholderDark : COLORS.placeholderLight} />
              </View>
            </View>
            <View style={[styles.fieldContainer, { flex: 1 }]}>
              <Text style={[styles.label, isDarkMode ? styles.darkText : styles.lightText]}>Qtd<Text style={styles.requiredMark}> *</Text></Text>
              <View style={[styles.inputContainer, showErrors && checkEmptyFields('quantidade') && styles.emptyField]}>
                <TextInput placeholder="Ex: 10" value={quantidade} onChangeText={t => setQuantity(t.replace(/[^0-9]/g, ''))} keyboardType="numeric" style={styles.input} placeholderTextColor={isDarkMode ? COLORS.placeholderDark : COLORS.placeholderLight} />
              </View>
            </View>
          </View>

          {/* Código Interno */}
          <View style={styles.fieldContainer}>
            <Text style={[styles.label, isDarkMode ? styles.darkText : styles.lightText]}>
              <MaterialCommunityIcons name="identifier" size={18} color={isDarkMode ? COLORS.fieldIconDark : COLORS.fieldIconLight} /> Código Interno
              <Text style={styles.requiredMark}> *</Text>
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
              <Text style={styles.requiredMark}> *</Text>
            </Text>
            <View style={styles.eanContainer}>
              <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }, showErrors && checkEmptyFields('codauxiliar') && styles.emptyField]}>
                <TextInput placeholder="Ex: 789..." value={codauxiliar} onChangeText={(t) => performSearch(t, 'codauxiliar')} keyboardType="numeric" style={styles.input} placeholderTextColor={isDarkMode ? COLORS.placeholderDark : COLORS.placeholderLight} />
                {renderFieldStatus('codauxiliar')}
              </View>
              <TouchableOpacity style={styles.scanButton} onPress={handleScanBarcode} accessibilityRole="button" accessibilityLabel="Escanear código de barras">
                <MaterialCommunityIcons name="barcode-scan" size={24} color={COLORS.white} />
              </TouchableOpacity>
            </View>
            {renderSuggestions('codauxiliar')}
          </View>

          {/* Data */}
          <View style={styles.fieldContainer}>
            <Text style={[styles.label, isDarkMode ? styles.darkText : styles.lightText]}>Validade<Text style={styles.requiredMark}> *</Text></Text>
            <TouchableOpacity style={styles.inputContainer} onPress={toggleDatePicker}>
              <Text style={[styles.input, { paddingVertical: 10 }]}>{validade.toLocaleDateString('pt-BR')}</Text>
            </TouchableOpacity>
          </View>
          {showDatePicker && (
            <DateTimePicker value={validade} mode="date" display="spinner" onChange={onChangeDate} minimumDate={new Date()} locale="pt-BR" />
          )}

          {visibleLocationFields.length > 0 ? (
            <View style={styles.locationSection}>
              <View style={styles.locationSectionHeader}>
                <MaterialCommunityIcons name="map-marker-path" size={20} color={isDarkMode ? COLORS.fieldIconDark : COLORS.fieldIconLight} />
                <Text style={[styles.locationSectionTitle, isDarkMode ? styles.darkText : styles.lightText]}>
                  Localização Logística
                </Text>
              </View>
              <Text style={[styles.locationSectionSubtitle, isDarkMode ? styles.darkText : styles.lightText]}>
                Os campos abaixo seguem a configuração definida em Ajustes.
              </Text>

              {locationFieldRows.map((row, rowIndex) => (
                <View key={`location-row-${rowIndex}`} style={styles.locationGridRow}>
                  {row.map((field) => renderLocationField(field, { isCompact: true }))}
                  {row.length === 1 ? <View style={styles.locationGridSpacer} /> : null}
                </View>
              ))}

              {observationLocationField ? renderLocationField(observationLocationField) : null}
            </View>
          ) : null}

          <TouchableOpacity style={styles.saveButton} onPress={handleSaveProduct} disabled={isSaving || !isLogisticsLocationConfigLoaded}>
            {isSaving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.saveButtonText}>{isEditing ? 'Atualizar' : 'Salvar'}</Text>}
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
              <MaterialCommunityIcons name="camera" size={24} color={COLORS.white} />
            </View>
            <Text style={styles.sheetButtonText}>Tirar nova foto agora</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sheetButton} onPress={handleChooseFromGallery}>
            <View style={styles.sheetIconContainer}>
              <MaterialCommunityIcons name="image-multiple" size={24} color={COLORS.white} />
            </View>
            <Text style={styles.sheetButtonText}>Escolher da galeria</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sheetButton, styles.sheetCancelButton]}
            onPress={() => setShowImageOptions(false)}
          >
            <Text style={[styles.sheetButtonText, { marginLeft: 0, width: '100%', textAlign: 'center', color: isDarkMode ? COLORS.dangerDark : COLORS.dangerLight }]}>
              Cancelar
            </Text>
          </TouchableOpacity>
        </Modal>
      </Portal>

      <Portal>
        <Dialog visible={historyDialogVisible} onDismiss={() => setHistoryDialogVisible(false)} style={[styles.historyDialog, { backgroundColor: isDarkMode ? COLORS.cardDark : COLORS.card }]}>
          <View style={styles.historyHeader}>
            <View style={styles.historyHeaderIcon}>
              <MaterialCommunityIcons name="history" size={18} color={COLORS.primary} />
            </View>
            <View style={styles.historyHeaderTextWrap}>
              <Text style={[styles.historyHeaderTitle, { color: isDarkMode ? COLORS.textDark : COLORS.text }]}>Produtos Recentes</Text>
              <Text style={[styles.historyHeaderSubtitle, { color: isDarkMode ? COLORS.textMutedDark : COLORS.textMuted }]} numberOfLines={1}>
                {recentProducts.length === 0
                  ? 'Nada salvo ainda'
                  : `${recentProducts.length} ${recentProducts.length === 1 ? 'produto' : 'produtos'} · toque para preencher`}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setHistoryDialogVisible(false)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Fechar"
            >
              <MaterialCommunityIcons name="close" size={22} color={isDarkMode ? COLORS.placeholderDark : COLORS.placeholderLight} />
            </TouchableOpacity>
          </View>
          <Dialog.Content style={styles.historyContent}>
            {recentProducts.length === 0 ? (
              <View style={styles.historyEmptyState}>
                <View style={styles.historyEmptyIcon}>
                  <MaterialCommunityIcons name="package-variant-closed" size={30} color={isDarkMode ? COLORS.placeholderDark : COLORS.placeholderLight} />
                </View>
                <Text style={[styles.historyEmptyTitle, { color: isDarkMode ? COLORS.textDark : COLORS.text }]}>Nenhum produto recente</Text>
                <Text style={styles.historyEmpty}>Os últimos produtos que você salvar aparecem aqui para reuso rápido.</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={styles.historyList} showsVerticalScrollIndicator={false}>
                {recentProducts.slice().reverse().map((p, i) => {
                  const mutedColor = isDarkMode ? COLORS.textMutedDark : COLORS.textMuted;
                  // Monta a meta só com os campos preenchidos (evita "·  ·" e "—" soltos).
                  const metaParts = [];
                  if (p.codprod) metaParts.push(`Cód ${p.codprod}`);
                  if (p.codauxiliar) metaParts.push(`EAN ${p.codauxiliar}`);
                  if (p.lote) metaParts.push(`Lote ${p.lote}`);
                  if (p.quantidade != null) metaParts.push(`Qtd ${p.quantidade}`);
                  return (
                    <TouchableOpacity key={p.id || String(i)} style={styles.historyItem} activeOpacity={0.7} onPress={() => handleSelectRecentProduct(p)}>
                      {p.previewImageUrl ? (
                        <Image source={{ uri: p.previewImageUrl }} style={styles.historyThumb} />
                      ) : (
                        <View style={styles.historyThumbPlaceholder}>
                          <MaterialCommunityIcons name="image-off-outline" size={16} color={isDarkMode ? COLORS.placeholderDark : COLORS.placeholderLight} />
                        </View>
                      )}
                      <View style={styles.historyBody}>
                        <View style={styles.historyTopRow}>
                          <Text style={styles.historyTitle} numberOfLines={1}>{p.descricao || 'Produto sem descrição'}</Text>
                          <View style={styles.historyValBadge}>
                            <MaterialCommunityIcons name="calendar-check-outline" size={12} color={isDarkMode ? COLORS.successDark : COLORS.accent} />
                            <Text style={styles.historyValBadgeText}>{formatDateLabel(p.validade)}</Text>
                          </View>
                        </View>
                        <Text style={[styles.historyMeta, { color: mutedColor }]} numberOfLines={1}>
                          {metaParts.length ? metaParts.join('  ·  ') : 'Sem detalhes adicionais'}
                        </Text>
                      </View>
                      <MaterialCommunityIcons name="chevron-right" size={20} color={mutedColor} style={styles.historyChevron} />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </Dialog.Content>
        </Dialog>
      </Portal>
    </ScreenLayout>
  );
};

const createStyles = (isDarkMode, concentratedShadow, subtleConcentratedShadow) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: 12,
    },
    formCard: {
      flex: 1,
      padding: 16,
      borderRadius: 12,
      backgroundColor: isDarkMode ? COLORS.cardDark : COLORS.card,
      ...concentratedShadow,
    },
    scrollView: {
      flex: 1,
    },
    scrollViewContent: {
      flexGrow: 1,
      paddingBottom: 20,
    },
    fieldContainer: {
      marginBottom: 12,
      position: 'relative',
    },
    locationSection: {
      marginTop: 8,
      marginBottom: 4,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDarkMode ? COLORS.borderDark : COLORS.border,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : '#f8fbff',
    },
    locationSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    locationSectionTitle: {
      marginLeft: 8,
      fontSize: 15,
      fontWeight: '800',
    },
    locationSectionSubtitle: {
      fontSize: 12,
      lineHeight: 18,
      opacity: 0.76,
      marginBottom: 12,
    },
    locationGridRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 10,
    },
    locationGridItem: {
      flex: 1,
      minWidth: 0,
    },
    locationGridSpacer: {
      flex: 1,
    },
    rowContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 4,
      color: isDarkMode ? COLORS.white : COLORS.text,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: 8,
      borderColor: isDarkMode ? COLORS.borderDark : COLORS.border,
      backgroundColor: isDarkMode ? COLORS.inputDark : COLORS.card,
      padding: 4,
      elevation: 1,
    },
    multilineInputContainer: {
      alignItems: 'flex-start',
    },
    input: {
      flex: 1,
      height: 40,
      paddingHorizontal: 12,
      fontSize: 14,
      color: isDarkMode ? COLORS.white : COLORS.text,
    },
    multilineInput: {
      minHeight: 84,
      paddingTop: 10,
      paddingBottom: 10,
    },
    eanContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    scanButton: {
      width: 40,
      height: 40,
      backgroundColor: isDarkMode ? COLORS.secondary : COLORS.accent,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    dateButton: {
      height: 40,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      borderRadius: 8,
    },
    dateText: {
      marginLeft: 8,
      fontSize: 14,
    },
    saveButton: {
      flexDirection: 'row',
      backgroundColor: isDarkMode ? COLORS.secondary : COLORS.accent,
      height: 48,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 12,
      ...concentratedShadow,
    },
    saveButtonText: {
      color: COLORS.white,
      fontSize: 16,
      fontWeight: 'bold',
      marginLeft: 8,
    },
    fieldIcon: {
      marginRight: 12,
      marginLeft: 4,
    },
    requiredText: {
      fontSize: 12,
      marginTop: 4,
      color: isDarkMode ? COLORS.dangerDark : COLORS.dangerLight,
    },
    requiredMark: {
      color: isDarkMode ? COLORS.dangerDark : COLORS.dangerLight,
      fontWeight: '800',
    },
    emptyField: {
      borderColor: isDarkMode ? COLORS.dangerDark : COLORS.dangerLight,
      borderWidth: 2,
      backgroundColor: isDarkMode ? COLORS.emptyFieldDark : COLORS.emptyFieldLight,
    },
    suggestionsContainer: {
      backgroundColor: isDarkMode ? COLORS.suggestionsDark : COLORS.suggestionsLight,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isDarkMode ? COLORS.borderDark : COLORS.suggestionsBorderLight,
      marginTop: 2,
      ...subtleConcentratedShadow,
      zIndex: 9999,
      overflow: 'hidden',
    },
    suggestionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? COLORS.suggestionDividerDark : COLORS.suggestionDividerLight,
    },
    suggestionIcon: {
      marginRight: 10,
    },
    suggestionTextContainer: {
      flex: 1,
    },
    suggestionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: isDarkMode ? COLORS.white : COLORS.text,
    },
    suggestionSubtitle: {
      fontSize: 12,
      color: isDarkMode ? COLORS.suggestionSubtitleDark : COLORS.suggestionSubtitleLight,
      marginTop: 2,
    },
    photoContainer: {
      alignItems: 'center',
      marginTop: 8,
    },
    photoPlaceholder: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: isDarkMode ? COLORS.neutralDark : COLORS.photoPlaceholderLight,
      borderWidth: 2,
      borderColor: isDarkMode ? COLORS.neutralMid : COLORS.neutralLight,
      borderStyle: 'dashed',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    photoPlaceholderText: {
      fontSize: 11,
      marginTop: 4,
      textAlign: 'center',
    },
    photoPreview: {
      width: 100,
      height: 100,
      borderRadius: 50,
      borderWidth: 3,
      borderColor: isDarkMode ? COLORS.neutralMid : COLORS.neutralLight,
    },
    removePhotoButton: {
      position: 'absolute',
      top: -5,
      right: -5,
      backgroundColor: COLORS.closeDanger,
      borderRadius: 15,
      width: 26,
      height: 26,
      justifyContent: 'center',
      alignItems: 'center',
    },
    retakePhotoButton: {
      flexDirection: 'row',
      backgroundColor: isDarkMode ? COLORS.secondary : COLORS.accent,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 15,
    },
    retakePhotoText: {
      color: COLORS.white,
      fontSize: 12,
      fontWeight: '600',
      marginLeft: 4,
    },
    historyDialog: {
      borderRadius: 20,
    },
    historyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 12,
    },
    historyHeaderIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDarkMode ? 'rgba(5,150,105,0.20)' : 'rgba(5,150,105,0.12)',
      marginRight: 12,
    },
    historyHeaderTextWrap: {
      flex: 1,
    },
    historyHeaderTitle: {
      fontSize: 18,
      fontWeight: '800',
    },
    historyHeaderSubtitle: {
      fontSize: 12,
      fontWeight: '600',
      marginTop: 2,
    },
    historyContent: {
      paddingTop: 0,
      paddingHorizontal: 16,
    },
    historyEmptyState: {
      alignItems: 'center',
      paddingVertical: 24,
      paddingHorizontal: 12,
    },
    historyEmptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDarkMode ? COLORS.neutralDark : '#f1f3f9',
      marginBottom: 14,
    },
    historyEmptyTitle: {
      fontSize: 15,
      fontWeight: '800',
      marginBottom: 6,
      textAlign: 'center',
    },
    historyList: {
      paddingTop: 4,
    },
    historyItem: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: isDarkMode ? COLORS.borderDark : COLORS.historyItemBorderLight,
      borderRadius: 14,
      padding: 12,
      marginBottom: 8,
      backgroundColor: isDarkMode ? COLORS.historyItemBackgroundDark : COLORS.historyItemBackgroundLight,
    },
    historyHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    historyThumb: {
      width: 42,
      height: 42,
      borderRadius: 21,
      marginRight: 10,
      borderWidth: 1,
      borderColor: isDarkMode ? COLORS.borderDark : COLORS.historyItemBorderLight,
    },
    historyThumbPlaceholder: {
      width: 42,
      height: 42,
      borderRadius: 21,
      marginRight: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDarkMode ? COLORS.neutralDark : COLORS.photoPlaceholderLight,
      borderWidth: 1,
      borderColor: isDarkMode ? COLORS.borderDark : COLORS.historyItemBorderLight,
    },
    historyTitle: {
      flex: 1,
      fontSize: 15,
      fontWeight: '800',
      color: isDarkMode ? COLORS.white : COLORS.text,
      marginRight: 4,
    },
    historyBody: {
      flex: 1,
    },
    historyTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    historyValBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: isDarkMode ? 'rgba(5,150,105,0.20)' : 'rgba(5,150,105,0.10)',
    },
    historyValBadgeText: {
      fontSize: 11.5,
      fontWeight: '800',
      marginLeft: 4,
      color: isDarkMode ? COLORS.successDark : COLORS.accent,
    },
    historyMeta: {
      fontSize: 12,
      fontWeight: '600',
      marginTop: 3,
    },
    historyChevron: {
      marginLeft: 8,
    },
    historyChipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: 6,
      gap: 6,
    },
    historyChip: {
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
      flexDirection: 'row',
      alignItems: 'center',
    },
    historyChipText: {
      fontSize: 11,
      fontWeight: '600',
      marginLeft: 4,
    },
    historyEmpty: {
      fontSize: 13,
      textAlign: 'center',
      color: isDarkMode ? COLORS.placeholderDark : COLORS.placeholderLight,
      paddingVertical: 10,
    },
    darkText: {
      color: COLORS.fieldIconDark,
    },
    lightText: {
      color: COLORS.text,
    },
    bottomSheet: {
      backgroundColor: isDarkMode ? COLORS.cardDark : COLORS.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    },
    sheetTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: isDarkMode ? COLORS.white : COLORS.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    sheetSubtitle: {
      fontSize: 14,
      color: isDarkMode ? COLORS.placeholderDark : COLORS.placeholderLight,
      marginBottom: 24,
      textAlign: 'center',
    },
    sheetButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDarkMode ? COLORS.neutralDark : COLORS.sheetButtonLight,
      padding: 16,
      borderRadius: 12,
      marginBottom: 12,
    },
    sheetCancelButton: {
      backgroundColor: COLORS.transparent,
      marginTop: 8,
      borderWidth: 1,
      borderColor: isDarkMode ? COLORS.sheetCancelBorderDark : COLORS.sheetCancelBorderLight,
    },
    sheetButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: isDarkMode ? COLORS.white : COLORS.text,
      marginLeft: 16,
    },
    sheetIconContainer: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: isDarkMode ? COLORS.secondary : COLORS.accent,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

export default AddProductScreen;
