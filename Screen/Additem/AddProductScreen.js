import React, { useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, Alert, StyleSheet, TouchableOpacity, TextInput, Animated, ActivityIndicator, Image } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BarCodeScanner } from 'expo-barcode-scanner';
import * as ImagePicker from 'expo-image-picker';
import Dados from '../../assets/Dados.json'; // ou importação de onde os dados estão salvos
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';

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
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [showHistory, setShowHistory] = useState(false);
  const [recentProducts, setRecentProducts] = useState([]);
  const [historyAnimation] = useState(new Animated.Value(0));
  const [productImage, setProductImage] = useState(null);
  const [showImageOptions, setShowImageOptions] = useState(false);

  // Função para buscar no Dados.json
  const handleBarcodeScan = (scannedEan) => {
    const formattedScannedEan = String(scannedEan).trim();
    const product = Dados.find(p => String(p.CODAUXILIAR).trim() === formattedScannedEan);
  
    if (product) {
      setProductName(product.DESCRICAO);
      setcodprod(String(product.CODPROD));
      setEan(String(product.CODAUXILIAR));
      
      Toast.show({
        type: 'success',
        text1: 'Produto Encontrado',
        text2: 'Dados preenchidos automaticamente',
        visibilityTime: 2000,
      });
    } else {
      Toast.show({
        type: 'error',
        text1: 'Produto não encontrado',
        text2: 'Não foi possível encontrar o produto com o EAN fornecido.',
        visibilityTime: 3000,
      });
    }
  };

  const loadRecentProducts = async () => {
    const existingProducts = await AsyncStorage.getItem('products');
    let products = existingProducts ? JSON.parse(existingProducts) : [];
    setRecentProducts(products.slice(-5));
  };

  const animateHistory = (show) => {
    Animated.spring(historyAnimation, {
      toValue: show ? 1 : 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11
    }).start();
  };

  useEffect(() => {
    // Função que carrega os dados do produto para edição
    const loadProductData = () => {
      if (route.params?.product) {
        const { id, descricao, lote, quantidade, codprod, codauxiliar, validade, imageUrl, foto } = route.params.product;
        setProductId(id);
        setProductName(descricao);
        setBatch(lote);
        setQuantity(quantidade.toString());
        setcodprod(codprod);
        setEan(codauxiliar);
        setExpirationDate(new Date(validade));
        setProductImage(imageUrl || foto || null);
        setIsEditing(true);
        console.log("Dados carregados para edição:", route.params.product);  // Log para verificar os dados recebidos
      }
    };

    // Atualiza o código EAN se for passado pela rota
    if (route.params?.barcodeData) {
      setEan(route.params.barcodeData);
      handleBarcodeScan(route.params.barcodeData); // Chama a função de busca ao escanear
      console.log("Código EAN recebido da rota:", route.params.barcodeData);  // Log para verificar o EAN recebido
    }

    const headerButtonStyle = {
      padding: 8,
      borderRadius: 8,
      marginLeft: 8,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDarkMode ? '#1a4645' : 'rgba(255, 255, 255, 0.2)',
    };

    navigation.setOptions({
      headerShown: true,
      headerStyle: {
        backgroundColor: isDarkMode ? '#1a4645' : '#2d5a57',
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
      headerTitle: () => (
        <View style={styles.headerTitleContainer}>
          <MaterialCommunityIcons 
            name={isEditing ? "pencil-circle" : "plus-circle"} 
            size={24} 
            color="#FFFFFF" 
          />
          <Text style={styles.headerTitleText}>
            {isEditing ? 'Editar Produto' : 'Cadastrar Produto'}
          </Text>
        </View>
      ),
      headerRight: () => (
        <View style={{ flexDirection: 'row', marginRight: 8 }}>
          <TouchableOpacity 
            style={[
              headerButtonStyle,
              showHistory && { backgroundColor: isDarkMode ? '#2d5a57' : '#1a4645' }
            ]}
            onPress={() => {
              loadRecentProducts();
              setShowHistory(!showHistory);
            }}
          >
            <MaterialCommunityIcons 
              name="history" 
              size={24} 
              color="#FFF" 
            />
          </TouchableOpacity>
        </View>
      ),
    });

    loadProductData();
  }, [navigation, route.params?.product, route.params?.barcodeData, isDarkMode, isEditing, showHistory]);

  useEffect(() => {
    if (showErrors) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [showErrors]);

  useEffect(() => {
    animateHistory(showHistory);
  }, [showHistory]);

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
        imageUrl: productImage, // Salva a URI da imagem
      };

      console.log("Produto a ser salvo:", product);  // Log para verificar os dados do produto a ser salvo

      const existingProducts = await AsyncStorage.getItem('products');
      let products = existingProducts ? JSON.parse(existingProducts) : [];
      console.log("Produtos existentes:", products);  // Log para verificar os produtos existentes

      if (isEditing) {
        products = products.map((p) => (p.id === productId ? product : p));
        console.log("Produto atualizado:", product);  // Log para verificar se o produto foi atualizado
      } else {
        products.push(product);
        console.log("Novo produto adicionado:", product);  // Log para verificar se o produto foi adicionado
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

  const handleScanBarcode = async () => {
    const { status } = await BarCodeScanner.requestPermissionsAsync();
    console.log("Status da permissão para a câmera:", status);
    
    if (status === 'granted') {
      Toast.show({
        type: 'info',
        text1: 'Scanner Ativo',
        text2: 'Posicione o código de barras no centro da tela',
        visibilityTime: 3000,
      });
      navigation.navigate('BarcodeScannerScreen');
    } else {
      Toast.show({
        type: 'error',
        text1: 'Permissão necessária',
        text2: 'A permissão para acessar a câmera é necessária para escanear o código de barras.',
        visibilityTime: 3000,
      });
    }
  };

  const onChangeDate = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setExpirationDate(selectedDate);
      console.log("Data de validade selecionada:", selectedDate);  // Log para verificar a data de validade
    }
  };

  // Função para verificar campos vazios
  const checkEmptyFields = (field) => {
    switch (field) {
      case 'productName':
        return !productName.trim();
      case 'lote':
        return !lote.trim();
      case 'quantidade':
        return !quantidade.trim();
      case 'codprod':
        return !codprod.trim();
      case 'codauxiliar':
        return !codauxiliar.trim();
      case 'validade':
        return !validade || validade.toString() === 'Invalid Date';
      default:
        return false;
    }
  };

  // Função para renderizar o ícone de status do campo
  const renderFieldStatus = (field) => {
    if (!showErrors) return null;

    if (checkEmptyFields(field)) {
      return (
        <MaterialIcons 
          name="error-outline" 
          size={24} 
          color={isDarkMode ? '#FF6B6B' : '#B00020'}
          style={styles.fieldIcon}
        />
      );
    }
    return (
      <MaterialIcons 
        name="check-circle" 
        size={24} 
        color={isDarkMode ? '#4ADE80' : '#4CAF50'}
        style={styles.fieldIcon}
      />
    );
  };

  // Mova a definição dos styles para dentro do componente
  const getStyles = (isDarkMode) => StyleSheet.create({
    container: {
      flex: 1,
      padding: 12,
    },
    formCard: {
      flex: 1,
      padding: 16,
      borderRadius: 12,
      backgroundColor: isDarkMode ? '#1E1E1E' : '#FFFFFF',
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
    },
    scrollView: {
      flex: 1,
    },
    scrollViewContent: {
      flexGrow: 1,
      paddingBottom: 20,
    },
    headerGradient: {
      padding: 16,
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    headerTitle: {
      color: '#FFFFFF',
      fontSize: 22,
      fontWeight: 'bold',
      marginLeft: 8,
    },
    fieldContainer: {
      marginBottom: 12,
    },
    rowContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 4,
      color: isDarkMode ? '#FFFFFF' : '#333333',
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: 8,
      borderColor: isDarkMode ? '#404040' : '#E0E0E0',
      backgroundColor: isDarkMode ? '#1E1E1E' : '#FFFFFF',
      padding: 4,
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.18,
      shadowRadius: 1.00,
      elevation: 1,
    },
    focusedInput: {
      borderColor: isDarkMode ? '#3d7a77' : '#2d5a57',
      borderWidth: 2,
    },
    input: {
      flex: 1,
      height: 40,
      paddingHorizontal: 12,
      fontSize: 14,
      color: isDarkMode ? '#FFFFFF' : '#000000',
    },
    lightInput: {
      backgroundColor: '#FFFFFF',
      color: '#000000',
    },
    darkInput: {
      backgroundColor: '#333333',
      color: '#E0E0E0',
      borderColor: '#404040',
    },
    eanContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    eanInput: {
      flex: 1,
      height: 48,
      marginRight: 8,
      borderRadius: 8,
      paddingHorizontal: 16,
      fontSize: 16,
      borderWidth: 1,
      borderColor: isDarkMode ? '#404040' : '#E0E0E0',
    },
    scanButton: {
      width: 40,
      height: 40,
      backgroundColor: isDarkMode ? '#2d5a57' : '#1a4645',
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
      backgroundColor: isDarkMode ? '#2d5a57' : '#1a4645',
      height: 48,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 12,
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    saveButtonPressed: {
      opacity: 0.8,
      transform: [{ scale: 0.98 }]
    },
    saveButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: 'bold',
      marginLeft: 8,
    },
    lightBackground: {
      backgroundColor: '#F5F5F5',
    },
    darkBackground: {
      backgroundColor: '#121212',
    },
    lightText: {
      color: '#333333',
    },
    darkText: {
      color: '#E0E0E0',
    },
    fieldIcon: {
      marginRight: 12,
      marginLeft: 4,
    },
    requiredText: {
      fontSize: 12,
      marginTop: 4,
      color: isDarkMode ? '#FF6B6B' : '#B00020',
    },
    emptyField: {
      borderColor: isDarkMode ? '#FF6B6B' : '#B00020',
      borderWidth: 2,
      backgroundColor: isDarkMode ? '#2D1F1F' : '#FFF5F5',
    },
    requiredAsterisk: {
      color: isDarkMode ? '#FF6B6B' : '#B00020',
      marginLeft: 4,
    },
    headerTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerTitleText: {
      color: '#FFFFFF',
      fontSize: 20,
      fontWeight: 'bold',
    },
    headerButton: {
      marginRight: 16,
      padding: 8,
    },
    historyOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.3)',
      justifyContent: 'flex-start',
    },
    historyContainer: {
      position: 'absolute',
      top: 80,
      right: 16,
      width: '80%',
      backgroundColor: isDarkMode ? '#1E1E1E' : '#FFFFFF',
      borderRadius: 12,
      elevation: 5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      padding: 16,
      zIndex: 1000,
    },
    historyHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    historyTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    historyTitle: {
      fontSize: 18,
      fontWeight: 'bold',
    },
    closeButton: {
      padding: 4,
    },
    historyItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? '#333333' : '#E0E0E0',
    },
    historyText: {
      marginLeft: 12,
      fontSize: 16,
    },
    photoContainer: {
      alignItems: 'center',
      marginTop: 8,
    },
    photoPlaceholder: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: isDarkMode ? '#333' : '#f5f5f5',
      borderWidth: 2,
      borderColor: isDarkMode ? '#555' : '#ddd',
      borderStyle: 'dashed',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    photoPlaceholderText: {
      fontSize: 12,
      marginTop: 4,
      textAlign: 'center',
    },
    photoPreviewContainer: {
      position: 'relative',
      marginBottom: 12,
    },
    photoPreview: {
      width: 120,
      height: 120,
      borderRadius: 60,
      borderWidth: 3,
      borderColor: isDarkMode ? '#555' : '#ddd',
    },
    removePhotoButton: {
      position: 'absolute',
      top: -8,
      right: -8,
      backgroundColor: '#e53935',
      borderRadius: 15,
      width: 30,
      height: 30,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
    },
    retakePhotoButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDarkMode ? '#2d5a57' : '#1a4645',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
    },
    retakePhotoText: {
      color: '#FFF',
      fontSize: 14,
      fontWeight: '600',
      marginLeft: 4,
    },
    imageOptionsOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 2000,
    },
    imageOptionsContainer: {
      backgroundColor: isDarkMode ? '#1E1E1E' : '#FFFFFF',
      borderRadius: 16,
      padding: 20,
      margin: 20,
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      minWidth: 280,
    },
    imageOptionsTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 20,
      color: isDarkMode ? '#FFFFFF' : '#333333',
    },
    imageOptionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderRadius: 12,
      marginBottom: 12,
      backgroundColor: isDarkMode ? '#2d5a57' : '#1a4645',
    },
    imageOptionText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 12,
    },
    cancelButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderRadius: 12,
      backgroundColor: isDarkMode ? '#444' : '#f0f0f0',
      marginTop: 8,
    },
    cancelButtonText: {
      color: isDarkMode ? '#FFFFFF' : '#333333',
      fontSize: 16,
      fontWeight: '600',
    },
  });

  // Use os estilos dentro do componente
  const styles = getStyles(isDarkMode);

  const handleCopyFromHistory = (product) => {
    setProductName(product.descricao);
    setcodprod(product.codprod);
    setEan(product.codauxiliar);
    setProductImage(product.imageUrl || product.foto || null);
    
    Toast.show({
      type: 'success',
      text1: 'Produto Copiado',
      text2: 'Dados do produto copiados com sucesso',
    });
  };

  const handleOutsidePress = () => {
    setShowHistory(false);
  };

  // Função para capturar foto
  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Toast.show({
          type: 'error',
          text1: 'Permissão necessária',
          text2: 'A permissão para acessar a câmera é necessária para tirar a foto.',
          visibilityTime: 3000,
        });
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setProductImage(result.assets[0].uri);
        setShowImageOptions(false);
        Toast.show({
          type: 'success',
          text1: 'Foto capturada',
          text2: 'Foto do produto salva com sucesso!',
          visibilityTime: 2000,
        });
      }
    } catch (error) {
      console.error('Erro ao capturar foto:', error);
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Não foi possível capturar a foto.',
        visibilityTime: 3000,
      });
    }
  };

  // Função para escolher foto da galeria
  const handleChooseFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Toast.show({
          type: 'error',
          text1: 'Permissão necessária',
          text2: 'A permissão para acessar a galeria é necessária para escolher uma foto.',
          visibilityTime: 3000,
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setProductImage(result.assets[0].uri);
        setShowImageOptions(false);
        Toast.show({
          type: 'success',
          text1: 'Foto selecionada',
          text2: 'Foto do produto selecionada com sucesso!',
          visibilityTime: 2000,
        });
      }
    } catch (error) {
      console.error('Erro ao escolher foto:', error);
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Não foi possível escolher a foto.',
        visibilityTime: 3000,
      });
    }
  };

  // Função para remover foto
  const handleRemovePhoto = () => {
    setProductImage(null);
    Toast.show({
      type: 'info',
      text1: 'Foto removida',
      text2: 'A foto do produto foi removida.',
      visibilityTime: 2000,
    });
  };

  return (
    <View style={[
      styles.container, 
      isDarkMode ? styles.darkBackground : styles.lightBackground
    ]}>
      <View style={styles.formCard}>
        {/* Campo Foto do Produto */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.label, isDarkMode ? styles.darkText : styles.lightText]}>
            <MaterialCommunityIcons name="camera" size={18} color={isDarkMode ? '#FFFFFF' : '#333333'} />
            {' '}Foto do Produto
          </Text>
          <View style={styles.photoContainer}>
            {productImage ? (
              <View style={styles.photoPreviewContainer}>
                <Image source={{ uri: productImage }} style={styles.photoPreview} />
                <TouchableOpacity 
                  style={styles.removePhotoButton}
                  onPress={handleRemovePhoto}
                >
                  <MaterialIcons name="close" size={20} color="#FFF" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.photoPlaceholder}
                onPress={() => setShowImageOptions(true)}
              >
                <MaterialCommunityIcons 
                  name="camera-plus" 
                  size={48} 
                  color={isDarkMode ? '#888' : '#bbb'} 
                />
                <Text style={[styles.photoPlaceholderText, isDarkMode ? styles.darkText : styles.lightText]}>
                  Adicionar Foto
                </Text>
              </TouchableOpacity>
            )}
            {productImage && (
              <TouchableOpacity 
                style={styles.retakePhotoButton}
                onPress={() => setShowImageOptions(true)}
              >
                <MaterialCommunityIcons name="camera" size={20} color="#FFF" />
                <Text style={styles.retakePhotoText}>Nova Foto</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Campo Nome do Produto */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.label, isDarkMode ? styles.darkText : styles.lightText]}>
            <MaterialCommunityIcons name="package-variant" size={18} color={isDarkMode ? '#FFFFFF' : '#333333'} />
            {' '}Nome do Produto
          </Text>
          <View style={[
            styles.inputContainer,
            showErrors && checkEmptyFields('productName') && styles.emptyField
          ]}>
            <TextInput
              placeholder="Ex: Sabão em Pó"
              value={productName}
              onChangeText={setProductName}
              style={styles.input}
              placeholderTextColor={isDarkMode ? '#A8B8A7' : '#A9A9A9'}
            />
            {renderFieldStatus('productName')}
          </View>
          {showErrors && checkEmptyFields('productName') && (
            <Animated.Text 
              style={[
                styles.requiredText,
                { opacity: fadeAnim }
              ]}
            >
              Campo obrigatório
            </Animated.Text>
          )}
        </View>

        {/* Campos Lote e Quantidade em linha */}
        <View style={styles.rowContainer}>
          <View style={[styles.fieldContainer, { flex: 1, marginRight: 10 }]}>
            <Text style={[styles.label, isDarkMode ? styles.darkText : styles.lightText]}>
              <MaterialCommunityIcons name="barcode-scan" size={18} color={isDarkMode ? '#FFFFFF' : '#333333'} />
              {' '}Lote
            </Text>
            <View style={[
              styles.inputContainer,
              showErrors && checkEmptyFields('lote') && styles.emptyField
            ]}>
              <TextInput
                placeholder="Ex: 123456"
                value={lote}
                onChangeText={setBatch}
                style={styles.input}
                placeholderTextColor={isDarkMode ? '#A8B8A7' : '#A9A9A9'}
              />
              {renderFieldStatus('lote')}
            </View>
            {showErrors && checkEmptyFields('lote') && (
              <Animated.Text 
                style={[
                  styles.requiredText,
                  { opacity: fadeAnim }
                ]}
              >
                Campo obrigatório
              </Animated.Text>
            )}
          </View>

          <View style={[styles.fieldContainer, { flex: 1 }]}>
            <Text style={[styles.label, isDarkMode ? styles.darkText : styles.lightText]}>
              <MaterialCommunityIcons name="numeric" size={18} color={isDarkMode ? '#FFFFFF' : '#333333'} />
              {' '}Quantidade
            </Text>
            <View style={[
              styles.inputContainer,
              showErrors && checkEmptyFields('quantidade') && styles.emptyField
            ]}>
              <TextInput
                placeholder="Ex: 10"
                value={quantidade}
                onChangeText={(text) => setQuantity(text.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                style={styles.input}
                placeholderTextColor={isDarkMode ? '#A8B8A7' : '#A9A9A9'}
              />
              {renderFieldStatus('quantidade')}
            </View>
            {showErrors && checkEmptyFields('quantidade') && (
              <Animated.Text 
                style={[
                  styles.requiredText,
                  { opacity: fadeAnim }
                ]}
              >
                Campo obrigatório
              </Animated.Text>
            )}
          </View>
        </View>

        {/* Campo Código Interno */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.label, isDarkMode ? styles.darkText : styles.lightText]}>
            <MaterialCommunityIcons name="identifier" size={18} color={isDarkMode ? '#FFFFFF' : '#333333'} />
            {' '}Código Interno
          </Text>
          <View style={[
            styles.inputContainer,
            showErrors && checkEmptyFields('codprod') && styles.emptyField
          ]}>
            <TextInput
              placeholder="Ex: 001"
              value={codprod}
              onChangeText={(text) => setcodprod(text.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
              style={styles.input}
              placeholderTextColor={isDarkMode ? '#A8B8A7' : '#A9A9A9'}
            />
            {renderFieldStatus('codprod')}
          </View>
          {showErrors && checkEmptyFields('codprod') && (
            <Animated.Text 
              style={[
                styles.requiredText,
                { opacity: fadeAnim }
              ]}
            >
              Campo obrigatório
            </Animated.Text>
          )}
        </View>

        {/* Campo EAN */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.label, isDarkMode ? styles.darkText : styles.lightText]}>
            <MaterialCommunityIcons name="barcode" size={18} color={isDarkMode ? '#FFFFFF' : '#333333'} />
            {' '}EAN
          </Text>
          <View style={styles.eanContainer}>
            <View style={[
              styles.inputContainer,
              { flex: 1, marginRight: 8 },
              showErrors && checkEmptyFields('codauxiliar') && styles.emptyField
            ]}>
              <TextInput
                placeholder="Ex: 7891234567890"
                value={codauxiliar}
                onChangeText={(text) => setEan(text.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                style={styles.input}
                placeholderTextColor={isDarkMode ? '#A8B8A7' : '#A9A9A9'}
              />
              {renderFieldStatus('codauxiliar')}
            </View>
            <TouchableOpacity 
              style={styles.scanButton} 
              onPress={handleScanBarcode}
            >
              <MaterialCommunityIcons name="barcode-scan" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          {showErrors && checkEmptyFields('codauxiliar') && (
            <Animated.Text 
              style={[
                styles.requiredText,
                { opacity: fadeAnim }
              ]}
            >
              Campo obrigatório
            </Animated.Text>
          )}
        </View>

        {/* Campo Data de Validade */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.label, isDarkMode ? styles.darkText : styles.lightText]}>
            <MaterialCommunityIcons name="calendar-clock" size={18} color={isDarkMode ? '#FFFFFF' : '#333333'} />
            {' '}Data de Validade
          </Text>
          <View style={[
            styles.inputContainer,
            showErrors && checkEmptyFields('validade') && styles.emptyField
          ]}>
            <TouchableOpacity 
              style={[styles.dateButton, { flex: 1, borderWidth: 0 }]} 
              onPress={() => setShowDatePicker(true)}
            >
              <MaterialCommunityIcons 
                name="calendar" 
                size={24} 
                color={isDarkMode ? '#A8B8A7' : '#5d7e62'} 
              />
              <Text style={[styles.dateText, isDarkMode ? styles.darkText : styles.lightText]}>
                {validade.toLocaleDateString('pt-BR')}
              </Text>
            </TouchableOpacity>
            {renderFieldStatus('validade')}
          </View>
          {showErrors && checkEmptyFields('validade') && (
            <Animated.Text 
              style={[
                styles.requiredText,
                { opacity: fadeAnim }
              ]}
            >
              Campo obrigatório
            </Animated.Text>
          )}
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={validade}
            mode="date"
            display="spinner"
            onChange={onChangeDate}
            minimumDate={new Date()}
            locale="pt-BR"
          />
        )}

        <TouchableOpacity 
          style={styles.saveButton} 
          onPress={handleSaveProduct}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <MaterialCommunityIcons name="content-save" size={24} color="#FFFFFF" />
              <Text style={styles.saveButtonText}>
                {isEditing ? 'Atualizar' : 'Salvar'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {showImageOptions && (
        <TouchableOpacity 
          style={styles.imageOptionsOverlay} 
          activeOpacity={1} 
          onPress={() => setShowImageOptions(false)}
        >
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={(e) => e.stopPropagation()}
            style={styles.imageOptionsContainer}
          >
            <Text style={styles.imageOptionsTitle}>
              Escolher Foto do Produto
            </Text>
            
            <TouchableOpacity 
              style={styles.imageOptionButton}
              onPress={handleTakePhoto}
            >
              <MaterialCommunityIcons name="camera" size={24} color="#FFFFFF" />
              <Text style={styles.imageOptionText}>Capturar Nova Foto</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.imageOptionButton}
              onPress={handleChooseFromGallery}
            >
              <MaterialCommunityIcons name="image-multiple" size={24} color="#FFFFFF" />
              <Text style={styles.imageOptionText}>Escolher da Galeria</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => setShowImageOptions(false)}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      {/* Modal de Histórico */}
      {showHistory && (
        <TouchableOpacity 
          style={styles.historyOverlay} 
          activeOpacity={1} 
          onPress={handleOutsidePress}
        >
          <Animated.View 
            style={[
              styles.historyContainer,
              {
                transform: [
                  {
                    translateY: historyAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-20, 0]
                    })
                  }
                ],
                opacity: historyAnimation
              }
            ]}
          >
            <TouchableOpacity 
              activeOpacity={1} 
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.historyHeader}>
                <View style={styles.historyTitleContainer}>
                  <MaterialCommunityIcons 
                    name="history" 
                    size={24} 
                    color={isDarkMode ? '#FFFFFF' : '#333333'} 
                  />
                  <Text style={[styles.historyTitle, isDarkMode ? styles.darkText : styles.lightText]}>
                    Produtos Recentes
                  </Text>
                </View>
                <TouchableOpacity 
                  style={styles.closeButton}
                  onPress={() => setShowHistory(false)}
                >
                  <MaterialCommunityIcons 
                    name="close-circle" 
                    size={28} 
                    color={isDarkMode ? '#FF6B6B' : '#B00020'} 
                  />
                </TouchableOpacity>
              </View>

              {recentProducts.map((product, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.historyItem}
                  onPress={() => handleCopyFromHistory(product)}
                >
                  <MaterialCommunityIcons 
                    name="package-variant" 
                    size={24} 
                    color={isDarkMode ? '#B39DDB' : '#673AB7'} 
                  />
                  <Text style={[styles.historyText, isDarkMode ? styles.darkText : styles.lightText]}>
                    {product.descricao}
                  </Text>
                </TouchableOpacity>
              ))}
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default AddProductScreen;