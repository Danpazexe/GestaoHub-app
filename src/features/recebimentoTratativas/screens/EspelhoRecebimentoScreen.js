import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { Camera } from 'react-native-vision-camera';
import { Modal, Portal } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-toast-message';
import ScreenLayout, {
  createHeaderActionsTemplate,
  createHeaderTitleTemplate,
  createScreenHeaderTemplate,
} from '../../../components/ScreenLayout';
import { isLocalImageUri, persistImageToAppStorage } from '../../../services/localImageService';
import {
  buildLookupSelection,
  findCachedProductByEan,
  searchCachedProducts,
} from '../../../services/productLookupService';
import {
  getSignedProductImageUrl,
  uploadProductImageToSupabase,
} from '../../../services/supabaseStorageService';
import { getCurrentUserId } from '../../../services/validadeSupabaseService';
import MultiSelectFieldModal from '../components/MultiSelectFieldModal';
import { DateField, FormField, SelectionGrid } from '../components/TratativaFormFields';
import TratativaSectionCard from '../components/TratativaSectionCard';
import TratativaTimeline from '../components/TratativaTimeline';
import {
  ACTION_OPTIONS,
  OCCURRENCE_OPTIONS,
  REASON_OPTIONS,
  STATUS_OPTIONS,
  TRATATIVA_THEME,
  formatDateTimePt,
  getActionMeta,
  getOccurrenceMeta,
  getStatusMeta,
  hasOtherSelection,
} from '../constants/tratativaOptions';
import { useTratativaValidation } from '../hooks/useTratativaValidation';
import {
  buildStandaloneCaseDraft,
  getTratativaCaseById,
  saveTratativaCase,
} from '../services/tratativaCaseService';
import { shareTratativaCasePdf } from '../services/tratativaPdfService';

const IMAGE_UPLOAD_QUALITY = 0.4;
const IMAGE_UPLOAD_MAX_WIDTH = 1024;
const IMAGE_UPLOAD_MAX_HEIGHT = 1024;

const DATE_FIELDS = [
  { key: 'opened_at', label: 'Data de abertura' },
  { key: 'started_at', label: 'Inicio da tratativa' },
  { key: 'expected_end_at', label: 'Previsao de conclusao' },
  { key: 'closed_at', label: 'Data de encerramento' },
];

const REQUIRED_FIELD_LABELS = {
  supplier_code: 'Código do fornecedor',
  origin_invoice_number: 'Nota de origem',
  codprod: 'Código interno',
  codauxiliar: 'EAN',
  descricao: 'Descrição',
  fornecedor: 'Fornecedor',
  validade: 'Validade',
  reasons: 'Motivos',
  return_invoice_number: 'Nota de devolução',
  observation: 'Observação',
  expected_quantity: 'Quantidade esperada',
  received_quantity: 'Quantidade recebida',
  affected_quantity: 'Quantidade com problema',
  product_image: 'Foto do produto',
};

