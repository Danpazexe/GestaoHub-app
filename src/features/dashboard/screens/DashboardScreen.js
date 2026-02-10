import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  createHeaderActionsTemplate,
} from '../../../shared/components/ScreenLayout';
import { CORESDASHBOARD } from '../../../../assets/cores/coresAuth';

const COLORS = CORESDASHBOARD;
const DAY_MS = 24 * 60 * 60 * 1000;

const RANGE_OPTIONS = [
  { key: 'all', label: 'Tudo' },
  { key: '7', label: '7 dias' },
  { key: '30', label: '30 dias' },
  { key: '60', label: '60 dias' },
  { key: '90', label: '90 dias' },
];

const SCOPE_OPTIONS = [
  { key: 'all', label: 'Todos' },
  { key: 'active', label: 'Dentro da validade' },
  { key: 'expiring', label: 'Vencendo até 30d' },
  { key: 'expired', label: 'Vencidos' },
  { key: 'treated', label: 'Tratativas' },
];

const EXPORT_OPTIONS = [
  { key: 'pdf', label: 'PDF', icon: 'picture-as-pdf' },
  { key: 'xlsx', label: 'Excel (XLSX)', icon: 'grid-on' },
  { key: 'csv', label: 'CSV', icon: 'table-chart' },
  { key: 'json', label: 'JSON', icon: 'code' },
];

const startOfDay = (date) => {
  const safe = new Date(date);
  safe.setHours(0, 0, 0, 0);
  return safe;
};

