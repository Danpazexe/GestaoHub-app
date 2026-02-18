import React from 'react';
import { View, Text, StyleSheet, Image, Modal, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { CORESPRODUCTITEM } from '../coresAuth';
import { getSignedProductImageUrl } from '../../services/supabaseStorageService';
import ReactNativeBlobUtil from 'react-native-blob-util';

const COLORS = CORESPRODUCTITEM;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MODAL_IMAGE_WIDTH = Math.floor(SCREEN_WIDTH * 0.9);
const MODAL_IMAGE_HEIGHT = Math.floor(SCREEN_HEIGHT * 0.72);

// Componente para exibir detalhes sobre um produto
const ProductItem = ({ product, isDarkMode }) => {
  const [modalVisible, setModalVisible] = React.useState(false);
  const [imageLoadFailed, setImageLoadFailed] = React.useState(false);
  const [resolvedImageUrl, setResolvedImageUrl] = React.useState('');
  const [isResolvingImage, setIsResolvingImage] = React.useState(false);
  const [isModalImageLoading, setIsModalImageLoading] = React.useState(false);
  const [hasRetriedSignedUrl, setHasRetriedSignedUrl] = React.useState(false);
  const [localModalImageUri, setLocalModalImageUri] = React.useState('');

  // Função melhorada para determinar o texto e cor da validade
  const getDaysToExpirationText = (days) => {
    if (days < 0) {
      return {
        number: 'VENCIDO',
        label: `${Math.abs(days)} dia(s)`,
        color: COLORS.white,
        backgroundColor: COLORS.badgeExpired,
        icon: 'warning',
        status: 'Produto Vencido'
      };
    } else if (days === 0) {
      return {
        number: 'VENCE',
        label: 'HOJE',
        color: COLORS.white,
        backgroundColor: COLORS.badgeToday,
        icon: 'error',
        status: 'Vencendo Hoje'
      };
    } else if (days > 0 && days <= 7) {
      return {
        number: days.toString(),
        label: 'DIAS',
        color: COLORS.white,
        backgroundColor: COLORS.badgeWeek,
        icon: 'schedule',
        status: `Vence em ${days} dias`
      };
    } else if (days > 7 && days <= 15) {
      return {
        number: days.toString(),
        label: 'DIAS',
        color: COLORS.white,
        backgroundColor: COLORS.badgeFifteen,
        icon: 'event',
        status: `Vence em ${days} dias`
      };
    } else if (days > 15 && days <= 30) {
      return {
        number: days.toString(),
        label: 'DIAS',
        color: COLORS.white,
        backgroundColor: COLORS.badgeMonth,
        icon: 'check-circle',
        status: `Vence em ${days} dias`
      };
    } else {
      return {
        number: days.toString(),
        label: 'DIAS',
        color: COLORS.white,
        backgroundColor: COLORS.badgeFuture,
        icon: 'check-circle',
        status: `Vence em ${days} dias`
      };
    }
  };

  // Cálculo dos dias restantes
  const calcularDiasRestantes = () => {
    try {
      // Converte a string de data para partes
      const [dia, mes, ano] = product.validade.split('/').map(Number);

      // Cria as datas
      const hoje = new Date();
      const dataValidade = new Date(ano, mes - 1, dia); // mes - 1 porque em JS os meses começam do 0

      // Reseta as horas para comparar apenas as datas
      hoje.setHours(0, 0, 0, 0);
      dataValidade.setHours(0, 0, 0, 0);

      // Calcula a diferença em dias
      const diffTime = dataValidade.getTime() - hoje.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      return diffDays;
    } catch (error) {
      console.error('Erro ao calcular dias restantes:', error);
      return 0;
    }
  };

  const diffDays = calcularDiasRestantes();
  const expirationInfo = getDaysToExpirationText(diffDays);

  const rawImageValue = product.imageUrl || product.imagePath || product.foto || '';
  const imagePathValue = product.imagePath ? String(product.imagePath) : '';

  React.useEffect(() => {
    let active = true;
    const resolveImage = async () => {
      setImageLoadFailed(false);
      setHasRetriedSignedUrl(false);

      if (!rawImageValue) {
        setResolvedImageUrl('');
        setIsResolvingImage(false);
        return;
      }

      const value = String(rawImageValue);
      const isHttp = value.startsWith('http://') || value.startsWith('https://');
      const isLocal = value.startsWith('file://') || value.startsWith('content://') || value.startsWith('/');

      if (isHttp || isLocal) {
        setResolvedImageUrl(value);
        setIsResolvingImage(false);
        return;
      }

      if (imagePathValue) {
        setIsResolvingImage(true);
        try {
          const signedUrl = await getSignedProductImageUrl(imagePathValue, 7 * 24 * 3600);
          if (active) {
            setResolvedImageUrl(signedUrl || '');
          }
        } catch (error) {
          if (active) {
            setResolvedImageUrl('');
          }
        } finally {
          if (active) {
            setIsResolvingImage(false);
          }
        }
        return;
      }

      const isStoragePath = !isHttp && !isLocal;

      if (!isStoragePath) {
        setResolvedImageUrl(value);
        setIsResolvingImage(false);
        return;
      }

      setIsResolvingImage(true);
      try {
        const signedUrl = await getSignedProductImageUrl(value, 7 * 24 * 3600);
        if (active) {
          setResolvedImageUrl(signedUrl || '');
        }
      } catch (error) {
        if (active) {
          setResolvedImageUrl('');
        }
      } finally {
        if (active) {
          setIsResolvingImage(false);
        }
      }
    };

    resolveImage();
    return () => {
      active = false;
    };
  }, [rawImageValue, imagePathValue]);

  const canRenderImage = Boolean(resolvedImageUrl) && !imageLoadFailed;
  React.useEffect(() => {
    setImageLoadFailed(false);
  }, [resolvedImageUrl]);
  React.useEffect(() => {
    if (!modalVisible) {
      setIsModalImageLoading(false);
      setLocalModalImageUri('');
    }
  }, [modalVisible]);

  React.useEffect(() => {
    let active = true;

    const prepareLocalModalImage = async () => {
      if (!modalVisible || !resolvedImageUrl) return;
      if (resolvedImageUrl.startsWith('file://') || resolvedImageUrl.startsWith('content://')) {
        setLocalModalImageUri(resolvedImageUrl);
        return;
      }

      try {
        const cacheDir = ReactNativeBlobUtil.fs.dirs.CacheDir;
        const localPath = `${cacheDir}/product_preview_${String(product?.id || 'default')}.jpg`;
        await ReactNativeBlobUtil.config({ fileCache: true, path: localPath }).fetch('GET', resolvedImageUrl);
        if (active) {
          setLocalModalImageUri(`file://${localPath}`);
        }
      } catch (error) {
        if (active) {
          setLocalModalImageUri('');
        }
      }
    };

    prepareLocalModalImage();
    return () => {
      active = false;
    };
  }, [modalVisible, resolvedImageUrl, product?.id]);

  const handleImageRenderError = React.useCallback(async () => {
    if (imagePathValue && !hasRetriedSignedUrl) {
      setHasRetriedSignedUrl(true);
      setIsResolvingImage(true);
      try {
        const renewedUrl = await getSignedProductImageUrl(imagePathValue, 7 * 24 * 3600, true);
        setResolvedImageUrl(renewedUrl || '');
        setImageLoadFailed(!renewedUrl);
      } catch (error) {
        setImageLoadFailed(true);
      } finally {
        setIsResolvingImage(false);
      }
      return;
    }
    setImageLoadFailed(true);
  }, [hasRetriedSignedUrl, imagePathValue]);

  return (
    <View style={styles.wrapper}>
      {/* Modal de visualização da imagem em tela cheia com zoom ou simples */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackground}>
          {/* Botão de fechar */}
          <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
            <MaterialIcons name="close" size={32} color={COLORS.white} />
          </TouchableOpacity>
          {isResolvingImage ? (
            <View style={styles.noImageContainer}>
              <ActivityIndicator size="large" color={COLORS.white} />
              <Text style={styles.noImageText}>Carregando imagem...</Text>
            </View>
          ) : canRenderImage ? (
            <View style={styles.previewContainer}>
              <Image
                source={{ uri: localModalImageUri || resolvedImageUrl }}
                style={styles.previewImage}
                onLoadStart={() => setIsModalImageLoading(true)}
                onLoadEnd={() => setIsModalImageLoading(false)}
                onError={() => {
                  setIsModalImageLoading(false);
                  handleImageRenderError();
                }}
              />
              {isModalImageLoading && (
                <View style={styles.previewLoadingOverlay}>
                  <ActivityIndicator size="large" color={COLORS.white} />
                </View>
              )}
            </View>
          ) : (
            <View style={styles.noImageContainer}>
              <Text style={styles.noImageText}>Imagem não disponível</Text>
            </View>
          )}
        </View>
      </Modal>
      {/* Card do Produto */}
      <View style={[styles.container, isDarkMode && styles.darkContainer]}>
        {/* Status de Validade - Badge dentro do card */}
        <View style={[
          styles.statusBadge,
          {
            backgroundColor: expirationInfo.backgroundColor,
          }
        ]}>
          <Text style={[
            styles.badgeText,
            { color: expirationInfo.color }
          ]}>
            {expirationInfo.status === 'Produto Vencido' ? 'VENCIDO' :
              expirationInfo.status === 'Vencendo Hoje' ? 'VENCE HOJE' :
                expirationInfo.status}
          </Text>
        </View>
        {/* Detalhes do Produto */}
        <View style={styles.productDetails}>
          {/* Informações do Produto */}
          <Text style={[styles.productName, isDarkMode && styles.darkProductName]} numberOfLines={2}>
            {product.descricao}
          </Text>
          {/* Detalhes do Produto em Grid */}
          <View style={styles.infoGrid}>
            <View style={styles.infoRow}>
              <MaterialIcons name="code" size={17} color={isDarkMode ? COLORS.iconDark : COLORS.icon} style={styles.icon} />
              <Text style={[styles.label, isDarkMode && styles.darkLabel]}>Código:</Text>
              <Text style={[styles.value, isDarkMode && styles.darkValue]}>{product.codprod}</Text>
            </View>

            <View style={styles.infoRow}>
              <MaterialIcons name="format-list-numbered" size={17} color={isDarkMode ? COLORS.iconDark : COLORS.icon} style={styles.icon} />
              <Text style={[styles.label, isDarkMode && styles.darkLabel]}>Qtd:</Text>
              <Text style={[styles.value, isDarkMode && styles.darkValue]}>{product.quantidade}</Text>
            </View>

            <View style={styles.infoRow}>
              <MaterialIcons name="qr-code" size={17} color={isDarkMode ? COLORS.iconDark : COLORS.icon} style={styles.icon} />
              <Text style={[styles.label, isDarkMode && styles.darkLabel]}>EAN:</Text>
              <Text style={[styles.value, isDarkMode && styles.darkValue]}>{product.codauxiliar}</Text>
            </View>

            <View style={styles.infoRow}>
              <MaterialIcons name="label" size={17} color={isDarkMode ? COLORS.iconDark : COLORS.icon} style={styles.icon} />
              <Text style={[styles.label, isDarkMode && styles.darkLabel]}>Lote:</Text>
              <Text style={[styles.value, isDarkMode && styles.darkValue]}>{product.lote}</Text>
            </View>

            <View style={styles.infoRow}>
              <MaterialIcons name="event" size={17} color={isDarkMode ? COLORS.iconDark : COLORS.icon} style={styles.icon} />
              <Text style={[styles.label, isDarkMode && styles.darkLabel]}>Validade:</Text>
              <Text style={[styles.value, isDarkMode && styles.darkValue]}>{product.validade}</Text>
            </View>
          </View>
        </View>
        {/* Imagem do Produto */}
        <View style={styles.imageWrapper}>
          {isResolvingImage ? (
            <View style={[styles.image, styles.placeholderImage, isDarkMode && styles.placeholderImageDark]}>
              <ActivityIndicator size="small" color={isDarkMode ? COLORS.labelDark : COLORS.label} />
            </View>
          ) : canRenderImage ? (
            <TouchableOpacity
              onPress={() => setModalVisible(true)}
            >
              <Image
                source={{ uri: resolvedImageUrl }}
                style={styles.image}
                resizeMode="cover"
                onError={handleImageRenderError}
              />
            </TouchableOpacity>
          ) : (
            <View style={[styles.image, styles.placeholderImage, isDarkMode && styles.placeholderImageDark]}>
              <MaterialIcons name="no-photography" size={38} color={isDarkMode ? COLORS.labelDark : COLORS.label} />
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    marginVertical: 4,
  },

  container: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 10,
    elevation: 3,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    position: 'relative',
  },
  darkContainer: {
    backgroundColor: COLORS.cardDark,
  },

  productDetails: {
    flex: 1,
    marginRight: 10,
    paddingTop: 6, // Espaço para o badge
  },

  productName: {
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 4,
    color: COLORS.title,
    lineHeight: 20,
  },
  darkProductName: {
    color: COLORS.titleDark,
  },

  infoGrid: {
    flexDirection: 'column',
    gap: 2,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 1,
  },

  icon: {
    marginRight: 6,
    width: 17,
  },

  label: {
    fontWeight: '600',
    fontSize: 14,
    color: COLORS.label,
    marginRight: 4,
  },
  darkLabel: {
    color: COLORS.labelDark,
  },

  value: {
    fontSize: 14,
    color: COLORS.value,
    fontWeight: '500',
  },
  darkValue: {
    color: COLORS.valueDark,
  },

  statusBadge: {
    position: 'absolute',
    top: 8,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    elevation: 4,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    zIndex: 10,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  imageWrapper: {
    marginLeft: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.imageBackground,
    borderWidth: 2,
    borderColor: COLORS.imageBorder,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.10,
    shadowRadius: 2,
  },
  placeholderImage: {
    backgroundColor: COLORS.imageBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderImageDark: {
    backgroundColor: COLORS.placeholderDark,
    borderColor: COLORS.placeholderBorderDark,
  },
  modalBackground: {
    flex: 1,
    backgroundColor: COLORS.modalBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    backgroundColor: COLORS.modalCloseBackground,
    borderRadius: 20,
    padding: 2,
  },
  previewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  previewImage: {
    width: MODAL_IMAGE_WIDTH,
    height: MODAL_IMAGE_HEIGHT,
    borderRadius: 10,
    resizeMode: 'contain',
  },
  previewLoadingOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageText: {
    color: COLORS.white,
    fontSize: 18,
  },
});

export default ProductItem;
