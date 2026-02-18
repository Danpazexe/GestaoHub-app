import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { View, FlatList, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenLayout, {
    createScreenHeaderTemplate,
    createHeaderTitleTemplate,
    createHeaderActionsTemplate,
} from '../../components/ScreenLayout';
import { CORESAVARIALIST, CORESFUNCIONALIDADES } from '../../components/coresAuth';

import { DAMAGE_TYPES, BONUS_TYPES } from './constants';

const COLORS = CORESAVARIALIST;
const SCREEN_COLOR = CORESFUNCIONALIDADES.actions['avaria-consultar'];

const AvariaListScreen = ({ navigation, isDarkMode }) => {
    const [loading, setLoading] = useState(false);
    const [batches, setBatches] = useState([]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const storedBatches = await AsyncStorage.getItem('avaria_batches');
            if (storedBatches) {
                setBatches(JSON.parse(storedBatches));
            }
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    const isFocused = useIsFocused();

    useEffect(() => {
        if (isFocused) {
            loadData();
        }
    }, [isFocused, loadData]);

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
                    title: 'Gestão de Avarias',
                    subtitle: 'Lotes pendentes',
                    iconName: 'layers',
                    tintColor: '#FFFFFF',
                }),
            headerRight: () =>
                createHeaderActionsTemplate({
                    isDarkMode,
                    actions: [
                        {
                            key: 'dashboard',
                            iconName: 'dashboard',
                            onPress: () => navigation.navigate('AvariaDashboardScreen'),
                            iconColor: '#FFFFFF',
                        },
                        {
                            key: 'history',
                            iconName: 'history',
                            onPress: () => navigation.navigate('AvariaHistoryScreen'),
                            iconColor: '#FFFFFF',
                        },
                        {
                            key: 'new-batch',
                            iconName: 'add-box',
                            onPress: () => navigation.navigate('AvariaEntryScreen'),
                            iconColor: '#FFFFFF',
                        },
                    ],
                }),
        });
    }, [navigation, isDarkMode]);

    const renderBatch = ({ item }) => {
        const bonusType = BONUS_TYPES[item.bonusType] || BONUS_TYPES.merchandise;
        const totalItems = item.items?.length || 0;

        return (
            <TouchableOpacity
                style={[styles.batchCard, isDarkMode && styles.darkBatchCard]}
                onPress={() => navigation.navigate('AvariaEntryScreen', { batchId: item.id })}
                activeOpacity={0.8}
            >
                <View style={styles.batchHeader}>
                    <View style={[styles.statusBadge, { backgroundColor: '#fb8c00' }]}>
                        <Text style={styles.statusText}>ABERTO</Text>
                    </View>
                    <Text style={[styles.batchId, isDarkMode && styles.darkBatchId]}>LOTE #{item.id.slice(-4)}</Text>
                </View>

                <View style={styles.batchBody}>
                    <View style={styles.mainInfo}>
                        <Text style={[styles.supplierName, isDarkMode && styles.darkSupplierName]} numberOfLines={1}>
                            {item.supplierName || 'Fornecedor não informado'}
                        </Text>
                        <View style={styles.bonusTypeContainer}>
                            <MaterialCommunityIcons name={bonusType.icon} size={16} color={bonusType.color} />
                            <Text style={[styles.bonusTypeText, { color: bonusType.color }]}>{bonusType.label}</Text>
                        </View>
                    </View>

                    <View style={styles.batchFooter}>
                        <View style={styles.footerStat}>
                            <MaterialIcons name="inventory" size={14} color="#888" />
                            <Text style={[styles.footerStatText, isDarkMode && styles.darkFooterStatText]}>{totalItems} itens</Text>
                        </View>
                        <Text style={[styles.batchDate, isDarkMode && styles.darkBatchDate]}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const renderSummary = () => (
        <View style={styles.summaryContainer}>
            <View style={[styles.summaryCard, { borderLeftColor: SCREEN_COLOR, borderLeftWidth: 4 }, isDarkMode && styles.darkSummaryCard]}>
                <Text style={[styles.summaryLabel, isDarkMode && styles.darkSummaryLabel]}>Lotes Pendentes</Text>
                <Text style={[styles.summaryValue, { color: SCREEN_COLOR }]}>
                    {batches.filter(b => b.status === 'open').length}
                </Text>
            </View>
            <View style={[styles.summaryCard, { borderLeftColor: '#43a047', borderLeftWidth: 4 }, isDarkMode && styles.darkSummaryCard]}>
                <Text style={[styles.summaryLabel, isDarkMode && styles.darkSummaryLabel]}>Total Itens (Abertos)</Text>
                <Text style={[styles.summaryValue, { color: '#43a047' }]}>
                    {batches.filter(b => b.status === 'open').reduce((acc, b) => acc + (b.items?.reduce((iAcc, item) => iAcc + (item.quantity || 0), 0) || 0), 0)}
                </Text>
            </View>
        </View>
    );

    return (
        <ScreenLayout
            isDarkMode={isDarkMode}
            lightBackground="#f8f9fa"
            darkBackground={COLORS.darkBackground}
            contentStyle={styles.container}
        >
            {renderSummary()}

            <View style={styles.listHeader}>
                <Text style={[styles.sectionTitle, isDarkMode && styles.darkSectionTitle]}>Lotes em Aberto</Text>
                <TouchableOpacity onPress={loadData} style={styles.refreshButton}>
                    <MaterialIcons name="refresh" size={20} color={SCREEN_COLOR} />
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={SCREEN_COLOR} style={styles.loadingIndicator} />
            ) : (
                <FlatList
                    data={batches.filter(b => b.status === 'open').sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))}
                    renderItem={renderBatch}
                    keyExtractor={item => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <MaterialCommunityIcons name="layers-off" size={64} color="#ccc" />
                            <Text style={[styles.emptyTitle, isDarkMode && styles.darkEmptyTitle]}>Nenhum lote pendente</Text>
                            <Text style={[styles.emptySubtitle, isDarkMode && styles.darkEmptySubtitle]}>
                                Tudo em dia! Use o histórico para ver lotes já concluídos.
                            </Text>
                        </View>
                    }
                />
            )}
        </ScreenLayout>
    );
};

