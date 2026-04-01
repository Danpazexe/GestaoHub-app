import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, TextInput } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenLayout, {
    createScreenHeaderTemplate,
    createHeaderTitleTemplate,
} from '../../../components/ScreenLayout';
import { CORESAVARIARESOLUTION, CORESFUNCIONALIDADES } from '../../../components/coresAuth';
import Toast from 'react-native-toast-message';
import { DAMAGE_TYPES, RESOLUTION_TYPES } from '../constants';
import {
    readValidadeProductsCache,
    writeValidadeProductsCache,
} from '../../validade/storage/validadeProductsStorage';

// RESOLUTION_TYPES moved to constants/index.js

const COLORS = CORESAVARIARESOLUTION;
const AvariaResolutionScreen = ({ navigation, route, isDarkMode }) => {
    const { item } = route.params;
    const [resolutionNote, setResolutionNote] = useState('');
    const [loading, setLoading] = useState(false);
    const SCREEN_COLOR = CORESFUNCIONALIDADES.actions['avaria-resolucao'];

    React.useEffect(() => {
        navigation.setOptions({
            ...createScreenHeaderTemplate({
                isDarkMode,
                lightHeaderColor: SCREEN_COLOR,
                darkHeaderColor: SCREEN_COLOR,
                tintColor: '#FFFFFF',
            }),
            headerTitle: () =>
                createHeaderTitleTemplate({
                    title: 'Resolver Avaria',
                    subtitle: 'Definir destino do item',
                    iconName: 'build',
                    tintColor: '#FFFFFF',
                }),
        });
    }, [navigation, isDarkMode]);

    const handleResolution = async (typeKey) => {
        Alert.alert(
            'Confirmar Resolução',
            `Deseja marcar este item como "${RESOLUTION_TYPES[typeKey].label}"?`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Confirmar',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const allProducts = await readValidadeProductsCache();

                            if (typeKey === 'stock_return') {
                                // Retornar ao estoque:
                                // 1. Tentar achar o produto original (pelo ID ou codprod/lote) e somar a quantidade.
                                // 2. Se não achar, criar novo produto normal.
                                // 3. Remover este item de 'damaged'.

                                let productRestored = false;

                                // Tenta encontrar um produto compatível para somar
                                const updatedList = allProducts.map(p => {
                                    if (p.id !== item.id && !p.status && p.codprod === item.codprod && p.lote === item.lote) {
                                        productRestored = true;
                                        return { ...p, quantidade: parseInt(p.quantidade) + parseInt(item.quantidade) };
                                    }
                                    return p;
                                });

                                if (productRestored) {
                                    // Remove o item avariado, pois foi fundido
                                    const finalList = updatedList.filter(p => p.id !== item.id);
                                    await writeValidadeProductsCache(finalList);
                                } else {
                                    // Cria como produto normal (remove status damaged)
                                    const finalList = allProducts.map(p => {
                                        if (p.id === item.id) {
                                            const { status, damageType, damageDate, notes, originalProductId, ...rest } = p;
                                            return { ...rest }; // Remove propriedades de avaria
                                        }
                                        return p;
                                    });
                                    await writeValidadeProductsCache(finalList);
                                }

                            } else {
                                // Outras resoluções (Descarte, Doação, etc)
                                // Mantém o item, mas muda status para 'resolved' e salva tipo de resolução
                                const updatedList = allProducts.map(p => {
                                    if (p.id === item.id) {
                                        return {
                                            ...p,
                                            status: 'resolved', // Sai da lista de 'damaged'
                                            resolutionType: typeKey,
                                            resolutionDate: new Date().toISOString(),
                                            resolutionNote,
                                        };
                                    }
                                    return p;
                                });
                                await writeValidadeProductsCache(updatedList);
                            }

                            Toast.show({ type: 'success', text1: 'Avaria resolvida com sucesso' });
                            navigation.goBack();
                        } catch (error) {
                            Toast.show({ type: 'error', text1: 'Erro ao resolver' });
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const damageInfo = DAMAGE_TYPES[item.damageType] || DAMAGE_TYPES.other;

    return (
        <ScreenLayout isDarkMode={isDarkMode} lightBackground="#fff" darkBackground={COLORS.backgroundDark || COLORS.darkBackground} contentStyle={styles.container}>
            <ScrollView contentContainerStyle={styles.scroll}>

                {/* Card do Item */}
                <View style={[styles.itemCard, isDarkMode && styles.darkItemCard]}>
                    <View style={[styles.damageBadge, { backgroundColor: damageInfo.color }]}>
                        <MaterialCommunityIcons name={damageInfo.icon} size={24} color="#fff" />
                        <Text style={styles.damageBadgeText}>{damageInfo.label}</Text>
                    </View>

                    <Text style={[styles.itemTitle, isDarkMode && styles.darkText]}>{item.descricao}</Text>
                    <View style={styles.infoRow}>
                        <View style={styles.infoBlock}>
                            <Text style={styles.label}>Quantidade</Text>
                            <Text style={[styles.value, isDarkMode && styles.darkText]}>{item.quantidade} un</Text>
                        </View>
                        <View style={[styles.separator, { backgroundColor: isDarkMode ? '#444' : '#eee' }]} />
                        <View style={styles.infoBlock}>
                            <Text style={styles.label}>Lote</Text>
                            <Text style={[styles.value, isDarkMode && styles.darkText]}>{item.lote || '-'}</Text>
                        </View>
                        <View style={[styles.separator, { backgroundColor: isDarkMode ? '#444' : '#eee' }]} />
                        <View style={styles.infoBlock}>
                            <Text style={styles.label}>Data Avaria</Text>
                            <Text style={[styles.value, isDarkMode && styles.darkText]}>{new Date(item.damageDate).toLocaleDateString()}</Text>
                        </View>
                    </View>

                    {item.notes ? (
                        <View style={[styles.notesBox, isDarkMode && styles.darkNotesBox]}>
                            <Text style={[styles.noteText, isDarkMode && styles.darkTextMuted]}>"{item.notes}"</Text>
                        </View>
                    ) : null}
                </View>

                <Text style={[styles.sectionTitle, isDarkMode && styles.darkText]}>Resolução do Problema</Text>
                <Text style={[styles.sectionSubtitle, isDarkMode && styles.darkTextMuted]}>O que será feito com este item?</Text>

                <TextInput
                    style={[styles.input, isDarkMode && styles.darkInput]}
                    placeholder="Observação da resolução (opcional)..."
                    placeholderTextColor={isDarkMode ? COLORS.textMutedDark : '#999'}
                    value={resolutionNote}
                    onChangeText={setResolutionNote}
                />

                <View style={styles.actionsGrid}>
                    {Object.entries(RESOLUTION_TYPES).map(([key, res]) => (
                        <TouchableOpacity
                            key={key}
                            style={[styles.actionCard, isDarkMode && styles.darkResolutionCard]}
                            onPress={() => handleResolution(key)}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.actionIcon, { backgroundColor: res.color + '20' }]}>
                                <MaterialIcons name={res.icon} size={28} color={res.color} />
                            </View>
                            <View style={styles.actionContent}>
                                <Text style={[styles.actionTitle, { color: res.color }]}>{res.label}</Text>
                                <Text style={[styles.actionDesc, isDarkMode && styles.darkTextMuted]}>{res.desc}</Text>
                            </View>
                            <MaterialIcons name="chevron-right" size={20} color="#ccc" />
                        </TouchableOpacity>
                    ))}
                </View>

            </ScrollView>
        </ScreenLayout>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scroll: {
        padding: 20,
    },
    itemCard: {
        backgroundColor: '#f8f9fa',
        borderRadius: 16,
        padding: 20,
        marginBottom: 30,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#eee',
    },
    darkItemCard: {
        backgroundColor: COLORS.cardDark,
        borderColor: '#444',
    },
    damageBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 20,
        marginBottom: 16,
        gap: 8,
    },
    damageBadgeText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    itemTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333',
        textAlign: 'center',
        marginBottom: 20,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        width: '100%',
        marginBottom: 20,
    },
    infoBlock: {
        alignItems: 'center',
        flex: 1,
    },
    separator: {
        width: 1,
        height: '80%',
        backgroundColor: '#eee',
    },
    label: {
        fontSize: 12,
        color: '#888',
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    value: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    notesBox: {
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 8,
        width: '100%',
        borderLeftWidth: 4,
        borderLeftColor: '#ccc',
    },
    darkNotesBox: {
        backgroundColor: '#444',
        borderLeftColor: '#666',
    },
    noteText: {
        fontStyle: 'italic',
        color: '#666',
        textAlign: 'center',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    sectionSubtitle: {
        fontSize: 14,
        color: '#666',
        marginBottom: 20,
    },
    input: {
        backgroundColor: '#f5f5f5',
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#eee',
    },
    darkInput: {
        backgroundColor: '#333',
        borderColor: '#444',
        color: COLORS.textDark,
    },
    actionsGrid: {
        gap: 12,
        paddingBottom: 40,
    },
    actionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#eee',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    darkResolutionCard: {
        backgroundColor: COLORS.cardDark,
        borderColor: COLORS.borderDark,
    },
    actionIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    actionContent: {
        flex: 1,
    },
    actionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    actionDesc: {
        fontSize: 12,
        color: '#666',
    },
    darkText: {
        color: COLORS.textDark,
    },
    darkTextMuted: {
        color: COLORS.textMutedDark,
    },
});

export default AvariaResolutionScreen;
