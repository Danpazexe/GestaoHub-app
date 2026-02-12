import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, Text, Image, ActivityIndicator, Alert } from 'react-native';
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

// Tipos de Avaria (Entrada)
export const DAMAGE_TYPES = {
    broken: { label: 'Quebrado', icon: 'glass-fragile', color: '#e53935' },
    leaking: { label: 'Vazando', icon: 'water', color: '#0288d1' },
    expired: { label: 'Vencido', icon: 'calendar-remove', color: '#fb8c00' },
    spoiled: { label: 'Estragado', icon: 'food-off', color: '#5d4037' },
    missing: { label: 'Faltando Peça', icon: 'puzzle', color: '#7b1fa2' },
    other: { label: 'Outro', icon: 'help-circle-outline', color: '#616161' },
};

const COLORS = CORESLIST;
const SCREEN_COLOR = CORESFUNCIONALIDADES.actions['avaria-consultar'];

const AvariaListScreen = ({ navigation, isDarkMode }) => {
    const [loading, setLoading] = useState(false);
    const [damagedItems, setDamagedItems] = useState([]);
    const [searchText, setSearchText] = useState('');

    // Carrega itens com status 'damaged'
    const loadDamagedItems = useCallback(async () => {
        setLoading(true);
        try {
            const storedProducts = await AsyncStorage.getItem('products');
            if (storedProducts) {
                const allProducts = JSON.parse(storedProducts);
                // Filtra APENAS os que estão em estagio de 'damaged' (pendentes de resolução)
                const pending = allProducts.filter(p => p.status === 'damaged');
                setDamagedItems(pending);
            }
        } catch (error) {
            console.error('Erro ao carregar avarias:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', loadDamagedItems);
        return unsubscribe;
    }, [navigation, loadDamagedItems]);

    useEffect(() => {
        navigation.setOptions({
            ...createScreenHeaderTemplate({
                isDarkMode,
                lightHeaderColor: SCREEN_COLOR, // Cor de alerta
                darkHeaderColor: SCREEN_COLOR,
                tintColor: '#FFFFFF',
            }),
            headerTitle: () =>
                createHeaderTitleTemplate({
                    title: 'Gestão de Avarias',
                    subtitle: 'Itens danificados pendentes',
                    iconName: 'broken-image',
                    tintColor: '#FFFFFF',
                }),
            headerRight: () =>
                createHeaderActionsTemplate({
                    isDarkMode,
                    actions: [
                        {
                            key: 'history',
                            iconName: 'history',
                            onPress: () => navigation.navigate('AvariaHistoryScreen'),
                            iconColor: '#FFFFFF',
                        },
                        {
                            key: 'add-damage',
                            iconName: 'add-circle-outline',
                            onPress: () => navigation.navigate('AvariaEntryScreen'), // Tela de registro manual
                            iconColor: '#FFFFFF',
                        },
                    ],
                }),
        });
    }, [navigation, isDarkMode]);

    const filteredItems = useMemo(() => {
        if (!searchText) return damagedItems;
        const lowerSearch = searchText.toLowerCase();
        return damagedItems.filter(item =>
            item.descricao?.toLowerCase().includes(lowerSearch) ||
            item.codprod?.toString().includes(lowerSearch)
        );
    }, [damagedItems, searchText]);

    const renderItem = ({ item }) => {
        const damageType = DAMAGE_TYPES[item.damageType] || DAMAGE_TYPES.other;

        return (
            <TouchableOpacity
                style={[styles.card, isDarkMode && styles.darkCard]}
                onPress={() => navigation.navigate('AvariaResolutionScreen', { item })} // Detalhes/Resolução
                activeOpacity={0.8}
            >
                <View style={[styles.iconContainer, { backgroundColor: damageType.color + '20' }]}>
                    <MaterialCommunityIcons name={damageType.icon} size={28} color={damageType.color} />
                </View>

                <View style={styles.cardContent}>
                    <Text style={[styles.itemTitle, isDarkMode && styles.darkText]} numberOfLines={1}>
                        {item.descricao}
                    </Text>
                    <View style={styles.detailsRow}>
                        <Text style={[styles.detailText, isDarkMode && styles.darkTextMuted]}>
                            Qtd: {item.quantidade}
                        </Text>
                        <Text style={[styles.detailText, isDarkMode && styles.darkTextMuted]}> • </Text>
                        <Text style={[styles.detailText, { color: damageType.color, fontWeight: 'bold' }]}>
                            {damageType.label}
                        </Text>
                    </View>
                    <Text style={[styles.dateText, isDarkMode && styles.darkTextMuted]}>
                        Registrado em: {new Date(item.damageDate).toLocaleDateString()}
                    </Text>
                </View>

                <MaterialIcons name="chevron-right" size={24} color={isDarkMode ? '#666' : '#ccc'} />
            </TouchableOpacity>
        );
    };

    return (
        <ScreenLayout
            isDarkMode={isDarkMode}
            lightBackground="#fff5f5" // Fundo levemente avermelhado
            darkBackground="#1a1a1a"
            contentStyle={styles.container}
        >
            <View style={styles.statsContainer}>
                <View style={[styles.statItem, { backgroundColor: isDarkMode ? '#333' : '#fff' }]}>
                    <Text style={[styles.statValue, { color: SCREEN_COLOR }]}>{damagedItems.length}</Text>
                    <Text style={[styles.statLabel, isDarkMode && styles.darkTextMuted]}>Itens Pendentes</Text>
                </View>
                <View style={[styles.statItem, { backgroundColor: isDarkMode ? '#333' : '#fff' }]}>
                    <Text style={[styles.statValue, { color: '#fb8c00' }]}>
                        {damagedItems.reduce((acc, curr) => acc + (parseInt(curr.quantidade) || 0), 0)}
                    </Text>
                    <Text style={[styles.statLabel, isDarkMode && styles.darkTextMuted]}>Total Unidades</Text>
                </View>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={SCREEN_COLOR} style={{ marginTop: 40 }} />
            ) : (
                <FlatList
                    data={filteredItems}
                    renderItem={renderItem}
                    keyExtractor={item => item.id?.toString()}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <MaterialCommunityIcons name="check-decagram" size={64} color="#4caf50" />
                            <Text style={[styles.emptyTitle, isDarkMode && styles.darkText]}>Tudo certo!</Text>
                            <Text style={[styles.emptySubtitle, isDarkMode && styles.darkTextMuted]}>Nenhuma avaria pendente de resolução.</Text>
                        </View>
                    }
                />
            )}
        </ScreenLayout>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    statsContainer: {
        flexDirection: 'row',
        padding: 16,
        gap: 12,
    },
    statItem: {
        flex: 1,
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: '#666',
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    listContent: {
        padding: 16,
        paddingTop: 0,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    darkCard: {
        backgroundColor: '#2d2d2d',
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    cardContent: {
        flex: 1,
    },
    itemTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    detailsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    detailText: {
        fontSize: 14,
        color: '#666',
    },
    dateText: {
        fontSize: 12,
        color: '#999',
    },
    darkText: {
        color: '#fff',
    },
    darkTextMuted: {
        color: '#aaa',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 80,
        opacity: 0.7,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#666',
        marginTop: 8,
        textAlign: 'center',
    },
});

export default AvariaListScreen;
