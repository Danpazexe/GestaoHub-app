import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  Dimensions, 
  ActivityIndicator, 
  TouchableOpacity, 
  Text, 
  Alert, 
  Platform,
  StatusBar,
  SafeAreaView,
  Modal,
  ScrollView
} from 'react-native';
import Pdf from 'react-native-pdf';
import Share from 'react-native-share';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { createScreenHeaderTemplate, createHeaderTitleTemplate } from '../../../components/ScreenLayout';

const PdfViewerScreen = ({ route, navigation, isDarkMode = false }) => {
  const { pdfUri } = route.params;
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [shareLoading, setShareLoading] = useState(false);
  const [error, setError] = useState(null);

  const palette = {
    bg: isDarkMode ? '#1f2438' : '#f5f5f5',
    surface: isDarkMode ? '#262d47' : '#fff',
    pdfBg: isDarkMode ? '#1f2438' : '#fff',
    text: isDarkMode ? '#f3f5ff' : '#294380',
    muted: isDarkMode ? '#aab1cf' : '#666',
    border: isDarkMode ? '#3a4265' : '#e0e0e0',
    navButton: isDarkMode ? '#2b3350' : '#f0f0f0',
    navButtonDisabled: isDarkMode ? '#1f2438' : '#f5f5f5',
    navIcon: isDarkMode ? '#f3f5ff' : '#294380',
    navIconDisabled: isDarkMode ? '#5b6488' : '#ccc',
    statusBarBg: isDarkMode ? '#1f2438' : '#294380',
  };
  const styles = createStyles(palette);

  const pdfRef = useRef(null);



  const handleLoadComplete = (numberOfPages) => {
    setTotalPages(numberOfPages);
    setPdfLoading(false);
    setError(null);
  };

  const handlePageChanged = (page) => {
    setCurrentPage(page);
  };

  const handleError = (error) => {
    setError(error.message);
    setPdfLoading(false);
    Alert.alert('Erro ao carregar PDF', error.message);
  };

  const handleShare = async () => {
    try {
      setShareLoading(true);
      const fileUrl = pdfUri.startsWith('file://') ? pdfUri : `file://${pdfUri}`;
      await Share.open({
        url: fileUrl,
        type: 'application/pdf',
        title: 'Compartilhar PDF',
      });
    } catch (e) {
      Alert.alert('Erro ao compartilhar PDF', e.message);
    } finally {
      setShareLoading(false);
    }
  };

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      pdfRef.current?.setPage(page);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  };



  React.useEffect(() => {
    navigation.setOptions({
      ...createScreenHeaderTemplate({
        isDarkMode,
        lightHeaderColor: '#294380',
        darkHeaderColor: '#1f2438',
        tintColor: '#FFFFFF',
      }),
      headerTitle: () =>
        createHeaderTitleTemplate({
          title: 'Visualizar PDF',
          iconName: 'picture-as-pdf',
          tintColor: '#FFFFFF',
        }),

    });
  }, [navigation, isDarkMode]);

  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <View style={styles.errorContent}>
          <MaterialCommunityIcons name="file-pdf-box" size={80} color="#d7263d" />
          <Text style={styles.errorTitle}>Erro ao carregar PDF</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="arrow-left" size={20} color="#fff" />
            <Text style={styles.retryButtonText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={palette.statusBarBg} barStyle="light-content" />

      {/* Área principal do PDF */}
      <View style={styles.pdfContainer}>
        <Pdf
          ref={pdfRef}
          source={{ uri: pdfUri }}
          style={styles.pdf}
          onLoadComplete={(numberOfPages, filePath) => {
            setTotalPages(numberOfPages);
            setCurrentPage(1);
            console.log('PDF carregado:', numberOfPages, filePath);
          }}
          onPageChanged={(page, numberOfPages) => {
            setCurrentPage(page);
            setTotalPages(numberOfPages);
            console.log('Página alterada:', page, numberOfPages);
          }}
          onError={handleError}
          enablePaging={true}
          enableAnnotationRendering={true}
          enableAntialiasing={true}
          enableCaching={true}
          cachePolicy="cacheThenNetwork"
          activityIndicator={
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#d7263d" />
              <Text style={styles.loadingText}>Carregando PDF...</Text>
            </View>
          }
        />
      </View>

      {/* Controles de navegação */}
      <View style={styles.controlsContainer}>
        <View style={styles.pageInfo}>
          <Text style={styles.pageText}>
            Página {currentPage} de {totalPages}
          </Text>
        </View>
        
        <View style={styles.navigationControls}>
          <TouchableOpacity
            style={[styles.navButton, currentPage <= 1 && styles.navButtonDisabled]}
            onPress={goToPreviousPage}
            disabled={currentPage <= 1}
          >
            <MaterialCommunityIcons name="chevron-left" size={24} color={currentPage <= 1 ? palette.navIconDisabled : palette.navIcon} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navButton, currentPage >= totalPages && styles.navButtonDisabled]}
            onPress={goToNextPage}
            disabled={currentPage >= totalPages}
          >
            <MaterialCommunityIcons name="chevron-right" size={24} color={currentPage >= totalPages ? palette.navIconDisabled : palette.navIcon} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Botão de compartilhar flutuante */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={handleShare}
        disabled={shareLoading}
      >
        {shareLoading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <MaterialCommunityIcons name="share-variant" size={24} color="#fff" />
        )}
      </TouchableOpacity>


    </SafeAreaView>
  );
};



const createStyles = (palette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  pdfContainer: {
    flex: 1,
    backgroundColor: palette.pdfBg,
  },
  pdf: {
    flex: 1,
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.pdfBg,
  },
  loadingText: {
    color: palette.muted,
    marginTop: 16,
    fontSize: 16,
  },
  controlsContainer: {
    backgroundColor: palette.surface,
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pageInfo: {
    flex: 1,
  },
  pageText: {
    fontSize: 16,
    color: palette.text,
    fontWeight: '600',
  },
  navigationControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.navButton,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 5,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  navButtonDisabled: {
    backgroundColor: palette.navButtonDisabled,
    elevation: 0,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 100,
    backgroundColor: '#d7263d',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  errorContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: palette.text,
    marginTop: 20,
    marginBottom: 10,
  },
  errorMessage: {
    fontSize: 16,
    color: palette.muted,
    textAlign: 'center',
    marginBottom: 30,
  },
  retryButton: {
    backgroundColor: '#d7263d',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },

});

export default PdfViewerScreen; 
