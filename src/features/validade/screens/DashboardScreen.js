import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BarChart, PieChart } from 'react-native-chart-kit';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Share from 'react-native-share';
import ReactNativeBlobUtil from 'react-native-blob-util';
import * as XLSX from 'xlsx';
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import Toast from 'react-native-toast-message';
import ScreenLayout, {
  createScreenHeaderTemplate,
  createHeaderTitleTemplate,
} from '../../../components/ScreenLayout';
import HeaderMenu from '../../../components/HeaderMenu';
import { readStoredUserName } from '../../../services/userSessionStorageService';
import { dashboardTheme } from '../../../theme/domains/validade';
import {
  PDF_A4_LANDSCAPE,
  escapeHtml,
  formatDatePt,
  getDaysAgo,
  getDaysFromToday,
  parseDateInput,
  toCsv,
} from '../services/dashboardFormatService';
import {
  loadValidadeProducts,
} from '../services/validadeProductsService';

const COLORS = dashboardTheme;

const RANGE_OPTIONS = [
  { key: 'all', label: 'Tudo' },
  { key: '7', label: '7 dias' },
  { key: '30', label: '30 dias' },
  { key: '60', label: '60 dias' },
  { key: '90', label: '90 dias' },
];

const SCOPE_OPTIONS = [
  { key: 'all', label: 'Todos' },
  { key: 'active', label: 'No prazo' },
  { key: 'expiring', label: 'Vence em 30d' },
  { key: 'expired', label: 'Vencidos' },
  { key: 'treated', label: 'Tratados' },
];

const EXPORT_OPTIONS = [
  { key: 'pdf', label: 'PDF (A4)', icon: 'picture-as-pdf' },
  { key: 'xlsx', label: 'Excel (XLSX)', icon: 'grid-on' },
  { key: 'csv', label: 'CSV', icon: 'table-chart' },
  { key: 'json', label: 'JSON', icon: 'code' },
];

