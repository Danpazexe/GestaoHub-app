import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, Share, Platform, Image } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenLayout, {
    createScreenHeaderTemplate,
    createHeaderTitleTemplate,
} from '../../../components/ScreenLayout';
import { CORESAVARIAENTRY, CORESFUNCIONALIDADES } from '../../../components/coresAuth';
import Toast from 'react-native-toast-message';
import { BONUS_TYPES, DAMAGE_TYPES } from '../constants';
import {
    loadAvariaBatchById,
    saveAvariaBatch,
} from '../services/avariaBatchService';
import {
    getLookupField,
    loadCachedProducts,
    searchCachedProducts,
} from '../../../services/productLookupService';

const SCREEN_COLOR = CORESFUNCIONALIDADES.actions['avaria-lancar'];

const COLORS = {
    ...CORESAVARIAENTRY,
    dangerLight: '#B00020',
    dangerDark: '#FF6B6B',
    successLight: '#4CAF50',
    successDark: '#6EE7B7',
    borderDark: '#3a4265',
    neutralDark: '#26304a',
    neutralMid: '#6f789b',
    neutralLight: '#c2c8dd',
    fieldIconLight: '#3f476e',
    fieldIconDark: '#d6dbf1',
};

const AvariaEntryScreen = ({ navigation, route, isDarkMode }) => {
    const { batchId } = route.params || {};
    const [loading, setLoading] = useState(!!batchId);

    const palette = {
        background: isDarkMode ? '#1f2438' : '#f8f9fa',
        surface: isDarkMode ? '#262d47' : '#fff',
        border: isDarkMode ? '#3a4265' : 'rgba(0,0,0,0.05)',
        input: isDarkMode ? '#2b3350' : '#f1f3f5',
        text: isDarkMode ? '#f3f5ff' : '#333',
        textMuted: isDarkMode ? '#aab1cf' : '#666',
        textFaint: isDarkMode ? '#9fa7c7' : '#888',
        placeholder: isDarkMode ? '#9fa7c7' : '#999',
        emptyIcon: isDarkMode ? '#3a4265' : '#ccc',
        suggestionIcon: isDarkMode ? '#8e94af' : '#636b8f',
        closeIcon: isDarkMode ? '#aab1cf' : '#888',
    };

    // Header State
    const [supplierName, setSupplierName] = useState('');
    const [supplierSearch, setSupplierSearch] = useState('');
    const [supplierResults, setSupplierResults] = useState([]);
    const [bonusType, setBonusType] = useState('merchandise');
    const [batchNote, setBatchNote] = useState('');

    // Items State
    const [items, setItems] = useState([]);

    // Search/Add Item State
    const [showAddItem, setShowAddItem] = useState(false);
    const [productSearch, setProductSearch] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [itemQty, setItemQty] = useState('');
    const [itemDamageType, setItemDamageType] = useState('broken');
    const searchTimeout = useRef(null);
    const supplierTimeout = useRef(null);
    const [isFinished, setIsFinished] = useState(false);

    useEffect(() => {
        if (batchId) {
            loadBatch();
        }

        navigation.setOptions({
            ...createScreenHeaderTemplate({
                isDarkMode,
                lightHeaderColor: SCREEN_COLOR,
                darkHeaderColor: SCREEN_COLOR,
                tintColor: '#FFFFFF',
            }),
            headerTitle: () =>
                createHeaderTitleTemplate({
                    title: batchId ? 'Editar Lote' : 'Novo Lote',
                    subtitle: 'Gestão de Devoluções',
                    iconName: 'post-add',
                    tintColor: '#FFFFFF',
                }),
        });
    }, [navigation, isDarkMode, batchId]);

    const loadBatch = async () => {
        setLoading(true);
        try {
            const current = await loadAvariaBatchById(batchId);
            if (current) {
                setSupplierName(current.supplierName);
                setSupplierSearch(current.supplierName);
                setBonusType(current.bonusType);
                setBatchNote(current.notes || '');
                setItems(current.items || []);
                if (current.status && current.status !== 'open') {
                    setIsFinished(true);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const performSupplierSearch = async (query) => {
        setSupplierSearch(query);
        if (supplierTimeout.current) clearTimeout(supplierTimeout.current);

        const cleanQuery = query.toLowerCase().trim();
        if (!cleanQuery) {
            setSupplierResults([]);
            return;
        }

        supplierTimeout.current = setTimeout(async () => {
            try {
                const products = await loadCachedProducts();
                const suppliers = Array.from(new Set(products.map((p) => {
                    const fornecedor = getLookupField(p, 'fornecedor');
                    const marca = getLookupField(p, 'marca');
                    const safe = fornecedor || marca;
                    return safe ? String(safe).trim() : null;
                }))).filter(Boolean);

                const filtered = suppliers.filter(s =>
                    s.toLowerCase().includes(cleanQuery)
                ).slice(0, 15);

                setSupplierResults(filtered);
            } catch (e) { console.error(e); }
        }, 350);
    };

    const selectSupplier = (name) => {
        setSupplierName(name);
        setSupplierSearch(name);
        setSupplierResults([]);
        Toast.show({
            type: 'success',
            text1: 'Fornecedor Selecionado',
            visibilityTime: 1500,
        });
    };

    const performProductSearch = async (query) => {
        setProductSearch(query);
        if (searchTimeout.current) clearTimeout(searchTimeout.current);

        const cleanQuery = query.toLowerCase().trim();
        if (!cleanQuery) {
            setSearchResults([]);
            return;
        }

        searchTimeout.current = setTimeout(async () => {
            try {
                setSearchResults(await searchCachedProducts(cleanQuery, 15));
            } catch (e) { console.error(e); }
        }, 350);
    };

    const selectProduct = (p) => {
        const desc = getLookupField(p, 'descricao');
        const cod = getLookupField(p, 'codprod');
        const ean = getLookupField(p, 'codauxiliar');

        setSelectedProduct({ ...p, desc, cod, ean });
        setProductSearch(desc);
        setSearchResults([]);
    };

    const addItemToBatch = () => {
        if ((!selectedProduct && !productSearch) || !itemQty) {
            return Toast.show({ type: 'error', text1: 'Informe o produto e a quantidade' });
        }

        const newItem = {
            id: Date.now().toString(),
            productId: selectedProduct ? (selectedProduct.id || selectedProduct.cod) : 'MANUAL',
            descricao: selectedProduct ? selectedProduct.desc : productSearch,
            codprod: selectedProduct ? selectedProduct.cod : 'MANUAL',
            quantity: parseInt(itemQty),
            damageType: itemDamageType,
            cost: 0,
        };

        setItems([...items, newItem]);
        resetItemForm();
        setShowAddItem(false);
    };

    const resetItemForm = () => {
        setSelectedProduct(null);
        setProductSearch('');
        setItemQty('');
        setItemDamageType('broken');
    };

    const removeItem = (id) => {
        setItems(items.filter(i => i.id !== id));
    };

    const shareBatchSummary = async () => {
        if (items.length === 0) return Toast.show({ type: 'info', text1: 'Adicione itens para compartilhar' });

        const type = BONUS_TYPES[bonusType]?.label || 'Avaria';
        let message = `*SOLICITAÇÃO DE BÔNUS/AVARIA*\n`;
        message += `----------------------------\n`;
        message += `*Fornecedor:* ${supplierName}\n`;
        message += `*Tipo:* ${type}\n`;
        message += `*Data:* ${new Date().toLocaleDateString()}\n\n`;
        message += `*ITENS:*\n`;

        items.forEach((item, idx) => {
            message += `${idx + 1}. ${item.descricao}\n`;
            message += `   Qtd: ${item.quantity} | Motivo: ${DAMAGE_TYPES[item.damageType]?.label}\n`;
        });

        try {
            await Share.share({ message });
        } catch (error) {
            console.error(error);
        }
    };

    const saveBatch = async (finalStatus = 'open') => {
        const finalSupplierName = supplierName || supplierSearch;

        if (!finalSupplierName) {
            return Toast.show({ type: 'error', text1: 'Informe o fornecedor' });
        }

        setLoading(true);
        try {
            const existingBatch = batchId ? await loadAvariaBatchById(batchId) : null;

            const batchData = {
                id: batchId || Date.now().toString(),
                supplierName: finalSupplierName,
                bonusType,
                notes: batchNote,
                items,
                status: finalStatus,
                updatedAt: new Date().toISOString(),
                createdAt: existingBatch?.createdAt || new Date().toISOString(),
            };

            await saveAvariaBatch(batchData);
            Toast.show({ type: 'success', text1: 'Lote salvo com sucesso' });
            navigation.goBack();
        } catch (e) {
            console.error(e);
            Toast.show({ type: 'error', text1: 'Erro ao salvar lote' });
        } finally {
            setLoading(false);
        }
    };

    const renderSuggestions = (type) => {
        const results = type === 'supplier' ? supplierResults : searchResults;
        if (results.length === 0) return null;

        return (
            <View style={[styles.suggestionsContainer, isDarkMode && styles.darkSuggestionsContainer]}>
                <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled={true}>
                    {results.map((item, idx) => (
                        <TouchableOpacity
                            key={idx}
                            style={[styles.suggestionItem, isDarkMode && styles.darkSuggestionItem]}
                            onPress={() => type === 'supplier' ? selectSupplier(item) : selectProduct(item)}
                        >
                            <View style={styles.suggestionIcon}>
                                <MaterialCommunityIcons
                                    name={type === 'supplier' ? "office-building" : "package-variant"}
                                    size={20}
                                    color={palette.suggestionIcon}
                                />
                            </View>
                            <View style={styles.suggestionTextContainer}>
                                <Text style={[styles.suggestionTitle, isDarkMode && styles.darkText]} numberOfLines={1}>
                                    {type === 'supplier' ? item : getLookupField(item, 'descricao')}
                                </Text>
                                {type === 'product' && (
                                    <Text style={[styles.suggestionSubtitle, isDarkMode && styles.darkSuggestionSubtitle]}>
                                        Cód: {getLookupField(item, 'codprod')}
                                    </Text>
                                )}
                            </View>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        );
    };

    if (loading && !batchId) return <ActivityIndicator style={{ flex: 1 }} />;

    return (
        <ScreenLayout isDarkMode={isDarkMode} lightBackground="#f8f9fa" darkBackground={COLORS.darkBackground} contentStyle={styles.container}>
            <ScrollView keyboardShouldPersistTaps="handled">
                {/* Seção de Identificação */}
                <View style={[styles.section, isDarkMode && styles.darkSection]}>
                    <Text style={[styles.sectionTitle, isDarkMode && styles.darkSectionTitle]}>Identificação do Lote (Capa)</Text>

                    <View style={[styles.inputGroup, { zIndex: 1000 }]}>
                        <Text style={[styles.label, isDarkMode && styles.darkLabel]}>Fornecedor</Text>
                        <View style={[styles.inputWrapper, { zIndex: 1001 }]}>
                            <View style={[styles.inputContainer, isDarkMode && styles.darkInputContainer]}>
                                <TextInput
                                    style={[styles.input, isDarkMode && styles.darkInputText]}
                                    placeholder="Busque o Fornecedor..."
                                    placeholderTextColor={palette.placeholder}
                                    value={supplierSearch}
                                    onChangeText={performSupplierSearch}
                                    editable={!isFinished}
                                />
                                {supplierName === supplierSearch && supplierName !== '' && (
                                    <MaterialIcons name="check-circle" size={20} color="#43a047" style={{ marginRight: 8 }} />
                                )}
                            </View>
                            {renderSuggestions('supplier')}
                        </View>
                    </View>

                    <Text style={[styles.label, isDarkMode && styles.darkLabel]}>Tipo de Verba / Bônus</Text>
                    <View style={styles.bonusGrid}>
                        {Object.entries(BONUS_TYPES).map(([key, type]) => (
                            <TouchableOpacity
                                key={key}
                                style={[
                                    styles.bonusCard,
                                    bonusType === key && { borderColor: type.color, backgroundColor: type.color + '10' },
                                    isDarkMode && styles.darkBonusCard
                                ]}
                                onPress={() => !isFinished && setBonusType(key)}
                                disabled={isFinished}
                            >
                                <MaterialCommunityIcons name={type.icon} size={24} color={bonusType === key ? type.color : palette.textFaint} />
                                <Text style={[styles.bonusLabel, isDarkMode && styles.darkBonusLabel, bonusType === key && { color: type.color, fontWeight: 'bold' }]}>{type.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Seção de Itens */}
                <View style={[styles.section, isDarkMode && styles.darkSection]}>
                    <View style={styles.sectionHeader}>
                        <Text style={[styles.sectionTitle, isDarkMode && styles.darkSectionTitle]}>Itens do Lote ({items.length})</Text>
                        {!isFinished && (
                            <TouchableOpacity style={styles.addItemBtn} onPress={() => setShowAddItem(true)}>
                                <MaterialIcons name="add-circle" size={24} color={SCREEN_COLOR} />
                                <Text style={styles.addItemText}>Adicionar</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {items.length === 0 ? (
                        <View style={styles.emptyItems}>
                            <MaterialCommunityIcons name="playlist-minus" size={48} color={palette.emptyIcon} />
                            <Text style={[styles.emptyItemsText, isDarkMode && styles.darkEmptyItemsText]}>Nenhum item adicionado ainda.</Text>
                        </View>
                    ) : (
                        items.map((item, index) => (
                            <View key={item.id} style={[styles.itemCard, isDarkMode && styles.darkItemCard]}>
                                <View style={styles.itemMain}>
                                    <Text style={[styles.itemDesc, isDarkMode && styles.darkText]} numberOfLines={1}>{item.descricao}</Text>
                                    <View style={styles.itemMeta}>
                                        <Text style={[styles.itemBadge, isDarkMode && styles.darkItemBadge]}>Qtd: {item.quantity}</Text>
                                        <Text style={[styles.itemBadge, { color: DAMAGE_TYPES[item.damageType]?.color }]}>
                                            • {DAMAGE_TYPES[item.damageType]?.label}
                                        </Text>
                                        <Text style={[styles.itemBadge, isDarkMode && styles.darkItemBadge]}>• Cód: {item.codprod}</Text>
                                    </View>
                                </View>
                                {!isFinished && (
                                    <TouchableOpacity onPress={() => removeItem(item.id)}>
                                        <MaterialIcons name="delete-outline" size={22} color="#e53935" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        ))
                    )}
                </View>

                {/* Ações Inferiores */}
                {!isFinished && (
                    <View style={styles.actionArea}>
                        <TouchableOpacity
                            style={[styles.saveBatchBtn, { backgroundColor: '#43a047' }]}
                            onPress={() => saveBatch('open')}
                        >
                            <Text style={styles.btnText}>{batchId ? 'Salvar Alterações' : 'Criar Lote'}</Text>
                        </TouchableOpacity>

                        {batchId && (
                            <TouchableOpacity
                                style={[styles.saveBatchBtn, isDarkMode ? styles.darkConcludeBtn : styles.lightConcludeBtn]}
                                onPress={() => saveBatch('concluded')}
                            >
                                <MaterialCommunityIcons
                                    name="check-all"
                                    size={20}
                                    color={isDarkMode ? COLORS.textMutedDark : '#666'}
                                    style={styles.btnIcon}
                                />
                                <Text style={[styles.btnText, isDarkMode ? styles.darkConcludeBtnText : styles.lightConcludeBtnText]}>
                                    Concluir e Enviar p/ Histórico
                                </Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={[styles.saveBatchBtn, { backgroundColor: SCREEN_COLOR, flexDirection: 'row', marginTop: 12 }]}
                            onPress={shareBatchSummary}
                        >
                            <MaterialCommunityIcons name="share-variant" size={20} color="#fff" style={styles.btnIcon} />
                            <Text style={styles.btnText}>Compartilhar com Fornecedor</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {isFinished && (
                    <View style={styles.actionArea}>
                        <TouchableOpacity
                            style={[styles.saveBatchBtn, { backgroundColor: SCREEN_COLOR, flexDirection: 'row' }]}
                            onPress={shareBatchSummary}
                        >
                            <MaterialCommunityIcons name="share-variant" size={20} color="#fff" style={styles.btnIcon} />
                            <Text style={styles.btnText}>Compartilhar com Fornecedor</Text>
                        </TouchableOpacity>

                        <View style={{ marginTop: 20, alignItems: 'center' }}>
                            <Text style={{ color: palette.textMuted, fontStyle: 'italic' }}>Este lote está finalizado e não pode ser editado.</Text>
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* Modal para Adicionar Item */}
            {showAddItem && (
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, isDarkMode && styles.darkModalContent]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, isDarkMode && styles.darkText]}>Adicionar Item</Text>
                            <TouchableOpacity onPress={() => setShowAddItem(false)}>
                                <MaterialIcons name="close" size={24} color={palette.closeIcon} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalBody}>
                            <Text style={[styles.label, isDarkMode && styles.darkLabel]}>Buscar Produto</Text>
                            <View style={[styles.inputWrapper, { zIndex: 1000 }]}>
                                <View style={[styles.inputContainer, isDarkMode && styles.darkInputContainer]}>
                                    <TextInput
                                        style={[styles.input, isDarkMode && styles.darkInputText]}
                                        placeholder="Nome, Código ou EAN..."
                                        placeholderTextColor={palette.placeholder}
                                        value={productSearch}
                                        onChangeText={performProductSearch}
                                    />
                                </View>
                                {renderSuggestions('product')}
                            </View>

                            <View style={styles.qtyInputContainer}>
                                <Text style={[styles.label, isDarkMode && styles.darkLabel]}>Quantidade</Text>
                                <View style={[styles.inputContainer, isDarkMode && styles.darkInputContainer]}>
                                    <TextInput
                                        style={[styles.input, isDarkMode && styles.darkInputText]}
                                        placeholder="0"
                                        placeholderTextColor={palette.placeholder}
                                        keyboardType="numeric"
                                        value={itemQty}
                                        onChangeText={setItemQty}
                                    />
                                </View>
                            </View>

                            <Text style={[styles.label, isDarkMode && styles.darkLabel, styles.damageTitle]}>Motivo do Dano</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.damageScroll}>
                                {Object.entries(DAMAGE_TYPES).map(([key, type]) => (
                                    <TouchableOpacity
                                        key={key}
                                        style={[styles.damageChip, isDarkMode && styles.darkDamageChip, itemDamageType === key && { backgroundColor: type.color }]}
                                        onPress={() => setItemDamageType(key)}
                                    >
                                        <Text style={[styles.damageChipText, isDarkMode && styles.darkDamageChipText, itemDamageType === key && styles.damageChipTextActive]}>
                                            {type.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        <TouchableOpacity style={styles.confirmItemBtn} onPress={addItemToBatch}>
                            <Text style={styles.confirmItemText}>Adicionar ao Lote</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </ScreenLayout>
    );
};

const styles = StyleSheet.create({
    // ==================== Layout Geral ====================
    container: {
        flex: 1,
    },
    section: {
        backgroundColor: '#fff',
        padding: 16,
        margin: 12,
        borderRadius: 16,
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    darkSection: {
        backgroundColor: COLORS.cardDark,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 16,
    },
    darkSectionTitle: {
        color: COLORS.textDark,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },

    // ==================== Inputs e Labels ====================
    inputGroup: {
        marginBottom: 16,
        elevation: 11,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: '#666',
        marginBottom: 6,
    },
    darkLabel: {
        color: COLORS.textMutedDark,
    },
    inputWrapper: {
        position: 'relative',
        zIndex: 1000,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 48,
        backgroundColor: '#f1f3f5',
        borderRadius: 10,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
        zIndex: 1,
    },
    darkInputContainer: {
        backgroundColor: COLORS.inputDark || COLORS.cardDark,
        borderColor: COLORS.borderDark,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#333',
        height: '100%',
    },
    darkInputText: {
        color: COLORS.textDark,
    },

    // ==================== Sugestões (Dropdown) Estilo AddProduct ====================
    suggestionsContainer: {
        position: 'absolute',
        top: 50,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(60, 68, 108, 0.2)',
        marginTop: 2,
        elevation: 10,
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 4 },
        zIndex: 9999,
        overflow: 'hidden',
        maxHeight: 250,
    },
    darkSuggestionsContainer: {
        backgroundColor: COLORS.inputDark || COLORS.cardDark,
        borderColor: COLORS.borderDark,
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    },
    darkSuggestionItem: {
        borderBottomColor: COLORS.borderDark,
    },
    suggestionIcon: {
        marginRight: 10,
    },
    suggestionTextContainer: {
        flex: 1,
    },
    suggestionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
    suggestionSubtitle: {
        fontSize: 12,
        color: 'rgba(0,0,0,0.5)',
        marginTop: 2,
    },
    darkSuggestionSubtitle: {
        color: COLORS.textMutedDark,
    },

    // ==================== Grade de Bônus ====================
    bonusGrid: {
        flexDirection: 'row',
        gap: 10,
    },
    bonusCard: {
        flex: 1,
        height: 80,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#eee',
        padding: 4,
    },
    darkBonusCard: {
        backgroundColor: COLORS.inputDark,
        borderColor: COLORS.borderDark,
    },
    bonusLabel: {
        fontSize: 10,
        marginTop: 4,
        textAlign: 'center',
        color: '#666',
    },
    darkBonusLabel: {
        color: COLORS.textMutedDark,
    },

    // ==================== Lista de Itens ====================
    addItemBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    addItemText: {
        fontWeight: '700',
        color: SCREEN_COLOR,
    },
    emptyItems: {
        padding: 40,
        alignItems: 'center',
    },
    emptyItemsText: {
        color: '#888',
        marginTop: 8,
    },
    darkEmptyItemsText: {
        color: COLORS.textMutedDark,
    },
    itemCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f1f1',
    },
    darkItemCard: {
        borderBottomColor: COLORS.borderDark,
    },
    itemMain: {
        flex: 1,
    },
    itemDesc: {
        fontSize: 15,
        fontWeight: '600',
        color: '#333',
    },
    itemMeta: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 4,
    },
    itemBadge: {
        fontSize: 12,
        color: '#888',
    },
    darkItemBadge: {
        color: COLORS.textMutedDark,
    },

    // ==================== Área de Ações (Botões) ====================
    actionArea: {
        padding: 12,
        gap: 12,
        marginBottom: 40,
    },
    saveBatchBtn: {
        height: 52,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    btnIcon: {
        marginRight: 8,
    },
    btnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    lightConcludeBtn: {
        backgroundColor: '#f5f5f5',
        borderWidth: 1,
        borderColor: '#ddd',
    },
    darkConcludeBtn: {
        backgroundColor: COLORS.cardDark,
        borderWidth: 1,
        borderColor: COLORS.borderDark,
    },
    lightConcludeBtnText: {
        color: '#666',
    },
    darkConcludeBtnText: {
        color: COLORS.textMutedDark,
    },

    // ==================== Estilos do Modal ====================
    modalOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
    },
    modalContent: {
        width: '94%',
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        elevation: 10,
    },
    darkModalContent: {
        backgroundColor: COLORS.cardDark,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    modalBody: {},
    qtyInputContainer: {
        marginTop: 12,
    },
    damageTitle: {
        marginTop: 12,
    },
    damageScroll: {
        marginBottom: 20,
    },
    damageChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: '#f1f3f5',
        marginRight: 8,
    },
    darkDamageChip: {
        backgroundColor: COLORS.inputDark,
    },
    damageChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#666',
    },
    darkDamageChipText: {
        color: COLORS.textMutedDark,
    },
    damageChipTextActive: {
        color: '#fff',
    },
    confirmItemBtn: {
        backgroundColor: SCREEN_COLOR,
        height: 52,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10,
    },
    confirmItemText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },

    // ==================== Utilidades ====================
    darkText: {
        color: COLORS.textDark,
    },
});

export default AvariaEntryScreen;
