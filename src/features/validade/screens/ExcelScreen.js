import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Alert,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import DocumentPicker from 'react-native-document-picker';
import * as XLSX from 'xlsx';
import Share from 'react-native-share';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-toast-message';
import ScreenLayout, {
  createScreenHeaderTemplate,
  createHeaderTitleTemplate,
} from '../../../components/ScreenLayout';
import { CORESEXCEL } from '../../../components/coresAuth';
import {
  readValidadeHistoryMeta,
  readValidadeProductsCache,
  writeLastValidadeExport,
  writeLastValidadeImport,
  writeValidadeProductsCache,
} from '../storage/validadeProductsStorage';

const COLORS = CORESEXCEL;

const ExcelScreen = ({ navigation, isDarkMode }) => {
  const [productsCount, setProductsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastExport, setLastExport] = useState(null);
  const [lastImport, setLastImport] = useState(null);

  useEffect(() => {
    navigation.setOptions({
      ...createScreenHeaderTemplate({
        isDarkMode,
        lightHeaderColor: COLORS.secondary,
        darkHeaderColor: COLORS.secondary,
        tintColor: '#FFFFFF',
        titleSize: 18,
        titleWeight: '800',
      }),
      headerTitle: () =>
        createHeaderTitleTemplate({
          title: 'Exportação / Importação',
          subtitle: 'Gerencie seus dados em planilha',
          iconName: 'table-chart',
          tintColor: '#FFFFFF',
        }),
    });

    loadProducts();
    loadHistory();
  }, [navigation, isDarkMode]);

  const loadProducts = useCallback(async () => {
    try {
      let parsedProducts = await readValidadeProductsCache();
      parsedProducts = parsedProducts.filter((p) => !p.status || p.status !== 'treated');
      setProductsCount(parsedProducts.length);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível carregar os produtos.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const { lastExport: exportDate, lastImport: importDate } = await readValidadeHistoryMeta();
      if (exportDate) setLastExport(exportDate);
      if (importDate) setLastImport(importDate);
    } catch (error) {
      // silently fail
    }
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const exportToExcel = async () => {
    if (productsCount === 0) {
      return Toast.show({
        type: 'info',
        text1: 'Nenhum produto',
        text2: 'Adicione produtos antes de exportar.',
        visibilityTime: 3000,
      });
    }

    setIsProcessing(true);
    try {
      let products = await readValidadeProductsCache();

      // Filtra apenas produtos ativos (não tratados/avariados)
      products = products.filter(p => !p.status || p.status !== 'treated');

      const workBook = XLSX.utils.book_new();
      const workSheet = XLSX.utils.json_to_sheet(products);
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

      const now = new Date().toISOString();
      await writeLastValidadeExport(now);
      setLastExport(now);

      Toast.show({
        type: 'success',
        text1: 'Exportação concluída',
        text2: `${products.length} produtos exportados com sucesso!`,
        visibilityTime: 3000,
      });
    } catch (error) {
      if (error.message !== 'User did not share') {
        Toast.show({
          type: 'error',
          text1: 'Erro na exportação',
          text2: error.message,
          visibilityTime: 3000,
        });
      }
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

      if (!fileUri.endsWith('.xlsx') && !fileUri.endsWith('.xls')) {
        setIsProcessing(false);
        return Toast.show({
          type: 'error',
          text1: 'Formato inválido',
          text2: 'Selecione um arquivo .xlsx ou .xls',
          visibilityTime: 3000,
        });
      }

      const normalizedPath = fileUri.startsWith('file://') ? fileUri.replace('file://', '') : fileUri;
      const fileContent = await ReactNativeBlobUtil.fs.readFile(normalizedPath, 'base64');
      const workBook = XLSX.read(fileContent, { type: 'base64' });
      const workSheet = workBook.Sheets[workBook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(workSheet).map(item => ({
        ...item,
        id: item.id || Date.now().toString() + Math.random().toString(36).substr(2, 9)
      }));

      if (data.length === 0) {
        setIsProcessing(false);
        return Toast.show({
          type: 'info',
          text1: 'Planilha vazia',
          text2: 'O arquivo não contém dados para importar.',
          visibilityTime: 3000,
        });
      }

      await writeValidadeProductsCache(data);
      setProductsCount(data.length);

      const now = new Date().toISOString();
      await writeLastValidadeImport(now);
      setLastImport(now);

      Toast.show({
        type: 'success',
        text1: 'Importação concluída',
        text2: `${data.length} produtos importados com sucesso!`,
        visibilityTime: 3000,
      });
    } catch (error) {
      if (DocumentPicker.isCancel(error)) {
        // silently cancel
      } else {
        Toast.show({
          type: 'error',
          text1: 'Erro na importação',
          text2: error.message,
          visibilityTime: 3000,
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const palette = {
    bg: isDarkMode ? COLORS.backgroundDark : COLORS.background,
    card: isDarkMode ? COLORS.cardDark : COLORS.card,
    text: isDarkMode ? COLORS.textDark : COLORS.text,
    textMuted: isDarkMode ? '#9ca3af' : COLORS.textMuted,
    border: isDarkMode ? 'rgba(255,255,255,0.08)' : COLORS.border,
  };

  const InfoBadge = ({ icon, label, value, color }) => (
    <View style={[styles.infoBadge, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(1, 38, 119, 0.06)' }]}>
      <View style={[styles.infoBadgeIcon, { backgroundColor: color || COLORS.secondary }]}>
        <MaterialIcons name={icon} size={16} color="#fff" />
      </View>
      <View style={styles.infoBadgeContent}>
        <Text style={[styles.infoBadgeLabel, { color: palette.textMuted }]}>{label}</Text>
        <Text style={[styles.infoBadgeValue, { color: palette.text }]}>{value}</Text>
      </View>
    </View>
  );

  const ActionCard = ({ icon, title, description, bullets, buttonLabel, buttonColor, onPress, disabled }) => (
    <View style={[styles.actionCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <View style={styles.actionCardHeader}>
        <View style={[styles.actionCardIconCircle, { backgroundColor: buttonColor }]}>
          <MaterialIcons name={icon} size={24} color="#fff" />
        </View>
        <View style={styles.actionCardTitleArea}>
          <Text style={[styles.actionCardTitle, { color: palette.text }]}>{title}</Text>
          <Text style={[styles.actionCardDescription, { color: palette.textMuted }]}>{description}</Text>
        </View>
      </View>

      {bullets && bullets.length > 0 && (
        <View style={styles.bulletList}>
          {bullets.map((bullet, idx) => (
            <View key={idx} style={styles.bulletItem}>
              <MaterialIcons name="check-circle" size={14} color={buttonColor} style={{ marginTop: 2 }} />
              <Text style={[styles.bulletText, { color: palette.textMuted }]}>{bullet}</Text>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: buttonColor }, disabled && styles.actionButtonDisabled]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.8}
      >
        <MaterialIcons name={icon} size={20} color="#fff" />
        <Text style={styles.actionButtonText}>{buttonLabel}</Text>
        <MaterialIcons name="arrow-forward" size={18} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <ScreenLayout isDarkMode={isDarkMode} lightBackground={COLORS.background} darkBackground={COLORS.backgroundDark}>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout
      isDarkMode={isDarkMode}
      lightBackground={COLORS.background}
      darkBackground={COLORS.backgroundDark}
      contentStyle={styles.screenContent}
    >
      {isProcessing && (
        <View style={styles.processingOverlay}>
          <View style={[styles.processingCard, { backgroundColor: palette.card }]}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={[styles.processingText, { color: palette.text }]}>Processando...</Text>
            <Text style={[styles.processingSubtext, { color: palette.textMuted }]}>Aguarde enquanto preparamos seus dados</Text>
          </View>
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Status do banco de dados */}
        <View style={[styles.statsRow]}>
          <InfoBadge
            icon="inventory"
            label="Produtos cadastrados"
            value={productsCount.toString()}
            color={COLORS.primary}
          />
          <InfoBadge
            icon="storage"
            label="Formato suportado"
            value=".xlsx"
            color="#059669"
          />
        </View>

        {/* Histórico */}
        {(lastExport || lastImport) && (
          <View style={[styles.historyCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.historyHeader}>
              <MaterialIcons name="history" size={18} color={palette.textMuted} />
              <Text style={[styles.historyTitle, { color: palette.textMuted }]}>Histórico recente</Text>
            </View>
            {lastExport && (
              <View style={styles.historyItem}>
                <MaterialIcons name="file-download" size={14} color="#059669" />
                <Text style={[styles.historyText, { color: palette.textMuted }]}>
                  Última exportação: {formatDate(lastExport)}
                </Text>
              </View>
            )}
            {lastImport && (
              <View style={styles.historyItem}>
                <MaterialIcons name="file-upload" size={14} color={COLORS.primary} />
                <Text style={[styles.historyText, { color: palette.textMuted }]}>
                  Última importação: {formatDate(lastImport)}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Card de Exportação */}
        <ActionCard
          icon="file-download"
          title="Exportar para Excel"
          description="Gere uma planilha .xlsx com todos os seus produtos cadastrados no app."
          bullets={[
            'Inclui todos os campos: código, descrição, lote, validade e quantidade',
            'Compartilhe via e-mail, WhatsApp ou salve no dispositivo',
            'Ideal para backups e relatórios gerenciais',
          ]}
          buttonLabel="Exportar planilha"
          buttonColor="#059669"
          onPress={exportToExcel}
          disabled={isProcessing || productsCount === 0}
        />

        {/* Card de Importação */}
        <ActionCard
          icon="file-upload"
          title="Importar do Excel"
          description="Carregue uma planilha .xlsx para adicionar produtos em massa no app."
          bullets={[
            'Colunas esperadas: codprod, descricao, codauxiliar, lote, validade, quantidade',
            'A planilha substituirá os dados atuais do app',
            'Certifique-se de que as datas estejam no formato ISO (ex: 2026-06-15)',
          ]}
          buttonLabel="Importar planilha"
          buttonColor={COLORS.primary}
          onPress={importFromExcel}
          disabled={isProcessing}
        />

        {/* Dicas */}
        <View style={[styles.tipsCard, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(1, 38, 119, 0.04)', borderColor: palette.border }]}>
          <View style={styles.tipsHeader}>
            <MaterialIcons name="lightbulb-outline" size={18} color="#f59e0b" />
            <Text style={[styles.tipsTitle, { color: palette.text }]}>Dicas importantes</Text>
          </View>
          <View style={styles.tipItem}>
            <Text style={[styles.tipBullet, { color: '#f59e0b' }]}>•</Text>
            <Text style={[styles.tipText, { color: palette.textMuted }]}>
              Exporte regularmente para manter um backup atualizado dos seus dados.
            </Text>
          </View>
          <View style={styles.tipItem}>
            <Text style={[styles.tipBullet, { color: '#f59e0b' }]}>•</Text>
            <Text style={[styles.tipText, { color: palette.textMuted }]}>
              Ao importar, os dados atuais serão substituídos. Faça uma exportação antes como backup.
            </Text>
          </View>
          <View style={styles.tipItem}>
            <Text style={[styles.tipBullet, { color: '#f59e0b' }]}>•</Text>
            <Text style={[styles.tipText, { color: palette.textMuted }]}>
              Use a primeira linha da planilha como cabeçalho com os nomes dos campos.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  screenContent: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Processing overlay
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  processingCard: {
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    width: '75%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  processingText: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  processingSubtext: {
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  infoBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  infoBadgeIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoBadgeContent: {
    flex: 1,
  },
  infoBadgeLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  infoBadgeValue: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 1,
  },

  // History card
  historyCard: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 3,
  },
  historyText: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Action cards
  actionCard: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  actionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionCardIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  actionCardTitleArea: {
    flex: 1,
  },
  actionCardTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  actionCardDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
    fontWeight: '500',
  },

  // Bullet list
  bulletList: {
    marginBottom: 16,
    gap: 6,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingLeft: 4,
  },
  bulletText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '500',
  },

  // Action button
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },

  // Tips card
  tipsCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    marginTop: 2,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  tipBullet: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
  },
  tipText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '500',
  },
});

export default ExcelScreen;