const DashboardScreen = ({ isDarkMode, navigation }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [periodFilter, setPeriodFilter] = useState('30');
  const [scopeFilter, setScopeFilter] = useState('all');
  const [exporting, setExporting] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const hasLoadedOnceRef = useRef(false);

  const treatmentInfo = useMemo(
    () => ({
      sold: { label: 'Vendido', short: 'Vend', color: COLORS.sold, icon: 'shopping-cart' },
      exchanged: { label: 'Trocado', short: 'Troca', color: COLORS.exchanged, icon: 'swap-horiz' },
      returned: { label: 'Devolvido', short: 'Dev', color: COLORS.returned, icon: 'assignment-return' },
      expired: { label: 'Vencido', short: 'Venc', color: COLORS.expired, icon: 'error-outline' },
      unknown: { label: 'Outro', short: 'Outro', color: COLORS.unknown, icon: 'help-outline' },
    }),
    [],
  );

  const loadProducts = useCallback(async ({ showLoading = false } = {}) => {
    if (showLoading) {
      setLoading(true);
    }

    try {
      const loadedProducts = await loadValidadeProducts({ preferRemote: true });
      setProducts(Array.isArray(loadedProducts) ? loadedProducts : []);
    } catch (error) {
      console.error('Erro ao carregar produtos para dashboard:', error);
      Toast.show({
        type: 'error',
        text1: 'Erro ao carregar dashboard',
        text2: 'Não foi possível ler os dados de validade.',
      });
      setProducts([]);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  const onRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    await loadProducts({ showLoading: false });
    setRefreshing(false);
  }, [loadProducts, refreshing]);

  useFocusEffect(
    useCallback(() => {
      const shouldShowLoading = !hasLoadedOnceRef.current;
      hasLoadedOnceRef.current = true;
      loadProducts({ showLoading: shouldShowLoading });
    }, [loadProducts]),
  );

  const normalizedProducts = useMemo(
    () =>
      products.map((item, index) => {
        const isTreated = item.status === 'treated' || item.status === 'resolved';
        const validadeDate = parseDateInput(item.validade);
        const treatmentDate = parseDateInput(item.treatmentDate);
        const daysRemaining = validadeDate ? getDaysFromToday(validadeDate) : null;

        return {
          ...item,
          _key: String(item.id ?? `${index}-${item.codprod ?? 'produto'}`),
          _isTreated: isTreated,
          _validadeDate: validadeDate,
          _treatmentDate: treatmentDate,
          _daysRemaining: daysRemaining,
          _quantity: Number(item.quantidade) || 0,
        };
      }),
    [products],
  );

  const matchesPeriod = useCallback(
    (item) => {
      if (periodFilter === 'all') return true;

      const range = Number(periodFilter);
      if (item._isTreated) {
        if (!item._treatmentDate) return false;
        const daysAgo = getDaysAgo(item._treatmentDate);
        return daysAgo !== null && daysAgo <= range;
      }

      if (item._daysRemaining === null) return false;
      return Math.abs(item._daysRemaining) <= range;
    },
    [periodFilter],
  );

  const matchesScope = useCallback(
    (item) => {
      if (scopeFilter === 'all') return true;

      if (scopeFilter === 'treated') return item._isTreated;
      if (scopeFilter === 'active') return !item._isTreated && item._daysRemaining !== null && item._daysRemaining > 30;
      if (scopeFilter === 'expiring') return !item._isTreated && item._daysRemaining !== null && item._daysRemaining >= 0 && item._daysRemaining <= 30;
      if (scopeFilter === 'expired') return !item._isTreated && item._daysRemaining !== null && item._daysRemaining < 0;

      return true;
    },
    [scopeFilter],
  );

  const filteredProducts = useMemo(
    () => normalizedProducts.filter((item) => matchesPeriod(item) && matchesScope(item)),
    [normalizedProducts, matchesPeriod, matchesScope],
  );

  const listedProducts = useMemo(() => filteredProducts.filter((item) => !item._isTreated), [filteredProducts]);
  const treatedProducts = useMemo(() => filteredProducts.filter((item) => item._isTreated), [filteredProducts]);

  const expiring30Products = useMemo(
    () => listedProducts.filter((item) => item._daysRemaining !== null && item._daysRemaining >= 0 && item._daysRemaining <= 30),
    [listedProducts],
  );

  const expiredProducts = useMemo(
    () => listedProducts.filter((item) => item._daysRemaining !== null && item._daysRemaining < 0),
    [listedProducts],
  );

  const safeProducts = useMemo(
    () => listedProducts.filter((item) => item._daysRemaining !== null && item._daysRemaining > 30),
    [listedProducts],
  );

  const treatmentSummary = useMemo(() => {
    const keys = ['sold', 'exchanged', 'returned', 'expired', 'unknown'];
    const totalByType = {
      sold: 0,
      exchanged: 0,
      returned: 0,
      expired: 0,
      unknown: 0,
    };

    treatedProducts.forEach((item) => {
      const key = treatmentInfo[item.treatmentType] ? item.treatmentType : 'unknown';
      totalByType[key] += item._quantity > 0 ? item._quantity : 1;
    });

    return keys.map((key) => ({ key, ...treatmentInfo[key], count: totalByType[key] }));
  }, [treatedProducts, treatmentInfo]);

  const statusPieData = useMemo(
    () =>
      [
        {
          name: 'No prazo',
          count: safeProducts.length,
          color: COLORS.success,
          legendFontColor: isDarkMode ? COLORS.textDark : COLORS.text,
          legendFontSize: 12,
        },
        {
          name: 'Vencendo',
          count: expiring30Products.length,
          color: COLORS.warning,
          legendFontColor: isDarkMode ? COLORS.textDark : COLORS.text,
          legendFontSize: 12,
        },
        {
          name: 'Vencidos',
          count: expiredProducts.length,
          color: COLORS.danger,
          legendFontColor: isDarkMode ? COLORS.textDark : COLORS.text,
          legendFontSize: 12,
        },
        {
          name: 'Tratados',
          count: treatedProducts.length,
          color: COLORS.info,
          legendFontColor: isDarkMode ? COLORS.textDark : COLORS.text,
          legendFontSize: 12,
        },
      ].filter((item) => item.count > 0),
    [safeProducts.length, expiring30Products.length, expiredProducts.length, treatedProducts.length, isDarkMode],
  );

  const treatmentBarData = useMemo(
    () => ({
      labels: treatmentSummary.map((item) => item.short),
      datasets: [{ data: treatmentSummary.map((item) => item.count) }],
    }),
    [treatmentSummary],
  );

  const criticalProducts = useMemo(
    () =>
      [...listedProducts]
        .filter((item) => item._daysRemaining !== null && item._daysRemaining <= 30)
        .sort((a, b) => a._daysRemaining - b._daysRemaining)
        .slice(0, 10),
    [listedProducts],
  );

  const recentTreatments = useMemo(
    () =>
      [...treatedProducts]
        .filter((item) => item._treatmentDate)
        .sort((a, b) => b._treatmentDate - a._treatmentDate)
        .slice(0, 10),
    [treatedProducts],
  );

  const coverage = useMemo(() => {
    const total = listedProducts.length + treatedProducts.length;
    if (!total) return '0%';
    return `${Math.round((treatedProducts.length / total) * 100)}%`;
  }, [listedProducts.length, treatedProducts.length]);

  const summaryCards = useMemo(
    () => [
      { key: 'active', label: 'No prazo', value: safeProducts.length, icon: 'inventory-2', color: COLORS.success, scope: 'active' },
      { key: 'expiring', label: 'Vence em 30d', value: expiring30Products.length, icon: 'event', color: COLORS.warning, scope: 'expiring' },
      { key: 'expired', label: 'Vencidos', value: expiredProducts.length, icon: 'warning', color: COLORS.danger, scope: 'expired' },
      { key: 'treated', label: 'Tratados', value: treatedProducts.length, icon: 'assignment-turned-in', color: COLORS.info, scope: 'treated' },
      { key: 'coverage', label: 'Cobertura', value: coverage, icon: 'donut-large', color: COLORS.secondary, scope: 'all' },
    ],
    [safeProducts.length, expiring30Products.length, expiredProducts.length, treatedProducts.length, coverage],
  );

  const selectedRangeLabel = useMemo(
    () => RANGE_OPTIONS.find((option) => option.key === periodFilter)?.label || 'Tudo',
    [periodFilter],
  );

  const selectedScopeLabel = useMemo(
    () => SCOPE_OPTIONS.find((option) => option.key === scopeFilter)?.label || 'Todos',
    [scopeFilter],
  );

  const exportRows = useMemo(
    () =>
      filteredProducts.map((item) => {
        const treatment = treatmentInfo[item.treatmentType] || treatmentInfo.unknown;
        const statusLabel = item._isTreated
          ? 'Tratado'
          : item._daysRemaining !== null && item._daysRemaining < 0
            ? 'Vencido'
            : item._daysRemaining !== null && item._daysRemaining <= 30
              ? 'Vence em 30d'
              : 'No prazo';

        return {
          descricao: item.descricao || '-',
          codprod: item.codprod || '-',
          codauxiliar: item.codauxiliar || '-',
          lote: item.lote || '-',
          quantidade: item._quantity,
          validade: formatDatePt(item._validadeDate),
          dias_restantes: item._daysRemaining ?? '-',
          status: statusLabel,
          tipo_tratativa: item._isTreated ? treatment.label : '-',
          data_tratativa: item._isTreated ? formatDatePt(item._treatmentDate) : '-',
        };
      }),
    [filteredProducts, treatmentInfo],
  );

  const chartConfig = useMemo(
    () => ({
      backgroundGradientFrom: isDarkMode ? COLORS.cardDark : COLORS.card,
      backgroundGradientTo: isDarkMode ? COLORS.cardDark : COLORS.card,
      decimalPlaces: 0,
      color: (opacity = 1) => `rgba(${COLORS.chartColorRgb}, ${opacity})`,
      labelColor: () => (isDarkMode ? COLORS.textDark : COLORS.text),
      barPercentage: 0.65,
      propsForBackgroundLines: {
        stroke: isDarkMode ? COLORS.borderDark : COLORS.border,
        strokeDasharray: '',
      },
    }),
    [isDarkMode],
  );

  const chartWidth = Math.max(280, Dimensions.get('window').width - 56);
  const cardTheme = isDarkMode ? styles.cardDark : styles.cardLight;
  const textPrimary = isDarkMode ? styles.textLight : styles.textDark;
  const textSecondary = isDarkMode ? styles.textLightSecondary : styles.textDarkSecondary;

  const shareGeneratedFile = useCallback(async (filePath, mimeType, title) => {
    const fileUrl = filePath.startsWith('file://') ? filePath : `file://${filePath}`;
    await Share.open({
      url: fileUrl,
      type: mimeType,
      title,
      failOnCancel: false,
    });
  }, []);

  const buildPdfHtml = useCallback(
    async (rows, pageSize) => {
      const effectivePageSize = pageSize || PDF_A4_LANDSCAPE;
      const userName = await readStoredUserName('---');

      let logoSrc = '';
      try {
        const assetSource = Image.resolveAssetSource(require('../../../../assets/Image/LOGOCOMFRASE.png'));
        const assetUri = assetSource?.uri;
        if (assetUri) {
          try {
            const path = assetUri.startsWith('file://') ? assetUri.replace('file://', '') : assetUri;
            const base64 = await ReactNativeBlobUtil.fs.readFile(path, 'base64');
            logoSrc = `data:image/png;base64,${base64}`;
          } catch (error) {
            // Fallback: try to render from the resolved asset URI directly.
            logoSrc = assetUri;
          }
        }
      } catch (error) {
        logoSrc = '';
      }

      const treatmentBreakdown = treatmentSummary
        .filter((item) => item.count > 0)
        .map((item) => `${item.label}: ${item.count}`)
        .join(' | ');

      const tableRows = rows
        .map(
          (row) => `
	          <tr>
	            <td>${escapeHtml(row.descricao)}</td>
	            <td>${escapeHtml(row.codprod)}</td>
              <td>${escapeHtml(row.codauxiliar)}</td>
	            <td>${escapeHtml(row.lote)}</td>
	            <td>${escapeHtml(row.quantidade)}</td>
	            <td>${escapeHtml(row.validade)}</td>
	            <td>${escapeHtml(row.dias_restantes)}</td>
	            <td>${escapeHtml(row.status)}</td>
	            <td>${escapeHtml(row.tipo_tratativa)}</td>
              <td>${escapeHtml(row.data_tratativa)}</td>
	          </tr>`,
        )
        .join('');

      return `
	        <html>
	          <head>
	            <meta charset="utf-8" />
	            <style>
	              @page { size: ${effectivePageSize.cssSize}; margin: 12mm; }
	              body { font-family: Arial, sans-serif; padding: 0; color: #111827; }
                h1 { margin: 0; font-size: 18px; font-weight: 800; color: #000000; }
	              .header { display: flex; align-items: center; gap: 14px; margin-bottom: 10px; }
                .logo { height: 36px; width: auto; }
                .meta { color: #4b5563; font-size: 12px; line-height: 1.4; }
                .metaRow { margin-top: 2px; }
	              table { border-collapse: collapse; width: 100%; font-size: 10px; }
	              th, td { border: 1px solid #d1d5db; padding: 6px; text-align: left; vertical-align: top; }
	              th { background: #eef2ff; }
                .summary { margin: 10px 0 12px; display: flex; flex-wrap: wrap; gap: 8px; }
                .pill { display: inline-block; border: 1px solid #e5e7eb; background: #f9fafb; border-radius: 999px; padding: 4px 8px; font-size: 11px; color: #111827; }
                .muted { color: #6b7280; }
	            </style>
	          </head>
	          <body>
              <div class="header">
                ${logoSrc ? `<img class="logo" src="${logoSrc}" />` : ''}
                <div>
                  <h1>Dashboard de Validade</h1>
                  <div class="meta">Gerado em ${new Date().toLocaleString('pt-BR')}</div>
                </div>
              </div>

              <div class="meta">
                <div class="metaRow"><strong>Usuário:</strong> ${escapeHtml(userName)}</div>
                <div class="metaRow"><strong>Formato:</strong> ${escapeHtml(effectivePageSize.label)}</div>
                <div class="metaRow"><strong>Filtro período:</strong> ${escapeHtml(selectedRangeLabel)} | <strong>Filtro escopo:</strong> ${escapeHtml(selectedScopeLabel)}</div>
                ${treatmentBreakdown ? `<div class="metaRow"><strong>Tratativas (quantidade):</strong> ${escapeHtml(treatmentBreakdown)}</div>` : ''}
              </div>

              <div class="summary">
                <span class="pill"><strong>Total:</strong> ${rows.length}</span>
                <span class="pill"><strong>No prazo:</strong> ${safeProducts.length}</span>
                <span class="pill"><strong>Vence em 30d:</strong> ${expiring30Products.length}</span>
                <span class="pill"><strong>Vencidos:</strong> ${expiredProducts.length}</span>
                <span class="pill"><strong>Tratados:</strong> ${treatedProducts.length}</span>
                <span class="pill"><strong>Cobertura:</strong> ${escapeHtml(coverage)}</span>
              </div>

	            <table>
	              <thead>
	                <tr>
	                  <th>Descrição</th>
	                  <th>Código</th>
                    <th>EAN</th>
	                  <th>Lote</th>
	                  <th>Qtd</th>
	                  <th>Validade</th>
	                  <th>Dias</th>
	                  <th>Status</th>
	                  <th>Tratativa</th>
                    <th>Data Tratativa</th>
	                </tr>
	              </thead>
	              <tbody>
	                ${tableRows}
	              </tbody>
	            </table>
	          </body>
	        </html>
	      `;
    },
    [
      selectedRangeLabel,
      selectedScopeLabel,
      safeProducts.length,
      expiring30Products.length,
      expiredProducts.length,
      treatedProducts.length,
      coverage,
      treatmentSummary,
    ],
  );

  const handleExport = useCallback(
    async (format) => {
      if (!exportRows.length) {
        Toast.show({
          type: 'info',
          text1: 'Sem dados para exportar',
          text2: 'Ajuste os filtros para gerar a exportação.',
        });
        return;
      }

      setExporting(true);

      try {
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');

        if (format === 'json') {
          const filePath = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/dashboard_validade_${stamp}.json`;
          await ReactNativeBlobUtil.fs.writeFile(filePath, JSON.stringify(exportRows, null, 2), 'utf8');
          await shareGeneratedFile(filePath, 'application/json', 'Exportar JSON');
        }

        if (format === 'csv') {
          const filePath = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/dashboard_validade_${stamp}.csv`;
          await ReactNativeBlobUtil.fs.writeFile(filePath, toCsv(exportRows), 'utf8');
          await shareGeneratedFile(filePath, 'text/csv', 'Exportar CSV');
        }

        if (format === 'xlsx') {
          const worksheet = XLSX.utils.json_to_sheet(exportRows);
          const workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, worksheet, 'Validade');
          const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });

          const filePath = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/dashboard_validade_${stamp}.xlsx`;
          await ReactNativeBlobUtil.fs.writeFile(filePath, buffer, 'base64');
          await shareGeneratedFile(
            filePath,
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Exportar XLSX',
          );
        }

        if (format === 'pdf') {
          const html = await buildPdfHtml(exportRows, PDF_A4_LANDSCAPE);
          const { filePath } = await RNHTMLtoPDF.convert({
            html,
            fileName: `dashboard_validade_${stamp}_a4`,
            directory: 'Documents',
            width: PDF_A4_LANDSCAPE.width,
            height: PDF_A4_LANDSCAPE.height,
          });

          await shareGeneratedFile(filePath, 'application/pdf', `Exportar ${PDF_A4_LANDSCAPE.label}`);
        }

        const exportLabel = EXPORT_OPTIONS.find((option) => option.key === format)?.label || format.toUpperCase();
        Toast.show({
          type: 'success',
          text1: 'Exportação concluída',
          text2: `Arquivo ${exportLabel} gerado com sucesso.`,
        });
      } catch (error) {
        console.error('Erro ao exportar dashboard:', error);
        Toast.show({
          type: 'error',
          text1: 'Falha na exportação',
          text2: 'Não foi possível gerar o arquivo selecionado.',
        });
      } finally {
        setExporting(false);
      }
    },
    [buildPdfHtml, exportRows, shareGeneratedFile],
  );

  useEffect(() => {
    navigation.setOptions({
      ...createScreenHeaderTemplate({
        isDarkMode,
        lightHeaderColor: COLORS.primary,
        darkHeaderColor: COLORS.primary,
        tintColor: COLORS.white,
        titleSize: 20,
        titleWeight: '700',
      }),
      headerTitle: () =>
        createHeaderTitleTemplate({
          title: 'Dashboard',
          subtitle: 'Visão geral',
          iconName: 'analytics',
          tintColor: COLORS.white,
        }),
      headerRight: () => (
        <View style={{ flexDirection: 'row', marginRight: 8 }}>
          <TouchableOpacity
            onPress={onRefresh}
            disabled={refreshing || loading}
            style={styles.headerButton}
          >
            <MaterialIcons name="refresh" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <HeaderMenu
            visible={menuVisible}
            onOpen={() => setMenuVisible(true)}
            onDismiss={() => setMenuVisible(false)}
            items={[
              {
                key: 'pdf',
                title: 'Exportar PDF',
                icon: 'file-pdf-box',
                onPress: () => handleExport('pdf')
              },
              {
                key: 'xlsx',
                title: 'Exportar Excel',
                icon: 'file-excel',
                onPress: () => handleExport('xlsx')
              },
              {
                key: 'csv',
                title: 'Exportar CSV',
                icon: 'file-delimited',
                onPress: () => handleExport('csv')
              },
              {
                key: 'json',
                title: 'Exportar JSON',
                icon: 'code-json',
                onPress: () => handleExport('json')
              }
            ]}
          />
        </View>
      ),
    });
  }, [navigation, isDarkMode, onRefresh, menuVisible, refreshing, loading, handleExport]);

  if (loading) {
    return (
      <ScreenLayout
        isDarkMode={isDarkMode}
        lightBackground={COLORS.background}
        darkBackground={COLORS.backgroundDark}
      >
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={[styles.loadingText, textSecondary]}>Carregando dashboard...</Text>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout
      isDarkMode={isDarkMode}
      lightBackground={COLORS.background}
      darkBackground={COLORS.backgroundDark}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.filterBlock, cardTheme]}>
          <Text style={[styles.blockTitle, textPrimary]}>Filtros do Dashboard</Text>

          <Text style={[styles.filterLabel, textSecondary]}>Janela de análise</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {RANGE_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.filterChip,
                  isDarkMode && styles.filterChipDark,
                  periodFilter === option.key && styles.filterChipActive,
                ]}
                onPress={() => setPeriodFilter(option.key)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isDarkMode && styles.filterChipTextDark,
                    periodFilter === option.key && styles.filterChipTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.filterLabel, textSecondary]}>Escopo</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {SCOPE_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.filterChip,
                  isDarkMode && styles.filterChipDark,
                  scopeFilter === option.key && styles.filterChipActive,
                ]}
                onPress={() => setScopeFilter(option.key)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isDarkMode && styles.filterChipTextDark,
                    scopeFilter === option.key && styles.filterChipTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.appliedFilterText, textSecondary]}>
            Período: {selectedRangeLabel} | Escopo: {selectedScopeLabel}
          </Text>
        </View>

        <View style={styles.summaryGrid}>
          {summaryCards.map((card) => (
            <TouchableOpacity
              key={card.key}
              activeOpacity={0.86}
              onPress={() => setScopeFilter(card.scope)}
              style={[
                styles.summaryCard,
                cardTheme,
                scopeFilter === card.scope && styles.summaryCardActive,
              ]}
            >
              <View style={[styles.summaryIcon, { backgroundColor: `${card.color}22` }]}>
                <MaterialIcons name={card.icon} size={20} color={card.color} />
              </View>
              <Text style={[styles.summaryValue, textPrimary]}>{card.value}</Text>
              <Text style={[styles.summaryLabel, textSecondary]}>{card.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.sectionCard, cardTheme]}>
          <Text style={[styles.sectionTitle, textPrimary]}>Distribuição de Status</Text>
          <Text style={[styles.sectionSubtitle, textSecondary]}>
            Composição de itens em lista, vencimento e tratativas
          </Text>

          {statusPieData.length > 0 ? (
            <PieChart
              data={statusPieData}
              width={chartWidth}
              height={220}
              chartConfig={chartConfig}
              accessor="count"
              backgroundColor="transparent"
              paddingLeft="8"
              absolute
              hasLegend
            />
          ) : (
            <View style={styles.emptyChartState}>
              <MaterialIcons name="pie-chart" size={42} color={isDarkMode ? COLORS.textMutedDark : COLORS.textMuted} />
              <Text style={[styles.emptyChartText, textSecondary]}>Sem dados para o gráfico</Text>
            </View>
          )}
        </View>

        <View style={[styles.sectionCard, cardTheme]}>
          <Text style={[styles.sectionTitle, textPrimary]}>Tratativas por Tipo</Text>
          <Text style={[styles.sectionSubtitle, textSecondary]}>Volume de unidades tratadas por categoria</Text>

          {treatmentSummary.some((item) => item.count > 0) ? (
            <BarChart
              data={treatmentBarData}
              width={chartWidth}
              height={220}
              fromZero
              withInnerLines={false}
              yAxisLabel=""
              yAxisSuffix=""
              chartConfig={chartConfig}
              style={styles.chartSpacing}
            />
          ) : (
            <View style={styles.emptyChartState}>
              <MaterialIcons name="bar-chart" size={42} color={isDarkMode ? COLORS.textMutedDark : COLORS.textMuted} />
              <Text style={[styles.emptyChartText, textSecondary]}>Nenhuma tratativa no período/escopo</Text>
            </View>
          )}
        </View>

        <View style={[styles.sectionCard, cardTheme]}>
          <View style={styles.listHeaderRow}>
            <Text style={[styles.sectionTitle, textPrimary]}>Itens Críticos de Validade</Text>
            <View style={styles.badgeCount}>
              <Text style={styles.badgeCountText}>{criticalProducts.length}</Text>
            </View>
          </View>
          <Text style={[styles.sectionSubtitle, textSecondary]}>Produtos vencidos e a vencer em até 30 dias</Text>

          {criticalProducts.length === 0 ? (
            <Text style={[styles.emptyListText, textSecondary]}>Nenhum item crítico com os filtros atuais.</Text>
          ) : (
            criticalProducts.map((item) => {
              const isExpired = item._daysRemaining < 0;
              const color = isExpired ? COLORS.danger : item._daysRemaining <= 7 ? COLORS.warning : COLORS.success;

              return (
                <View key={item._key} style={styles.listRow}>
                  <View style={[styles.rowIcon, { backgroundColor: `${color}20` }]}>
                    <MaterialIcons name={isExpired ? 'error-outline' : 'schedule'} size={18} color={color} />
                  </View>

                  <View style={styles.rowContent}>
                    <Text style={[styles.rowTitle, textPrimary]} numberOfLines={1}>
                      {item.descricao || 'Produto sem descrição'}
                    </Text>
                    <Text style={[styles.rowMeta, textSecondary]}>
                      Lote: {item.lote || '-'} | Qtd: {item._quantity}
                    </Text>
                  </View>

                  <Text style={[styles.rowValue, { color }]}>
                    {isExpired ? `${Math.abs(item._daysRemaining)}d atraso` : `${item._daysRemaining}d`}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        <View style={[styles.sectionCard, cardTheme]}>
          <View style={styles.listHeaderRow}>
            <Text style={[styles.sectionTitle, textPrimary]}>Ultimas Tratativas</Text>
            <View style={styles.badgeCount}>
              <Text style={styles.badgeCountText}>{recentTreatments.length}</Text>
            </View>
          </View>
          <Text style={[styles.sectionSubtitle, textSecondary]}>Movimentacoes mais recentes da tela de tratativas</Text>

          {recentTreatments.length === 0 ? (
            <Text style={[styles.emptyListText, textSecondary]}>Nenhuma tratativa registrada com os filtros atuais.</Text>
          ) : (
            recentTreatments.map((item) => {
              const info = treatmentInfo[item.treatmentType] || treatmentInfo.unknown;
              return (
                <View key={item._key} style={styles.listRow}>
                  <View style={[styles.rowIcon, { backgroundColor: `${info.color}22` }]}>
                    <MaterialIcons name={info.icon} size={18} color={info.color} />
                  </View>

                  <View style={styles.rowContent}>
                    <Text style={[styles.rowTitle, textPrimary]} numberOfLines={1}>
                      {item.descricao || 'Produto sem descrição'}
                    </Text>
                    <Text style={[styles.rowMeta, textSecondary]}>
                      {info.label} | {formatDatePt(item._treatmentDate)}
                    </Text>
                  </View>

                  <Text style={[styles.rowValue, { color: info.color }]}>{item._quantity} un</Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {exporting && (
        <View style={styles.exportOverlay}>
          <View style={[styles.loadingCard, cardTheme]}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={[styles.loadingText, textPrimary]}>Gerando arquivo...</Text>
          </View>
        </View>
      )}
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 26,
    gap: 14,
  },
  cardLight: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
  },
  cardDark: {
    backgroundColor: COLORS.cardDark,
    borderColor: COLORS.borderDark,
  },
  filterBlock: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  blockTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  filterLabel: {
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '600',
  },
  chipRow: {
    paddingBottom: 10,
    gap: 8,
  },
  filterChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(60, 68, 108, 0.1)',
  },
  filterChipDark: {
    backgroundColor: 'rgba(170, 177, 207, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(170, 177, 207, 0.28)',
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipTextDark: {
    color: COLORS.textDark,
  },
  filterChipTextActive: {
    color: COLORS.white,
  },
  appliedFilterText: {
    marginTop: 2,
    fontSize: 12,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryCard: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  summaryCardActive: {
    borderColor: COLORS.primary,
  },
  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 28,
  },
  summaryLabel: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionSubtitle: {
    marginTop: 4,
    marginBottom: 10,
    fontSize: 12,
    lineHeight: 16,
  },
  chartSpacing: {
    marginVertical: 6,
    borderRadius: 8,
  },
  emptyChartState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  emptyChartText: {
    marginTop: 8,
    fontSize: 13,
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgeCount: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 7,
  },
  badgeCountText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 12,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.2)',
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  rowMeta: {
    marginTop: 2,
    fontSize: 12,
  },
  rowValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyListText: {
    fontSize: 13,
    marginTop: 6,
  },
  exportOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlayDark,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingCard: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    elevation: 5,
  },
  exportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.28)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 8,
  },
  exportOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  exportLoader: {
    marginTop: 6,
  },
  closeExportButton: {
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    paddingVertical: 11,
    alignItems: 'center',
  },
  closeExportText: {
    color: COLORS.white,
    fontWeight: '700',
  },
  textLight: {
    color: COLORS.textDark,
  },
  textDark: {
    color: COLORS.text,
  },
  textLightSecondary: {
    color: COLORS.textMutedDark,
  },
  textDarkSecondary: {
    color: COLORS.textMuted,
  },
});

export default DashboardScreen;
