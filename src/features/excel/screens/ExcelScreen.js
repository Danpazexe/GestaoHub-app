import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Alert, StyleSheet, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import DocumentPicker from 'react-native-document-picker';
import * as XLSX from 'xlsx';
import Share from 'react-native-share';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import {
  createScreenHeaderTemplate,
  createHeaderTitleTemplate,
} from '../../../shared/components/ScreenLayout';

// Paleta de cores
const colors = {
  primary: '#294380',
  success: '#012677',
  import: '#012677',
  backgroundLight: '#f8f8f8',
  backgroundDark: '#181818',
  white: '#FFFFFF',
  black: '#333333',
  textLight: '#333333',
  textDark: '#FFFFFF',
};

const ExcelScreen = ({ navigation, isDarkMode }) => {
  const [productsCount, setProductsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      ...createScreenHeaderTemplate({
        isDarkMode,
        lightHeaderColor: '#012677',
        darkHeaderColor: '#012677',
        tintColor: '#FFFFFF',
      }),
      headerTitle: () =>
        createHeaderTitleTemplate({
          title: 'Exportação / Importação',
          iconName: 'table-chart',
          tintColor: '#FFFFFF',
        }),
    });

    loadProducts();
  }, [navigation, isDarkMode]);

  const loadProducts = useCallback(async () => {
    try {
      const storedProducts = await AsyncStorage.getItem('products');
      if (storedProducts) {
        const parsedProducts = JSON.parse(storedProducts);
        setProductsCount(parsedProducts.length);
      }
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível carregar os produtos.');
    } finally {
      setLoading(false);
    }
  }, []);

  const exportToExcel = async () => {
    if (productsCount === 0) {
      return Alert.alert('Exportação', 'Não há produtos para exportar.');
    }

    setIsProcessing(true);
    try {
      const workBook = XLSX.utils.book_new();
      const workSheet = XLSX.utils.json_to_sheet(await AsyncStorage.getItem('products') ? JSON.parse(await AsyncStorage.getItem('products')) : []);
      XLSX.utils.book_append_sheet(workBook, workSheet, 'Produtos');

      const excelBuffer = XLSX.write(workBook, { bookType: 'xlsx', type: 'base64' });
      const filePath = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/produtos.xlsx`;

      await ReactNativeBlobUtil.fs.writeFile(filePath, excelBuffer, 'base64');

      const fileUrl = filePath.startsWith('file://') ? filePath : `file://${filePath}`;
      await Share.open({
        url: fileUrl,
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        title: 'Exportar planilha',
      });
    } catch (error) {
      Alert.alert('Erro ao exportar para Excel', error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const importFromExcel = async () => {
    setIsProcessing(true);
    try {
      const result = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.allFiles],
        copyTo: 'cachesDirectory',
      });

      const fileUri = result.fileCopyUri || result.uri;

      if (!fileUri.endsWith('.xlsx')) {
        return Alert.alert('Erro', 'Por favor, selecione um arquivo .xlsx.');
      }

      const normalizedPath = fileUri.startsWith('file://') ? fileUri.replace('file://', '') : fileUri;
      const fileContent = await ReactNativeBlobUtil.fs.readFile(normalizedPath, 'base64');
      const workBook = XLSX.read(fileContent, { type: 'base64' });
      const workSheet = workBook.Sheets[workBook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(workSheet);

      await AsyncStorage.setItem('products', JSON.stringify(data));
      setProductsCount(data.length);
      Alert.alert('Importação', `${data.length} itens importados e salvos com sucesso!`);
    } catch (error) {
      if (DocumentPicker.isCancel(error)) {
        return Alert.alert('Importação', 'Importação cancelada');
      }
      Alert.alert('Erro ao importar Excel', error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? colors.backgroundDark : colors.backgroundLight }]}>
      {isProcessing ? (
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      ) : (
        <>
          <View style={styles.header}>
            <MaterialIcons 
              name="table-chart" 
              size={40} 
              color={isDarkMode ? colors.textDark : colors.textLight} 
            />
            <Text style={[styles.title, { color: isDarkMode ? colors.textDark : colors.textLight }]}>
              Gerenciamento de Dados
            </Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={[styles.infoText, { color: isDarkMode ? colors.textDark : colors.textLight }]}>
              Total de Produtos Cadastrados
            </Text>
            <Text style={[styles.infoNumber, { color: isDarkMode ? colors.textDark : colors.textLight }]}>
              {productsCount}
            </Text>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: colors.success }]} 
              onPress={exportToExcel} 
              disabled={loading}
            >
              <MaterialIcons name="file-download" size={24} color={colors.white} />
              <View style={styles.buttonTextContainer}>
                <Text style={styles.buttonText}>Exportar para Excel</Text>
                <Text style={styles.buttonSubtext}>Salvar produtos em planilha</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: colors.import }]} 
              onPress={importFromExcel}
            >
              <MaterialIcons name="file-upload" size={24} color={colors.white} />
              <View style={styles.buttonTextContainer}>
                <Text style={styles.buttonText}>Importar do Excel</Text>
                <Text style={styles.buttonSubtext}>Carregar produtos de planilha</Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: isDarkMode ? colors.textDark : colors.textLight }]}>
              Formatos suportados: .xlsx
            </Text>
          </View>
        </>
      )}
    </View>
  );
};

// Estilos para a tela
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 10,
  },
  infoCard: {
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    marginBottom: 30,
    elevation: 1,
    shadowColor: '#012677',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  infoText: {
    fontSize: 16,
    marginBottom: 10,
  },
  infoNumber: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  buttonContainer: {
    gap: 15,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  buttonTextContainer: {
    marginLeft: 15,
  },
  buttonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  buttonSubtext: {
    color: colors.white,
    fontSize: 12,
    opacity: 0.9,
    marginTop: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    opacity: 0.7,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ExcelScreen;
