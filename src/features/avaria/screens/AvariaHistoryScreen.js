import React, { useState, useEffect, useCallback } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { View, FlatList, StyleSheet, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenLayout, {
    createScreenHeaderTemplate,
    createHeaderTitleTemplate,
    createHeaderActionsTemplate,
} from '../../../components/ScreenLayout';
import { CORESAVARIAHISTORY, CORESFUNCIONALIDADES } from '../../../components/coresAuth';
import Toast from 'react-native-toast-message';
import { BONUS_TYPES } from '../constants';
import {
    clearConcludedAvariaBatches,
    deleteAvariaBatch,
    listConcludedAvariaBatches,
} from '../services/avariaBatchService';

const COLORS = CORESAVARIAHISTORY;
const SCREEN_COLOR = CORESFUNCIONALIDADES.actions['avaria-historico'];

const AvariaHistoryScreen = ({ navigation, isDarkMode }) => {
    const [batches, setBatches] = useState([]);
    const [loading, setLoading] = useState(false);

    const loadHistory = useCallback(async () => {
        setLoading(true);
        try {
            setBatches(await listConcludedAvariaBatches());
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    const isFocused = useIsFocused();

    useEffect(() => {
        if (isFocused) {
            loadHistory();
        }
    }, [isFocused, loadHistory]);

    const confirmClearHistory = () => {
        Alert.alert(
            'Limpar Histórico',
            'Deseja remover permanentemente os lotes concluídos do histórico?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Limpar',
                    style: 'destructive',
                    onPress: async () => {
                        await clearConcludedAvariaBatches();
                        loadHistory();
                        Toast.show({ type: 'success', text1: 'Histórico de lotes limpo' });
                    }
                }
            ]
        );
    }

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
                    title: 'Lotes Finalizados',
                    subtitle: 'Histórico de Devoluções',
                    iconName: 'assignment-turned-in',
                    tintColor: '#FFFFFF',
                }),
            headerRight: () =>
                createHeaderActionsTemplate({
                    isDarkMode,
                    actions: [
                        {
                            key: 'clear',
                            iconName: 'delete-sweep',
                            onPress: confirmClearHistory,
                            iconColor: '#FFFFFF',
                        },
                    ],
                }),
        });
    }, [navigation, isDarkMode]);

    const renderSummary = () => (
        <View style={styles.summaryContainer}>
            <View style={[styles.summaryCard, { borderLeftColor: SCREEN_COLOR, borderLeftWidth: 4 }, isDarkMode && styles.darkSummaryCard]}>
                <Text style={[styles.summaryLabel, isDarkMode && styles.darkSummaryLabel]}>Lotes Processados</Text>
                <Text style={[styles.summaryValue, { color: SCREEN_COLOR }]}>
                    {batches.length}
                </Text>
            </View>
            <View style={[styles.summaryCard, { borderLeftColor: '#43a047', borderLeftWidth: 4 }, isDarkMode && styles.darkSummaryCard]}>
                <Text style={[styles.summaryLabel, isDarkMode && styles.darkSummaryLabel]}>Total Itens Devolvidos</Text>
                <Text style={[styles.summaryValue, { color: '#43a047' }]}>
                    {batches.reduce((acc, b) => acc + (b.items?.reduce((iAcc, item) => iAcc + (item.quantity || 0), 0) || 0), 0)}
                </Text>
            </View>
        </View>
    );

    const deleteBatch = (id) => {
        Alert.alert(
            'Excluir Lote',
            'Deseja remover este lote permanentemente do histórico?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Excluir',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteAvariaBatch(id);
                            loadHistory();
                            Toast.show({ type: 'success', text1: 'Lote removido do histórico' });
                        } catch (e) {
                            console.error(e);
                        }
                    }
                }
            ]
        );
    };

    const renderBatch = ({ item }) => {
        const bonusType = BONUS_TYPES[item.bonusType] || BONUS_TYPES.merchandise;
        const totalItems = item.items?.length || 0;

        return (
            <TouchableOpacity
                style={[styles.historyCard, isDarkMode && styles.darkHistoryCard]}
                onPress={() => navigation.navigate('AvariaEntryScreen', { batchId: item.id })}
                activeOpacity={0.8}
            >
                <View style={styles.cardHeader}>
                    <View style={[styles.statusBadge, { backgroundColor: '#43a047' }]}>
                        <Text style={styles.statusText}>CONCLUÍDO</Text>
                    </View>
                    <View style={styles.headerRightActions}>
                        <Text style={[styles.batchId, isDarkMode && styles.darkBatchId]}>LOTE #{item.id.slice(-4)}</Text>
                        <TouchableOpacity onPress={() => deleteBatch(item.id)} style={styles.deleteBtn}>
                            <MaterialIcons name="delete-outline" size={20} color={isDarkMode ? '#ff8a80' : '#d32f2f'} />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.cardBody}>
                    <View style={styles.mainInfo}>
                        <Text style={[styles.supplierName, isDarkMode && styles.darkSupplierName]} numberOfLines={1}>
                            {item.supplierName || 'Fornecedor não informado'}
                        </Text>
                        <View style={styles.bonusTypeContainer}>
                            <MaterialCommunityIcons name={bonusType.icon} size={16} color={bonusType.color} />
                            <Text style={[styles.bonusTypeText, { color: bonusType.color }]}>{bonusType.label}</Text>
                        </View>
                    </View>

                    <View style={styles.cardFooter}>
                        <View style={styles.footerStat}>
                            <MaterialIcons name="inventory" size={14} color="#888" />
                            <Text style={[styles.footerStatText, isDarkMode && styles.darkFooterStatText]}>{totalItems} itens</Text>
                        </View>
                        <Text style={[styles.dateText, isDarkMode && styles.darkDateText]}>Finalizado em {new Date(item.updatedAt).toLocaleDateString()}</Text>
                    </View>
                </View>
                <MaterialIcons name="chevron-right" size={24} color={isDarkMode ? COLORS.textMutedDark : '#ccc'} style={styles.chevron} />
            </TouchableOpacity>
        );
    };

    return (
        <ScreenLayout isDarkMode={isDarkMode} lightBackground="#f0f2f5" darkBackground={COLORS.backgroundDark || COLORS.darkBackground} contentStyle={styles.container}>
            {renderSummary()}

            <View style={styles.listHeader}>
                <Text style={[styles.sectionTitle, isDarkMode && styles.darkSectionTitle]}>Itens Processados</Text>
                <TouchableOpacity onPress={loadHistory} style={styles.refreshButton}>
                    <MaterialIcons name="refresh" size={20} color={SCREEN_COLOR} />
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={SCREEN_COLOR} style={styles.loadingIndicator} />
            ) : (
                <FlatList
                    data={batches}
                    renderItem={renderBatch}
                    keyExtractor={item => item.id?.toString()}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <MaterialCommunityIcons name="history" size={64} color="#ccc" />
                            <Text style={[styles.emptyTitle, isDarkMode && styles.darkEmptyTitle]}>Histórico Vazio</Text>
                            <Text style={[styles.emptySubtitle, isDarkMode && styles.darkEmptySubtitle]}>
                                Nenhum lote foi finalizado até o momento. Conclua um lote na tela anterior para vê-lo aqui.
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

    // ==================== Estilos dos Cards (Histórico) ====================
    listContent: {
        padding: 16,
        paddingTop: 0,
        paddingBottom: 40,
    },
    historyCard: {
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
    darkHistoryCard: {
        backgroundColor: COLORS.cardDark,
    },
    darkBatchCard: {
        backgroundColor: COLORS.cardDark,
        borderColor: COLORS.borderDark,
    },
    cardHeader: {
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
    headerRightActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    deleteBtn: {
        padding: 4,
    },
    cardBody: {
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
    cardFooter: {
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
    dateText: {
        marginLeft: 'auto',
        fontSize: 11,
        color: '#999',
    },
    darkDateText: {
        color: COLORS.textMutedDark,
    },
    chevron: {
        position: 'absolute',
        right: 8,
        top: '50%',
        marginTop: -12,
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
        color: '#fff',
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

export default AvariaHistoryScreen;