const EspelhoRecebimentoScreen = ({ navigation, route, isDarkMode }) => {
  const caseId = route.params?.caseId ? String(route.params.caseId) : null;
  const searchTimeout = useRef(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [pickerField, setPickerField] = useState(null);
  const [showValidityPicker, setShowValidityPicker] = useState(false);
  const [showImageOptions, setShowImageOptions] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [activeSearchField, setActiveSearchField] = useState(null);
  const [resolvedImageUri, setResolvedImageUri] = useState('');
  const [showErrors, setShowErrors] = useState(false);

  const statusMeta = useMemo(() => getStatusMeta(form?.status), [form?.status]);
  const actionMeta = useMemo(() => getActionMeta(form?.resolution_type), [form?.resolution_type]);
  const occurrenceMeta = useMemo(() => getOccurrenceMeta(form?.occurrence_type), [form?.occurrence_type]);
  const lockSupplierCode = Boolean(form?.doc_number);
  const isShortage = form?.occurrence_type === 'falta';
  const requiresReturnInvoice = form?.resolution_type === 'devolucao';
  const missingQuantity = useMemo(() => {
    if (!form) return 0;
    const expected = Number(form.expected_quantity || 0);
    const received = Number(form.received_quantity || 0);
    return Math.max(expected - received, 0);
  }, [form]);

  const loadPayload = useCallback(async () => {
    setLoading(true);
    try {
      if (caseId) {
        const loadedCase = await getTratativaCaseById(caseId);
        if (!loadedCase) {
          throw new Error('Espelho de recebimento nao encontrado.');
        }
        setForm(loadedCase);
        return;
      }

      setForm(buildStandaloneCaseDraft());
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Falha ao abrir espelho',
        text2: error?.message || 'Nao foi possivel carregar o espelho.',
      });
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [caseId, navigation]);

  useEffect(() => {
    loadPayload();
  }, [loadPayload]);

  useEffect(() => {
    let active = true;

    const resolveImage = async () => {
      const snapshot = form?.product_snapshot;
      if (!snapshot) return;

      const direct = String(snapshot.imageUrl || '');
      const imagePath = String(snapshot.imagePath || '');

      if (
        direct.startsWith('http') ||
        direct.startsWith('file://') ||
        direct.startsWith('content://')
      ) {
        if (active) {
          setResolvedImageUri(direct);
        }
        return;
      }

      if (imagePath) {
        try {
          const signed = await getSignedProductImageUrl(imagePath, 7 * 24 * 3600);
          if (active) {
            setResolvedImageUri(signed || '');
          }
        } catch {
          if (active) {
            setResolvedImageUri('');
          }
        }
        return;
      }

      if (active) {
        setResolvedImageUri('');
      }
    };

    resolveImage();
    return () => {
      active = false;
    };
  }, [form]);

  useEffect(() => {
    if (!route.params?.barcodeData) return;

    const scannedCode = String(route.params.barcodeData || '').trim();
    if (!scannedCode) return;

    updateSnapshotField('codauxiliar', scannedCode);
    handleBarcodeLookup(scannedCode);
  }, [route.params?.barcodeData]);

  const handleShare = useCallback(async () => {
    if (!form) return;
    setSharing(true);
    try {
      await shareTratativaCasePdf(form);
    } catch (error) {
      Alert.alert('Erro ao compartilhar', error?.message || 'Nao foi possivel gerar o PDF.');
    } finally {
      setSharing(false);
    }
  }, [form]);

  useEffect(() => {
    navigation.setOptions({
      ...createScreenHeaderTemplate({
        isDarkMode,
        lightHeaderColor: TRATATIVA_THEME.primary,
        darkHeaderColor: TRATATIVA_THEME.primaryDark,
        tintColor: TRATATIVA_THEME.white,
        titleSize: 18,
        titleWeight: '700',
      }),
      headerTitle: () =>
        createHeaderTitleTemplate({
          title: caseId ? 'Espelho receb.' : 'Nova tratativa',
          subtitle: caseId
            ? `NF ${form?.origin_invoice_number || form?.doc_number || 'sem numero'}`
            : 'Recebimento avulso',
          iconName: 'assignment',
          tintColor: TRATATIVA_THEME.white,
        }),
      headerRight: () =>
        createHeaderActionsTemplate({
          isDarkMode,
          actions: [
            {
              key: 'share-case',
              iconName: 'share',
              onPress: () => handleShare(),
              isActive: sharing,
              iconColor: TRATATIVA_THEME.white,
              iconSize: 21,
            },
          ],
        }),
    });
  }, [caseId, form?.doc_number, form?.origin_invoice_number, handleShare, isDarkMode, navigation, sharing]);

  const updateField = useCallback((key, value) => {
    setForm((current) => {
      if (!current) return current;
      const next = {
        ...current,
        [key]: value,
        status_updated_at: new Date().toISOString(),
      };

      if (key === 'occurrence_type' && value !== 'falta') {
        next.expected_quantity = 0;
      }

      if (key === 'received_quantity') {
        next.product_snapshot = {
          ...(current.product_snapshot || {}),
          quantidade_original: Number(value || 0),
        };
      }

      if (key === 'expected_quantity' || key === 'received_quantity' || key === 'occurrence_type') {
        const expected = Number(key === 'expected_quantity' ? value : next.expected_quantity || 0);
        const received = Number(key === 'received_quantity' ? value : next.received_quantity || 0);

        if (key === 'occurrence_type' ? value === 'falta' : next.occurrence_type === 'falta') {
          next.affected_quantity = Math.max(expected - received, 0);
        }
      }

      return next;
    });
  }, []);

  const updateSnapshotField = useCallback((key, value) => {
    setForm((current) => {
      if (!current) return current;
      return {
        ...current,
        product_snapshot: {
          ...(current.product_snapshot || {}),
          [key]: value,
        },
      };
    });
  }, []);

  const handleSelectProduct = useCallback((product) => {
    const selection = buildLookupSelection(product);
    setForm((current) => {
      if (!current) return current;
      return {
        ...current,
        supplier_code: lockSupplierCode
          ? current.supplier_code
          : (current.supplier_code || selection.supplierCode || ''),
        product_snapshot: {
          ...(current.product_snapshot || {}),
          codprod: selection.codprod,
          codauxiliar: selection.codauxiliar,
          descricao: selection.descricao,
          fornecedor: selection.fornecedor || current.product_snapshot?.fornecedor || '',
        },
      };
    });
    setSearchResults([]);
    setActiveSearchField(null);
    Toast.show({
      type: 'success',
      text1: 'Produto localizado',
      text2: 'Código, EAN e descrição foram preenchidos.',
    });
  }, [lockSupplierCode]);

  const handleBarcodeLookup = useCallback(async (eanValue) => {
    try {
      const product = await findCachedProductByEan(eanValue);
      if (product) {
        handleSelectProduct(product);
        return;
      }

      Toast.show({
        type: 'info',
        text1: 'EAN recebido',
        text2: 'Nenhum produto foi encontrado no cache. Você pode completar manualmente.',
      });
    } catch (error) {
      console.error('Erro ao buscar produto por EAN:', error);
    }
  }, [handleSelectProduct]);

  const performSearch = useCallback((query, field) => {
    const sanitized = field === 'descricao' ? query : query.replace(/[^0-9]/g, '');

    if (field === 'descricao') updateSnapshotField('descricao', query);
    if (field === 'codprod') updateSnapshotField('codprod', sanitized);
    if (field === 'codauxiliar') updateSnapshotField('codauxiliar', sanitized);

    setActiveSearchField(field);

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    const cleanQuery = String(query || '').trim();
    if (!cleanQuery) {
      setSearchResults([]);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      try {
        const results = await searchCachedProducts(cleanQuery, 15);
        setSearchResults(results);
      } catch (error) {
        console.error('Erro ao pesquisar produto:', error);
      }
    }, 280);
  }, [updateSnapshotField]);

  const handleDateChange = useCallback((_, selectedDate) => {
    if (!pickerField) return;
    setPickerField(null);
    if (!selectedDate) return;
    updateField(pickerField, selectedDate.toISOString());
  }, [pickerField, updateField]);

  const handleValidityChange = useCallback((_, selectedDate) => {
    setShowValidityPicker(false);
    if (!selectedDate) return;
    updateSnapshotField('validade', selectedDate.toISOString());
  }, [updateSnapshotField]);

  const ensureCameraPermission = useCallback(async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Permissão da câmera',
          message: 'Precisamos da câmera para capturar a foto da mercadoria.',
          buttonPositive: 'Permitir',
          buttonNegative: 'Negar',
        },
      );

      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        return true;
      }

      if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        Alert.alert(
          'Permissão bloqueada',
          'Ative a câmera nas configurações do app para continuar.',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Abrir configurações', onPress: () => Linking.openSettings() },
          ],
        );
      }

      return false;
    }

    const permission = await Camera.requestCameraPermission();
    return permission === 'authorized' || permission === 'granted' || permission === true;
  }, []);

  const handleTakePhoto = useCallback(async () => {
    try {
      const allowed = await ensureCameraPermission();
      if (!allowed) return;

      const result = await launchCamera({
        mediaType: 'photo',
        quality: IMAGE_UPLOAD_QUALITY,
        maxWidth: IMAGE_UPLOAD_MAX_WIDTH,
        maxHeight: IMAGE_UPLOAD_MAX_HEIGHT,
        assetRepresentationMode: 'compatible',
        saveToPhotos: true,
      });

      if (result?.didCancel) return;
      if (result?.errorCode) {
        throw new Error(result?.errorMessage || 'Falha ao abrir câmera.');
      }

      const imageUri = result?.assets?.[0]?.uri;
      if (!imageUri) {
        throw new Error('Nenhuma imagem foi retornada pela câmera.');
      }

      const persisted = await persistImageToAppStorage(imageUri);
      updateSnapshotField('imageUrl', persisted);
      updateSnapshotField('imagePath', '');
      setShowImageOptions(false);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Falha ao capturar foto',
        text2: error?.message || 'Nao foi possivel abrir a câmera.',
      });
    }
  }, [ensureCameraPermission, updateSnapshotField]);

  const handleChooseFromGallery = useCallback(async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: IMAGE_UPLOAD_QUALITY,
        maxWidth: IMAGE_UPLOAD_MAX_WIDTH,
        maxHeight: IMAGE_UPLOAD_MAX_HEIGHT,
        assetRepresentationMode: 'compatible',
      });

      if (result?.didCancel) return;
      const imageUri = result?.assets?.[0]?.uri;
      if (!imageUri) {
        throw new Error('Nenhuma imagem foi selecionada.');
      }

      const persisted = await persistImageToAppStorage(imageUri);
      updateSnapshotField('imageUrl', persisted);
      updateSnapshotField('imagePath', '');
      setShowImageOptions(false);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Falha ao selecionar foto',
        text2: error?.message || 'Nao foi possivel usar a galeria.',
      });
    }
  }, [updateSnapshotField]);

  const handleScanBarcode = useCallback(async () => {
    try {
      const currentStatus = Camera.getCameraPermissionStatus();
      if (currentStatus === 'granted' || currentStatus === true || currentStatus === 'authorized') {
        navigation.navigate('BarcodeScannerScreen', {
          targetScreen: 'EspelhoRecebimentoScreen',
          paramName: 'barcodeData',
          extraParams: caseId ? { caseId } : {},
        });
        return;
      }

      const requestStatus = await Camera.requestCameraPermission();
      if (requestStatus === true || requestStatus === 'authorized' || requestStatus === 'granted') {
        navigation.navigate('BarcodeScannerScreen', {
          targetScreen: 'EspelhoRecebimentoScreen',
          paramName: 'barcodeData',
          extraParams: caseId ? { caseId } : {},
        });
        return;
      }

      Alert.alert('Câmera', 'Habilite o acesso à câmera nas configurações.');
    } catch {
      Toast.show({ type: 'error', text1: 'Erro', text2: 'Scanner não iniciou.' });
    }
  }, [caseId, navigation]);

  const {
    buildValidationErrors,
    getFieldErrors,
    validate,
  } = useTratativaValidation({
    form,
    showErrors,
    requiredLabels: REQUIRED_FIELD_LABELS,
  });

  const prepareFormForSave = useCallback(async () => {
    if (!form) return form;

    const normalizedReceived = Number(form.received_quantity || 0);
    const normalizedExpected = Number(form.expected_quantity || 0);
    const normalizedAffected = isShortage
      ? Math.max(normalizedExpected - normalizedReceived, 0)
      : Number(form.affected_quantity || 0);

    let nextSnapshot = {
      ...(form.product_snapshot || {}),
      quantidade_original: normalizedReceived,
    };

    if (isLocalImageUri(nextSnapshot.imageUrl)) {
      try {
        const userId = await getCurrentUserId();
        const imagePath = await uploadProductImageToSupabase({
          userId,
          productId: String(form.id || Date.now()),
          localUri: nextSnapshot.imageUrl,
        });
        const signedUrl = await getSignedProductImageUrl(imagePath, 7 * 24 * 3600);
        nextSnapshot = {
          ...nextSnapshot,
          imagePath,
          imageUrl: signedUrl || nextSnapshot.imageUrl,
        };
      } catch (error) {
        console.warn('Falha ao sincronizar imagem da tratativa.', error?.message || error);
      }
    }

    return {
      ...form,
      affected_quantity: normalizedAffected,
      expected_quantity: isShortage ? normalizedExpected : 0,
      received_quantity: normalizedReceived,
      product_snapshot: nextSnapshot,
    };
  }, [form, isShortage]);

  const handleSave = useCallback(async () => {
    setShowErrors(true);
    const validationError = validate();
    if (validationError) {
      Toast.show({
        type: 'error',
        text1: 'Preencha os campos obrigatórios',
        text2: validationError,
      });
      return;
    }

    setSaving(true);
    try {
      const preparedForm = await prepareFormForSave();
      const result = await saveTratativaCase(preparedForm);
      setForm(result.caseItem);
      Toast.show({
        type: 'success',
        text1: 'Tratativa salva',
        text2: result.remoteSynced
          ? 'Espelho salvo e sincronizado.'
          : 'Espelho salvo localmente e pendente de sincronização.',
      });

      if (caseId) {
        navigation.goBack();
        return;
      }

      navigation.replace('ConferenciaTratativasRecebimentoScreen');
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erro ao salvar',
        text2: error?.message || 'Nao foi possivel salvar a tratativa.',
      });
    } finally {
      setSaving(false);
    }
  }, [caseId, navigation, prepareFormForSave, validate]);

  const renderSuggestions = (field) => {
    if (searchResults.length === 0 || activeSearchField !== field) return null;

    return (
      <View
        style={[
          styles.suggestionsContainer,
          {
            backgroundColor: isDarkMode ? '#2b3350' : '#ffffff',
            borderColor: isDarkMode ? TRATATIVA_THEME.borderDark : TRATATIVA_THEME.border,
          },
        ]}
      >
        <ScrollView
          style={{ maxHeight: 230 }}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          {searchResults.map((item, index) => {
            const selection = buildLookupSelection(item);
            return (
              <TouchableOpacity
                key={`${selection.codprod}-${selection.codauxiliar}-${index}`}
                style={styles.suggestionItem}
                onPress={() => handleSelectProduct(item)}
              >
                <View style={styles.suggestionIcon}>
                  <MaterialCommunityIcons
                    name="package-variant-closed"
                    size={20}
                    color={isDarkMode ? '#d6dbf1' : TRATATIVA_THEME.primary}
                  />
                </View>
                <View style={styles.suggestionTextContainer}>
                  <Text
                    style={[
                      styles.suggestionTitle,
                      { color: isDarkMode ? TRATATIVA_THEME.textDark : TRATATIVA_THEME.text },
                    ]}
                    numberOfLines={1}
                  >
                    {selection.descricao || 'Produto sem descrição'}
                  </Text>
                  <Text
                    style={[
                      styles.suggestionSubtitle,
                      { color: isDarkMode ? TRATATIVA_THEME.textMutedDark : TRATATIVA_THEME.textMuted },
                    ]}
                  >
                    Cód: {selection.codprod || '—'} | EAN: {selection.codauxiliar || '—'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  if (loading || !form) {
    return (
      <ScreenLayout
        isDarkMode={isDarkMode}
        lightBackground={TRATATIVA_THEME.background}
        darkBackground={TRATATIVA_THEME.backgroundDark}
        contentStyle={styles.centered}
      >
        <ActivityIndicator size="large" color={TRATATIVA_THEME.primary} />
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout
      isDarkMode={isDarkMode}
      lightBackground={TRATATIVA_THEME.background}
      darkBackground={TRATATIVA_THEME.backgroundDark}
      contentStyle={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <TratativaSectionCard
          title="Resumo da ocorrência"
          subtitle="Documento, status e notas fiscais do processo de recebimento."
          isDarkMode={isDarkMode}
        >
          <View style={styles.summaryTop}>
            <View style={[styles.docCard, { backgroundColor: isDarkMode ? '#2b3350' : '#fbf1f1' }]}>
              <Text style={[styles.docLabel, { color: isDarkMode ? TRATATIVA_THEME.textMutedDark : TRATATIVA_THEME.textMuted }]}>Documento</Text>
              <Text style={[styles.docValue, { color: isDarkMode ? TRATATIVA_THEME.textDark : TRATATIVA_THEME.text }]}>
                {form.doc_number || 'Será gerado ao salvar'}
              </Text>
            </View>
            <View style={[styles.docCard, { backgroundColor: statusMeta.background }]}>
              <Text style={[styles.docLabel, { color: statusMeta.color }]}>Status atual</Text>
              <Text style={[styles.docValue, { color: statusMeta.color }]}>{statusMeta.label}</Text>
            </View>
          </View>

          <View style={styles.statusRow}>
            {STATUS_OPTIONS.map((item) => {
              const selected = form.status === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => updateField('status', item.key)}
                  style={[
                    styles.statusButton,
                    {
                      backgroundColor: item.background,
                      borderColor: selected ? item.color : 'transparent',
                    },
                  ]}
                >
                  <Text style={[styles.statusButtonText, { color: item.color }]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <FormField
            label="Nota de origem"
            value={form.origin_invoice_number}
            onChangeText={(value) => updateField('origin_invoice_number', value)}
            placeholder="Ex.: 123456"
            isDarkMode={isDarkMode}
            required
            error={getFieldErrors.origin_invoice_number}
          />
          <FormField
            label="Nota de devolução"
            value={form.return_invoice_number}
            onChangeText={(value) => updateField('return_invoice_number', value)}
            placeholder={requiresReturnInvoice ? 'Obrigatória para devolução' : 'Preencha quando houver'}
            isDarkMode={isDarkMode}
            required={requiresReturnInvoice}
            error={getFieldErrors.return_invoice_number}
          />

          <Text style={[styles.metaInfo, { color: isDarkMode ? TRATATIVA_THEME.textMutedDark : TRATATIVA_THEME.textMuted }]}>
            Última atualização: {formatDateTimePt(form.status_updated_at)}
          </Text>
        </TratativaSectionCard>

        <TratativaSectionCard
          title="Mercadoria e fornecedor"
          subtitle="Cadastro manual com apoio do lookup local e captura de imagem."
          isDarkMode={isDarkMode}
        >
          <View style={styles.productHeader}>
            <View
              style={[
                styles.imageFrame,
                {
                  backgroundColor: isDarkMode ? '#2b3350' : '#f8fafc',
                  borderColor: getFieldErrors.product_image
                    ? '#dc2626'
                    : isDarkMode
                      ? TRATATIVA_THEME.borderDark
                      : TRATATIVA_THEME.border,
                },
              ]}
            >
              {resolvedImageUri ? (
                <Image source={{ uri: resolvedImageUri }} style={styles.productImage} />
              ) : (
                <MaterialIcons name="inventory-2" size={40} color={TRATATIVA_THEME.textMuted} />
              )}
            </View>
            <View style={styles.productHeaderContent}>
              <Text style={[styles.productTitle, { color: isDarkMode ? TRATATIVA_THEME.textDark : TRATATIVA_THEME.text }]}>
                {form.product_snapshot?.descricao || 'Mercadoria sem descrição'}
              </Text>
              <Text style={[styles.productSubtitle, { color: isDarkMode ? TRATATIVA_THEME.textMutedDark : TRATATIVA_THEME.textMuted }]}>
                {form.product_snapshot?.fornecedor || 'Fornecedor não informado'}
              </Text>
              <View style={styles.imageActionsRow}>
                <TouchableOpacity style={styles.imageActionButton} onPress={() => setShowImageOptions(true)}>
                  <MaterialIcons name={resolvedImageUri ? 'edit' : 'add-a-photo'} size={18} color={TRATATIVA_THEME.primary} />
                  <Text style={styles.imageActionText}>{resolvedImageUri ? 'Editar foto' : 'Adicionar foto'}</Text>
                </TouchableOpacity>
                {resolvedImageUri ? (
                  <TouchableOpacity
                    style={styles.imageActionButton}
                    onPress={() => {
                      updateSnapshotField('imageUrl', '');
                      updateSnapshotField('imagePath', '');
                    }}
                  >
                    <MaterialIcons name="delete-outline" size={18} color="#dc2626" />
                    <Text style={[styles.imageActionText, { color: '#dc2626' }]}>Remover</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {getFieldErrors.product_image ? <Text style={styles.errorText}>{getFieldErrors.product_image}</Text> : null}
            </View>
          </View>

          <FormField
            label="Código do fornecedor"
            value={form.supplier_code}
            onChangeText={(value) => updateField('supplier_code', value.replace(/[^\d]/g, ''))}
            placeholder="Ex.: 11"
            keyboardType="numeric"
            editable={!lockSupplierCode}
            isDarkMode={isDarkMode}
            required
            error={getFieldErrors.supplier_code}
            helperText={lockSupplierCode ? 'Bloqueado após a geração do número da tratativa.' : 'Usado para gerar o número TR por fornecedor.'}
          />

          <FormField
            label="Código interno"
            value={form.product_snapshot?.codprod}
            onChangeText={(value) => performSearch(value, 'codprod')}
            placeholder="Digite para buscar ou preencher manualmente"
            keyboardType="numeric"
            isDarkMode={isDarkMode}
            required
            error={getFieldErrors.codprod}
          />
          {renderSuggestions('codprod')}

          <FormField
            label="EAN"
            value={form.product_snapshot?.codauxiliar}
            onChangeText={(value) => performSearch(value, 'codauxiliar')}
            placeholder="Use o scanner ou digite o EAN"
            keyboardType="numeric"
            isDarkMode={isDarkMode}
            required
            error={getFieldErrors.codauxiliar}
            rightAdornment={(
              <TouchableOpacity onPress={handleScanBarcode} style={styles.inlineActionButton}>
                <MaterialCommunityIcons name="barcode-scan" size={22} color={TRATATIVA_THEME.white} />
              </TouchableOpacity>
            )}
          />
          {renderSuggestions('codauxiliar')}

          <FormField
            label="Descrição"
            value={form.product_snapshot?.descricao}
            onChangeText={(value) => performSearch(value, 'descricao')}
            placeholder="Descrição da mercadoria"
            isDarkMode={isDarkMode}
            required
            error={getFieldErrors.descricao}
          />
          {renderSuggestions('descricao')}

          <FormField
            label="Fornecedor"
            value={form.product_snapshot?.fornecedor}
            onChangeText={(value) => updateSnapshotField('fornecedor', value)}
            placeholder="Fornecedor responsável"
            isDarkMode={isDarkMode}
            required
            error={getFieldErrors.fornecedor}
          />

          <FormField
            label="Lote"
            value={form.product_snapshot?.lote}
            onChangeText={(value) => updateSnapshotField('lote', value)}
            placeholder="Lote, quando houver"
            isDarkMode={isDarkMode}
          />

          <DateField
            label="Validade"
            value={form.product_snapshot?.validade}
            onPress={() => setShowValidityPicker(true)}
            isDarkMode={isDarkMode}
            required
            error={getFieldErrors.validade}
          />
        </TratativaSectionCard>

        <TratativaSectionCard
          title="Ocorrência e desfecho"
          subtitle="Classifique a ocorrência, registre as quantidades e defina o desfecho."
          isDarkMode={isDarkMode}
        >
          <SelectionGrid
            label="Tipo de ocorrência"
            options={OCCURRENCE_OPTIONS}
            selectedValue={form.occurrence_type}
            onSelect={(value) => updateField('occurrence_type', value)}
            isDarkMode={isDarkMode}
            required
          />

          <SelectionGrid
            label="Desfecho"
            options={ACTION_OPTIONS}
            selectedValue={form.resolution_type}
            onSelect={(value) => updateField('resolution_type', value)}
            isDarkMode={isDarkMode}
            required
          />

          {isShortage ? (
            <>
              <FormField
                label="Quantidade esperada"
                value={String(form.expected_quantity || '')}
                onChangeText={(value) => updateField('expected_quantity', value.replace(/[^0-9]/g, ''))}
                placeholder="0"
                keyboardType="numeric"
                isDarkMode={isDarkMode}
                required
                error={getFieldErrors.expected_quantity}
              />
              <FormField
                label="Quantidade recebida"
                value={String(form.received_quantity || '')}
                onChangeText={(value) => updateField('received_quantity', value.replace(/[^0-9]/g, ''))}
                placeholder="0"
                keyboardType="numeric"
                isDarkMode={isDarkMode}
                required
                error={getFieldErrors.received_quantity}
              />
              <FormField
                label="Quantidade faltante"
                value={String(missingQuantity || '')}
                onChangeText={() => {}}
                placeholder="0"
                keyboardType="numeric"
                editable={false}
                isDarkMode={isDarkMode}
                required
                error={getFieldErrors.affected_quantity}
                helperText="Calculada automaticamente pela diferença entre esperado e recebido."
              />
            </>
          ) : (
            <>
              <FormField
                label="Quantidade recebida"
                value={String(form.received_quantity || '')}
                onChangeText={(value) => updateField('received_quantity', value.replace(/[^0-9]/g, ''))}
                placeholder="0"
                keyboardType="numeric"
                isDarkMode={isDarkMode}
                required
                error={getFieldErrors.received_quantity}
              />
              <FormField
                label="Quantidade com problema"
                value={String(form.affected_quantity || '')}
                onChangeText={(value) => updateField('affected_quantity', value.replace(/[^0-9]/g, ''))}
                placeholder="0"
                keyboardType="numeric"
                isDarkMode={isDarkMode}
                required
                error={getFieldErrors.affected_quantity}
              />
            </>
          )}

          <MultiSelectFieldModal
            label="Motivos"
            placeholder="Selecione um ou mais motivos"
            options={REASON_OPTIONS}
            selectedValues={form.reasons}
            onApply={(values) => updateField('reasons', values)}
            isDarkMode={isDarkMode}
          />
          {getFieldErrors.reasons ? <Text style={styles.errorText}>{getFieldErrors.reasons}</Text> : null}

          <Text style={[styles.operationInfo, { color: occurrenceMeta.color }]}>
            Ocorrência: {occurrenceMeta.label} | Desfecho: <Text style={{ color: actionMeta.color }}>{actionMeta.label}</Text>
          </Text>
        </TratativaSectionCard>

        <TratativaSectionCard
          title="Cronograma da tratativa"
          subtitle="As datas alimentam a timeline e o progresso visual do espelho."
          isDarkMode={isDarkMode}
        >
          <View style={styles.dateGrid}>
            {DATE_FIELDS.map((field) => (
              <DateField
                key={field.key}
                label={field.label}
                value={form[field.key]}
                onPress={() => setPickerField(field.key)}
                isDarkMode={isDarkMode}
              />
            ))}
          </View>
          <TratativaTimeline caseItem={form} isDarkMode={isDarkMode} />
        </TratativaSectionCard>

        <TratativaSectionCard
          title="Detalhes e responsáveis"
          subtitle="Registro livre do histórico da ocorrência, autorização e coleta."
          isDarkMode={isDarkMode}
        >
          <FormField
            label="Observação"
            value={form.observation}
            onChangeText={(value) => updateField('observation', value)}
            placeholder="Descreva a ocorrência, conversa com o fornecedor e decisões tomadas."
            multiline
            isDarkMode={isDarkMode}
            required={hasOtherSelection(form.reasons)}
            error={getFieldErrors.observation}
          />
          <FormField
            label="Autorizado por"
            value={form.authorized_by}
            onChangeText={(value) => updateField('authorized_by', value)}
            placeholder="Nome e cargo"
            isDarkMode={isDarkMode}
          />
          <FormField
            label="Recolhido por"
            value={form.collected_by}
            onChangeText={(value) => updateField('collected_by', value)}
            placeholder="Transportadora, motorista ou responsável"
            isDarkMode={isDarkMode}
          />
        </TratativaSectionCard>

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: saving ? TRATATIVA_THEME.primaryDark : TRATATIVA_THEME.primary }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color={TRATATIVA_THEME.white} /> : <Text style={styles.saveButtonText}>Salvar espelho</Text>}
        </TouchableOpacity>
      </ScrollView>

      {pickerField ? (
        <DateTimePicker
          value={form[pickerField] ? new Date(form[pickerField]) : new Date()}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      ) : null}

      {showValidityPicker ? (
        <DateTimePicker
          value={form.product_snapshot?.validade ? new Date(form.product_snapshot.validade) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleValidityChange}
          locale="pt-BR"
        />
      ) : null}

      <Portal>
        <Modal
          visible={showImageOptions}
          onDismiss={() => setShowImageOptions(false)}
          contentContainerStyle={[
            styles.bottomSheet,
            { backgroundColor: isDarkMode ? TRATATIVA_THEME.cardDark : TRATATIVA_THEME.card },
          ]}
        >
          <Text style={[styles.sheetTitle, { color: isDarkMode ? TRATATIVA_THEME.textDark : TRATATIVA_THEME.text }]}>
            Foto da mercadoria
          </Text>
          <Text style={[styles.sheetSubtitle, { color: isDarkMode ? TRATATIVA_THEME.textMutedDark : TRATATIVA_THEME.textMuted }]}>
            Como deseja adicionar a imagem?
          </Text>

          <TouchableOpacity style={styles.sheetButton} onPress={handleTakePhoto}>
            <View style={styles.sheetIconContainer}>
              <MaterialCommunityIcons name="camera" size={22} color={TRATATIVA_THEME.white} />
            </View>
            <Text style={[styles.sheetButtonText, { color: isDarkMode ? TRATATIVA_THEME.textDark : TRATATIVA_THEME.text }]}>
              Tirar foto agora
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sheetButton} onPress={handleChooseFromGallery}>
            <View style={styles.sheetIconContainer}>
              <MaterialCommunityIcons name="image-multiple" size={22} color={TRATATIVA_THEME.white} />
            </View>
            <Text style={[styles.sheetButtonText, { color: isDarkMode ? TRATATIVA_THEME.textDark : TRATATIVA_THEME.text }]}>
              Escolher da galeria
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sheetButton, styles.sheetCancelButton]}
            onPress={() => setShowImageOptions(false)}
          >
            <View style={[styles.sheetIconContainer, { backgroundColor: '#64748b' }]}>
              <MaterialIcons name="close" size={22} color={TRATATIVA_THEME.white} />
            </View>
            <Text style={[styles.sheetButtonText, { color: isDarkMode ? TRATATIVA_THEME.textDark : TRATATIVA_THEME.text }]}>
              Cancelar
            </Text>
          </TouchableOpacity>
        </Modal>
      </Portal>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 28,
  },
  summaryTop: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  docCard: {
    flex: 1,
    borderRadius: 18,
    padding: 16,
  },
  docLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  docValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  statusButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  statusButtonText: {
    fontSize: 12,
    fontWeight: '800',
  },
  metaInfo: {
    fontSize: 12,
  },
  productHeader: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 14,
  },
  imageFrame: {
    width: 104,
    height: 104,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productHeaderContent: {
    flex: 1,
    justifyContent: 'center',
  },
  productTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  productSubtitle: {
    marginTop: 4,
    fontSize: 13,
  },
  imageActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  imageActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  imageActionText: {
    color: TRATATIVA_THEME.primary,
    fontWeight: '700',
  },
  inlineActionButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TRATATIVA_THEME.primary,
  },
  errorText: {
    marginTop: 6,
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '600',
  },
  operationInfo: {
    marginTop: 4,
    fontWeight: '800',
  },
  dateGrid: {
    gap: 12,
    marginBottom: 16,
  },
  saveButton: {
    minHeight: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  suggestionsContainer: {
    borderRadius: 16,
    borderWidth: 1,
    marginTop: -4,
    marginBottom: 12,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d0d5dd',
  },
  suggestionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff1eb',
  },
  suggestionTextContainer: {
    flex: 1,
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  suggestionSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  bottomSheet: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 18,
    borderRadius: 24,
    padding: 18,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  sheetSubtitle: {
    marginTop: 4,
    marginBottom: 16,
    fontSize: 13,
  },
  sheetButton: {
    minHeight: 58,
    borderRadius: 18,
    paddingHorizontal: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f8fafc',
  },
  sheetCancelButton: {
    marginBottom: 0,
  },
  sheetIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TRATATIVA_THEME.primary,
  },
  sheetButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});

export default EspelhoRecebimentoScreen;