const parseDateInput = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string' && value.includes('/')) {
    const [day, month, year] = value.split('/').map(Number);
    if (!day || !month || !year) return null;
    const parsed = new Date(year, month - 1, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getDaysFromToday = (value) => {
  const target = parseDateInput(value);
  if (!target) return null;
  return Math.round((startOfDay(target) - startOfDay(new Date())) / DAY_MS);
};

const getDaysAgo = (value) => {
  const target = parseDateInput(value);
  if (!target) return null;
  return Math.max(0, Math.round((startOfDay(new Date()) - startOfDay(target)) / DAY_MS));
};

const formatDatePt = (value) => {
  const parsed = parseDateInput(value);
  return parsed ? parsed.toLocaleDateString('pt-BR') : '-';
};

const escapeCsvField = (value) => {
  const raw = String(value ?? '');
  if (/[";\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
};

const toCsv = (rows) => {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(';')];

  rows.forEach((row) => {
    const line = headers.map((header) => escapeCsvField(row[header])).join(';');
    lines.push(line);
  });

  return lines.join('\n');
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const DashboardScreen = ({ isDarkMode, navigation }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [periodFilter, setPeriodFilter] = useState('30');
  const [scopeFilter, setScopeFilter] = useState('all');
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exporting, setExporting] = useState(false);

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

  const loadProducts = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }

    try {
      const stored = await AsyncStorage.getItem('products');
      const parsed = stored ? JSON.parse(stored) : [];
      setProducts(Array.isArray(parsed) ? parsed : []);
    } catch (error) {
      console.error('Erro ao carregar produtos para dashboard:', error);
      Toast.show({
        type: 'error',
        text1: 'Erro ao carregar dashboard',
        text2: 'Não foi possível ler os dados de validade.',
      });
      setProducts([]);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProducts(true);
    setRefreshing(false);
  }, [loadProducts]);

  useEffect(() => {
    loadProducts(false);
  }, [loadProducts]);

  useFocusEffect(
    useCallback(() => {
      loadProducts(true);
    }, [loadProducts]),
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
          title: 'Dashboard de Validade',
          subtitle: 'Lista + Tratativas',
          iconName: 'analytics',
          tintColor: COLORS.white,
        }),
      headerRight: () =>
        createHeaderActionsTemplate({
          isDarkMode,
          actions: [
            {
              key: 'refresh-dashboard',
              iconName: 'refresh',
              onPress: onRefresh,
              iconColor: COLORS.white,
            },
            {
              key: 'export-dashboard',
              iconName: 'file-download',
              onPress: () => setExportModalVisible(true),
              iconColor: COLORS.white,
            },
          ],
        }),
    });
  }, [navigation, isDarkMode, onRefresh]);

  const normalizedProducts = useMemo(
    () =>
      products.map((item, index) => {
        const isTreated = item.status === 'treated';
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
          name: 'Dentro da validade',
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
      { key: 'active', label: 'Dentro da validade', value: safeProducts.length, icon: 'inventory-2', color: COLORS.success, scope: 'active' },
      { key: 'expiring', label: 'Vencendo 30d', value: expiring30Products.length, icon: 'event', color: COLORS.warning, scope: 'expiring' },
      { key: 'expired', label: 'Vencidos', value: expiredProducts.length, icon: 'warning', color: COLORS.danger, scope: 'expired' },
      { key: 'treated', label: 'Tratativas', value: treatedProducts.length, icon: 'assignment-turned-in', color: COLORS.info, scope: 'treated' },
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
              ? 'Vencendo (<=30d)'
              : 'Dentro da validade';

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
    (rows) => {
      const tableRows = rows
        .map(
          (row) => `
          <tr>
            <td>${escapeHtml(row.descricao)}</td>
            <td>${escapeHtml(row.codprod)}</td>
            <td>${escapeHtml(row.lote)}</td>
            <td>${escapeHtml(row.quantidade)}</td>
            <td>${escapeHtml(row.validade)}</td>
            <td>${escapeHtml(row.dias_restantes)}</td>
            <td>${escapeHtml(row.status)}</td>
            <td>${escapeHtml(row.tipo_tratativa)}</td>
          </tr>`,
        )
        .join('');

      return `
        <html>
          <head>
            <meta charset="utf-8" />
            <style>
              body { font-family: Arial, sans-serif; padding: 16px; color: #111827; }
	              h1 { color: ${COLORS.primary}; margin-bottom: 4px; }
              .meta { margin-bottom: 16px; color: #4b5563; font-size: 12px; }
              table { border-collapse: collapse; width: 100%; font-size: 11px; }
              th, td { border: 1px solid #d1d5db; padding: 6px; text-align: left; }
              th { background: #eef2ff; }
              .summary { margin-bottom: 12px; }
              .summary div { margin-bottom: 2px; }
            </style>
          </head>
          <body>
            <h1>Dashboard de Validade</h1>
            <div class="meta">Gerado em ${new Date().toLocaleString('pt-BR')}</div>
            <div class="summary">
              <div><strong>Filtro período:</strong> ${escapeHtml(selectedRangeLabel)}</div>
              <div><strong>Filtro escopo:</strong> ${escapeHtml(selectedScopeLabel)}</div>
              <div><strong>Total de registros:</strong> ${rows.length}</div>
              <div><strong>Em lista:</strong> ${listedProducts.length} | <strong>Tratativas:</strong> ${treatedProducts.length}</div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Código</th>
                  <th>Lote</th>
                  <th>Qtd</th>
                  <th>Validade</th>
                  <th>Dias</th>
                  <th>Status</th>
                  <th>Tratativa</th>
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
    [selectedRangeLabel, selectedScopeLabel, listedProducts.length, treatedProducts.length],
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

      setExportModalVisible(false);
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
          const html = buildPdfHtml(exportRows);
          const { filePath } = await RNHTMLtoPDF.convert({
            html,
            fileName: `dashboard_validade_${stamp}`,
            directory: 'Documents',
          });

          await shareGeneratedFile(filePath, 'application/pdf', 'Exportar PDF');
        }

        Toast.show({
          type: 'success',
          text1: 'Exportação concluída',
          text2: `Arquivo ${format.toUpperCase()} gerado com sucesso.`,
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

      <Modal
        transparent
        animationType="fade"
        visible={exportModalVisible}
        onRequestClose={() => !exporting && setExportModalVisible(false)}
      >
        <View style={styles.exportOverlay}>
          <View style={[styles.exportModal, cardTheme]}>
            <Text style={[styles.exportTitle, textPrimary]}>Exportar Dashboard</Text>
            <Text style={[styles.exportSubtitle, textSecondary]}>
              Formatos mais usados para compartilhar e analisar dados.
            </Text>

            {EXPORT_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.key}
                style={styles.exportOption}
                onPress={() => handleExport(option.key)}
                disabled={exporting}
              >
                <MaterialIcons name={option.icon} size={20} color={COLORS.primary} />
                <Text style={[styles.exportOptionText, textPrimary]}>{option.label}</Text>
              </TouchableOpacity>
            ))}

            {exporting ? <ActivityIndicator color={COLORS.primary} style={styles.exportLoader} /> : null}

            <TouchableOpacity
              style={styles.closeExportButton}
              onPress={() => setExportModalVisible(false)}
              disabled={exporting}
            >
              <Text style={styles.closeExportText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  exportModal: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  exportTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  exportSubtitle: {
    marginTop: 4,
    marginBottom: 14,
    fontSize: 12,
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