const styles = StyleSheet.create({
    // ==================== Layout Geral ====================
    container: {
        flex: 1,
    },
    loadingIndicator: {
        marginTop: 40,
    },

    // ==================== Estilos do Sumário ====================
    summaryContainer: {
        flexDirection: 'row',
        padding: 16,
        gap: 12,
    },
    summaryCard: {
        flex: 1,
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 12,
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    darkSummaryCard: {
        backgroundColor: COLORS.cardDark,
    },
    summaryLabel: {
        fontSize: 12,
        color: '#666',
        fontWeight: '600',
        marginBottom: 4,
    },
    darkSummaryLabel: {
        color: '#aaa',
    },
    summaryValue: {
        fontSize: 18,
        fontWeight: '800',
    },

    // ==================== Estilos do Cabeçalho da Lista ====================
    listHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 8,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#333',
    },
    darkSectionTitle: {
        color: '#fff',
    },
    refreshButton: {
        padding: 4,
    },

    // ==================== Estilos dos Cards (Lotes) ====================
    listContent: {
        padding: 16,
        paddingTop: 0,
        paddingBottom: 100,
    },
    batchCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        marginBottom: 16,
        overflow: 'hidden',
        elevation: 3,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    darkBatchCard: {
        backgroundColor: COLORS.cardDark,
        borderColor: COLORS.borderDark,
    },
    batchHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        backgroundColor: 'rgba(0,0,0,0.02)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    statusText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '900',
    },
    batchId: {
        fontSize: 12,
        fontWeight: '600',
        color: '#888',
    },
    darkBatchId: {
        color: COLORS.textMutedDark,
    },
    batchBody: {
        padding: 16,
    },
    mainInfo: {
        marginBottom: 12,
    },
    supplierName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    darkSupplierName: {
        color: COLORS.textDark,
    },
    bonusTypeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    bonusTypeText: {
        fontSize: 13,
        fontWeight: '700',
    },
    batchFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)',
        paddingTop: 12,
        gap: 16,
    },
    footerStat: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    footerStatText: {
        fontSize: 13,
        color: '#666',
        fontWeight: '600',
    },
    darkFooterStatText: {
        color: COLORS.textMutedDark,
    },
    batchDate: {
        marginLeft: 'auto',
        fontSize: 12,
        color: '#999',
    },
    darkBatchDate: {
        color: COLORS.textMutedDark,
    },

    // ==================== Estilos de Lista Vazia ====================
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 60,
        padding: 40,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        marginTop: 16,
    },
    darkEmptyTitle: {
        color: COLORS.textDark,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#666',
        marginTop: 8,
        textAlign: 'center',
        lineHeight: 20,
    },
    darkEmptySubtitle: {
        color: '#aaa',
    },
});

export default AvariaListScreen;
