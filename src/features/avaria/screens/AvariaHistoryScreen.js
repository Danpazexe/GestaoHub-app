import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, Text, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenLayout, {
    createScreenHeaderTemplate,
    createHeaderTitleTemplate,
    createHeaderActionsTemplate,
} from '../../../shared/components/ScreenLayout';
import { CORESLIST, CORESFUNCIONALIDADES } from '../../../shared/components/coresAuth';
import Toast from 'react-native-toast-message';
import { DAMAGE_TYPES } from './AvariaListScreen';
import { RESOLUTION_TYPES } from './AvariaResolutionScreen';

// Mapeamento local caso precise usar aqui, ou exportar do outro arquivo (melhor exportar depois)
// Vou redeclarar por enquanto para nao quebrar se o import falhar
const RESOLUTION_COLORS = {
    discard: '#5d4037',
    supplier_return: '#1976d2',
    donation: '#e91e63',
    discount_sale: '#2e7d32',
    stock_return: '#fbc02d',
};

const AvariaHistoryScreen = ({ navigation, isDarkMode }) => {
    const [historyItems, setHistoryItems] = useState([]);
    const [loading, setLoading] = useState(false);

    const loadHistory = useCallback(async () => {
        setLoading(true);
        try {
            const stored = await AsyncStorage.getItem('products');
            if (stored) {
                const all = JSON.parse(stored);
                const resolved = all.filter(p => p.status === 'resolved').sort((a, b) => new Date(b.resolutionDate || b.damageDate) - new Date(a.resolutionDate || a.damageDate));
                setHistoryItems(resolved);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    const confirmClearHistory = () => {
        Alert.alert(
            'Limpar Histórico',
            'Deseja apagar permanentemente o histórico de avarias resolvidas?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Apagar Tudo',
                    style: 'destructive',
                    onPress: async () => {
                        const stored = await AsyncStorage.getItem('products');
                        if (stored) {
                            const all = JSON.parse(stored);
                            const active = all.filter(p => p.status !== 'resolved');
                            await AsyncStorage.setItem('products', JSON.stringify(active));
                            loadHistory();
                            Toast.show({ type: 'success', text1: 'Histórico limpo' });
                        }
                    }
                }
            ]
        );
    }

    const SCREEN_COLOR = CORESFUNCIONALIDADES.actions['avaria-historico'];

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
                    title: 'Histórico de Avarias',
                    subtitle: 'Itens resolvidos',
                    iconName: 'history',
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

    const renderItem = ({ item }) => {
        const resColor = RESOLUTION_COLORS[item.resolutionType] || '#999';
        const damageType = DAMAGE_TYPES[item.damageType] || { label: 'Outro', icon: 'help' };

        return (
            <View style={[styles.card, isDarkMode && styles.darkCard]}>
                <View style={[styles.statusLine, { backgroundColor: resColor }]} />
                <View style={styles.cardContent}>
                    <View style={styles.row}>
                        <Text style={[styles.title, isDarkMode && styles.darkText]}>{item.descricao}</Text>
                        <Text style={[styles.qty, { color: resColor }]}>{item.quantidade} un</Text>
                    </View>

                    <View style={styles.detailRow}>
                        <View style={[styles.pill, { backgroundColor: resColor + '20' }]}>
                            <Text style={[styles.pillText, { color: resColor }]}>{
                                item.resolutionType === 'discard' ? 'Descartado' :
                                    item.resolutionType === 'supplier_return' ? 'Devolvido' :
                                        item.resolutionType === 'donation' ? 'Doado' :
                                            item.resolutionType === 'discount_sale' ? 'Vendido' : 'Resolvido'
                            }</Text>
                        </View>
                        <Text style={[styles.date, isDarkMode && styles.darkTextMuted]}>
                            {new Date(item.resolutionDate).toLocaleDateString()}
                        </Text>
                    </View>

                    <View style={styles.noteContainer}>
                        <MaterialCommunityIcons name={damageType.icon} size={16} color="#666" style={{ marginRight: 4 }} />
                        <Text style={styles.noteText}>Motivo: {damageType.label}</Text>
                    </View>

                    {item.resolutionNote ? (
                        <Text style={styles.resolutionNote} numberOfLines={2}>Resol: "{item.resolutionNote}"</Text>
                    ) : null}
                </View>
            </View>
        );
    };

    return (
        <ScreenLayout isDarkMode={isDarkMode} lightBackground="#f5f5f5" darkBackground="#1a1a1a" contentStyle={styles.container}>
            <FlatList
                data={historyItems}
                renderItem={renderItem}
                keyExtractor={item => item.id?.toString()}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Text style={[styles.emptyText, isDarkMode && styles.darkTextMuted]}>Nenhum histórico encontrado</Text>
                    </View>
                }
            />
        </ScreenLayout>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    list: {
        padding: 16,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        marginBottom: 12,
        overflow: 'hidden',
        flexDirection: 'row',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    darkCard: {
        backgroundColor: '#2d2d2d',
    },
    statusLine: {
        width: 6,
        height: '100%',
    },
    cardContent: {
        flex: 1,
        padding: 12,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        flex: 1,
        marginRight: 8,
    },
    qty: {
        fontWeight: 'bold',
        fontSize: 16,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    pill: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    pillText: {
        fontSize: 11,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    date: {
        fontSize: 12,
        color: '#999',
    },
    noteContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    noteText: {
        fontSize: 12,
        color: '#666',
    },
    resolutionNote: {
        fontSize: 12,
        color: '#888',
        fontStyle: 'italic',
        marginTop: 4,
    },
    darkText: {
        color: '#fff',
    },
    darkTextMuted: {
        color: '#aaa',
    },
    empty: {
        marginTop: 50,
        alignItems: 'center',
    },
    emptyText: {
        color: '#666',
        fontSize: 16,
    }
});

export default AvariaHistoryScreen;
