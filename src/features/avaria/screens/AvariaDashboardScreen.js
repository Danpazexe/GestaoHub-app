import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useIsFocused } from '@react-navigation/native';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Dimensions,
    Platform,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { PieChart } from 'react-native-chart-kit';
import ScreenLayout, {
    createScreenHeaderTemplate,
    createHeaderTitleTemplate,
} from '../../../components/ScreenLayout';
import { CORESAVARIADASHBOARD, CORESFUNCIONALIDADES } from '../../../components/coresAuth';
import { DAMAGE_TYPES, BONUS_TYPES } from '../constants';
import { listAvariaBatches } from '../services/avariaBatchService';

const { width } = Dimensions.get('window');
const SCREEN_COLOR = CORESFUNCIONALIDADES.actions['avaria-dashboard'];
const COLORS = CORESAVARIADASHBOARD;

const AvariaDashboardScreen = ({ navigation, isDarkMode }) => {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [batches, setBatches] = useState([]);
    const [selectedPeriod, setSelectedPeriod] = useState('all'); // '7', '30', 'all'

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            setBatches(await listAvariaBatches());
        } catch (error) {
            console.error('Erro ao carregar dados do dashboard:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    const isFocused = useIsFocused();

    useEffect(() => {
        if (isFocused) {
            loadData();
        }
    }, [isFocused, loadData]);

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    // Filtro de período
    const filteredBatches = useMemo(() => {
        if (selectedPeriod === 'all') return batches;
        const now = new Date();
        const days = parseInt(selectedPeriod);
        const cutoff = new Date(now.setDate(now.getDate() - days));
        return batches.filter(b => new Date(b.createdAt) >= cutoff);
    }, [batches, selectedPeriod]);

    // Estatísticas calculadas
    const stats = useMemo(() => {
        const totalBatches = filteredBatches.length;
        const openBatches = filteredBatches.filter(b => b.status === 'open').length;
        const concludedBatches = filteredBatches.filter(b => b.status === 'concluded').length;

        let totalItemsCount = 0;
        let pendingResolutionCount = 0;
        const damageCounts = {};
        const bonusCounts = {};

        filteredBatches.forEach(batch => {
            const batchItems = batch.items || [];
            totalItemsCount += batchItems.length;

            batchItems.forEach(item => {
                if (!item.resolution) {
                    pendingResolutionCount++;
                }

                // Count damage types
                const dType = item.damageType || 'other';
                damageCounts[dType] = (damageCounts[dType] || 0) + 1;
            });

            // Count bonus types
            const bType = batch.bonusType || 'merchandise';
            bonusCounts[bType] = (bonusCounts[bType] || 0) + 1;
        });

        return {
            totalBatches,
            openBatches,
            concludedBatches,
            totalItemsCount,
            pendingResolutionCount,
            damageCounts,
            bonusCounts,
        };
    }, [filteredBatches]);

    const chartConfig = {
        backgroundGradientFrom: isDarkMode ? '#1e1e1e' : '#fff',
        backgroundGradientTo: isDarkMode ? '#1e1e1e' : '#fff',
        color: (opacity = 1) => isDarkMode ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`,
        labelColor: (opacity = 1) => isDarkMode ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`,
        strokeWidth: 2,
        barPercentage: 0.5,
        useShadowColorFromDataset: false,
    };

    const damageChartData = useMemo(() => {
        return Object.entries(stats.damageCounts).map(([key, count]) => ({
            name: DAMAGE_TYPES[key]?.label || 'Outro',
            population: count,
            color: DAMAGE_TYPES[key]?.color || '#888',
            legendFontColor: isDarkMode ? COLORS.textMutedDark : '#666',
            legendFontSize: 12,
        })).sort((a, b) => b.population - a.population);
    }, [stats.damageCounts, isDarkMode]);

    const bonusChartData = useMemo(() => {
        return Object.entries(stats.bonusCounts).map(([key, count]) => ({
            name: BONUS_TYPES[key]?.label || 'Outro',
            population: count,
            color: BONUS_TYPES[key]?.color || '#888',
            legendFontColor: isDarkMode ? COLORS.textMutedDark : '#666',
            legendFontSize: 12,
        })).sort((a, b) => b.population - a.population);
    }, [stats.bonusCounts, isDarkMode]);

    useEffect(() => {
        navigation.setOptions({
            ...createScreenHeaderTemplate({
                isDarkMode,
                lightHeaderColor: SCREEN_COLOR,
                darkHeaderColor: SCREEN_COLOR,
                tintColor: '#FFFFFF',
            }),
            headerTitle: () =>
                createHeaderTitleTemplate({
                    title: 'Dashboard Avarias',
                    subtitle: 'Visão Geral e Estatísticas',
                    iconName: 'analytics',
                    tintColor: '#FFFFFF',
                }),
        });
    }, [navigation, isDarkMode]);

    const renderStatCard = (title, value, icon, color, subValue = null) => (
        <View style={[
            styles.statCard,
            isDarkMode ? styles.darkCardSurface : styles.lightCardSurface,
        ]}>
            <View style={[styles.iconCircle, { backgroundColor: color + '20' }]}>
                <MaterialIcons name={icon} size={24} color={color} />
            </View>
            <View style={styles.statInfo}>
                <Text style={[styles.statTitle, isDarkMode && styles.darkStatTitle]}>{title}</Text>
                <Text style={[styles.statValue, { color }]}>{value}</Text>
                {subValue && <Text style={styles.statSubValue}>{subValue}</Text>}
            </View>
        </View>
    );

    if (loading && !refreshing) {
        return (
            <View style={[styles.loadingContainer, isDarkMode && styles.darkContainer]}>
                <ActivityIndicator size="large" color={SCREEN_COLOR} />
            </View>
        );
    }

    return (
        <ScreenLayout
            isDarkMode={isDarkMode}
            lightBackground="#f8f9fa"
            darkBackground={COLORS.backgroundDark}
            contentStyle={styles.container}
        >
            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[SCREEN_COLOR]} />}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Filtro de Período */}
                <View style={[styles.periodFilter, isDarkMode && styles.darkPeriodFilter]}>
                    {['7', '30', 'all'].map(p => (
                        <TouchableOpacity
                            key={p}
                            style={[
                                styles.periodButton,
                                selectedPeriod === p && { backgroundColor: SCREEN_COLOR },
                                isDarkMode && selectedPeriod !== p && styles.darkPeriodButton,
                            ]}
                            onPress={() => setSelectedPeriod(p)}
                        >
                            <Text style={[
                                styles.periodButtonText,
                                selectedPeriod === p && styles.activePeriodText,
                                isDarkMode && selectedPeriod !== p && styles.darkPeriodText,
                            ]}>
                                {p === 'all' ? 'Tudo' : `${p} dias`}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Cards de Resumo */}
                <View style={styles.statsGrid}>
                    {renderStatCard('Total de Lotes', stats.totalBatches, 'layers', COLORS.info, `${stats.openBatches} abertos`)}
                    {renderStatCard('Total de Itens', stats.totalItemsCount, 'inventory', COLORS.success)}
                    {renderStatCard('Pendentes', stats.pendingResolutionCount, 'hourglass-empty', COLORS.warning, 'Aguardando resolução')}
                    {renderStatCard('Concluídos', stats.concludedBatches, 'check-circle', COLORS.danger, 'Lotes finalizados')}
                </View>

                {/* Gráfico de Tipos de Avaria */}
                <View style={[
                    styles.chartCard,
                    isDarkMode ? styles.darkCardSurface : styles.lightCardSurface,
                ]}>
                    <Text style={[styles.chartTitle, isDarkMode && styles.darkChartTitle]}>Tipos de Avaria</Text>
                    {damageChartData.length > 0 ? (
                        <PieChart
                            data={damageChartData}
                            width={width - 64}
                            height={200}
                            chartConfig={chartConfig}
                            accessor="population"
                            backgroundColor="transparent"
                            paddingLeft="15"
                            absolute
                        />
                    ) : (
                        <View style={styles.emptyChart}>
                            <Text style={styles.emptyChartText}>Sem dados no período</Text>
                        </View>
                    )}
                </View>

                {/* Gráfico de Tipos de Bônus */}
                <View style={[
                    styles.chartCard,
                    isDarkMode ? styles.darkCardSurface : styles.lightCardSurface,
                ]}>
                    <Text style={[styles.chartTitle, isDarkMode && styles.darkChartTitle]}>Formas de Ressarcimento</Text>
                    {bonusChartData.length > 0 ? (
                        <PieChart
                            data={bonusChartData}
                            width={width - 64}
                            height={200}
                            chartConfig={chartConfig}
                            accessor="population"
                            backgroundColor="transparent"
                            paddingLeft="15"
                            absolute
                        />
                    ) : (
                        <View style={styles.emptyChart}>
                            <Text style={styles.emptyChartText}>Sem dados no período</Text>
                        </View>
                    )}
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </ScreenLayout>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    darkContainer: {
        backgroundColor: '#121212',
    },
    scrollContent: {
        padding: 16,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    periodFilter: {
        flexDirection: 'row',
        marginBottom: 16,
        backgroundColor: '#e5e7eb',
        borderRadius: 8,
        padding: 4,
    },
    darkPeriodFilter: {
        backgroundColor: '#1f2937',
    },
    periodButton: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 6,
    },
    periodButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4b5563',
    },
    darkPeriodButton: {
        backgroundColor: COLORS.cardDark,
    },
    activePeriodText: {
        color: '#fff',
    },
    darkPeriodText: {
        color: COLORS.textMutedDark,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    statCard: {
        width: '48%',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        ...Platform.select({
            android: {
                elevation: 2,
            },
            default: {},
        }),
    },
    iconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    statInfo: {
        justifyContent: 'center',
    },
    statTitle: {
        fontSize: 12,
        color: '#64748b',
        marginBottom: 4,
    },
    darkStatTitle: {
        color: COLORS.textMutedDark,
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    statSubValue: {
        fontSize: 10,
        color: '#94a3b8',
        marginTop: 2,
    },
    chartCard: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        ...Platform.select({
            android: {
                elevation: 2,
            },
            default: {},
        }),
    },
    lightCardSurface: {
        backgroundColor: COLORS.card,
        borderColor: COLORS.border,
    },
    darkCardSurface: {
        backgroundColor: COLORS.cardDark,
        borderColor: COLORS.borderDark,
    },
    chartTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 16,
    },
    darkChartTitle: {
        color: COLORS.textDark,
    },
    emptyChart: {
        height: 150,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyChartText: {
        color: '#94a3b8',
        fontSize: 14,
    },
});

export default AvariaDashboardScreen;
