import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Alert, Switch } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenLayout, {
    createScreenHeaderTemplate,
    createHeaderTitleTemplate,
} from '../../../shared/components/ScreenLayout';
import { CORESFUNCIONALIDADES } from '../../../shared/components/coresAuth';

const SCREEN_COLOR = CORESFUNCIONALIDADES.actions['avaria-lancar'];
import Toast from 'react-native-toast-message';
import { DAMAGE_TYPES } from './AvariaListScreen';

const AvariaEntryScreen = ({ navigation, isDarkMode }) => {
    const [productSearch, setProductSearch] = useState('');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [quantity, setQuantity] = useState('');
    const [damageType, setDamageType] = useState('broken');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);

    // Lista de produtos para autocomplete
    const [allProducts, setAllProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);

    useEffect(() => {
        loadProducts();

        navigation.setOptions({
            ...createScreenHeaderTemplate({
                isDarkMode,
                lightHeaderColor: SCREEN_COLOR,
                darkHeaderColor: SCREEN_COLOR, // Or derived darker color
                tintColor: '#FFFFFF',
            }),
            headerTitle: () =>
                createHeaderTitleTemplate({
                    title: 'Nova Avaria',
                    subtitle: 'Registrar item danificado',
                    iconName: 'add-alert',
                    tintColor: '#FFFFFF',
                }),
        });
    }, [navigation, isDarkMode]);

    const loadProducts = async () => {
        try {
            const stored = await AsyncStorage.getItem('products');
            if (stored) {
                // Carrega produtos normais (status != treated e != damaged)
                const products = JSON.parse(stored).filter(p => !p.status || (p.status !== 'treated' && p.status !== 'damaged'));
                setAllProducts(products);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleSearch = (text) => {
        setProductSearch(text);
        if (text.length > 1) {
            const filtered = allProducts.filter(p =>
                p.descricao?.toLowerCase().includes(text.toLowerCase()) ||
                p.codprod?.toString().includes(text)
            );
            setFilteredProducts(filtered);
            setShowDropdown(true);
        } else {
            setShowDropdown(false);
        }
    };

    const selectProduct = (prod) => {
        setSelectedProduct(prod);
        setProductSearch(prod.descricao);
        setShowDropdown(false);
    };

    const handleSave = async () => {
        if (!productSearch || !quantity || !damageType) {
            return Toast.show({ type: 'error', text1: 'Preencha todos os campos obrigatórios' });
        }

        if (selectedProduct && parseInt(quantity) > selectedProduct.quantidade) {
            return Toast.show({ type: 'error', text1: 'Quantidade maior que o estoque disponível' });
        }

        setLoading(true);
        try {
            const stored = await AsyncStorage.getItem('products');
            let currentProducts = stored ? JSON.parse(stored) : [];

            const qty = parseInt(quantity);

            // Lógica de Atualização
            // 1. Encontrar produto original para decrementar (se existir selecionado)
            // 2. Criar novo registro de avaria

            const newDamageEntry = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                descricao: selectedProduct ? selectedProduct.descricao : productSearch,
                codprod: selectedProduct ? selectedProduct.codprod : '',
                lote: selectedProduct ? selectedProduct.lote : '',
                validade: selectedProduct ? selectedProduct.validade : new Date().toISOString(),
                quantidade: qty,
                status: 'damaged',
                damageType,
                damageDate: new Date().toISOString(),
                notes,
                originalProductId: selectedProduct ? selectedProduct.id : null,
            };

            let updatedList = [];

            if (selectedProduct) {
                // Decrementa do original
                updatedList = currentProducts.flatMap(p => {
                    if (p.id === selectedProduct.id) {
                        const remaining = p.quantidade - qty;
                        if (remaining > 0) {
                            return [{ ...p, quantidade: remaining }, newDamageEntry];
                        } else {
                            // Se zerou, substitui pelo registro de avaria (ou remove o original e adiciona a avaria)
                            // Aqui vamos adicionar a avaria e remover o original da lista de 'ativos' implicitamente pois o original sumiu
                            return [newDamageEntry];
                        }
                    }
                    return [p];
                });
            } else {
                // Produto avulso (não estava no estoque ou não foi selecionado)
                updatedList = [...currentProducts, newDamageEntry];
            }

            await AsyncStorage.setItem('products', JSON.stringify(updatedList));

            Toast.show({ type: 'success', text1: 'Avaria registrada com sucesso' });
            navigation.goBack();

        } catch (error) {
            Toast.show({ type: 'error', text1: 'Erro ao salvar avaria' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScreenLayout isDarkMode={isDarkMode} lightBackground="#fff" darkBackground="#1a1a1a" contentStyle={styles.container}>
            <ScrollView contentContainerStyle={styles.scroll}>

                {/* Produto Input */}
                <View style={styles.inputGroup}>
                    <Text style={[styles.label, isDarkMode && styles.darkText]}>Produto Danificado *</Text>
                    <View style={[styles.inputContainer, isDarkMode && styles.darkInputContainer]}>
                        <MaterialIcons name="search" size={20} color="#999" style={{ marginRight: 8 }} />
                        <TextInput
                            style={[styles.input, isDarkMode && styles.darkInputText]}
                            placeholder="Digite o nome ou código..."
                            placeholderTextColor="#999"
                            value={productSearch}
                            onChangeText={handleSearch}
                        />
                        {selectedProduct && (
                            <TouchableOpacity onPress={() => { setSelectedProduct(null); setProductSearch(''); }}>
                                <MaterialIcons name="close" size={20} color={SCREEN_COLOR} />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Autocomplete Dropdown */}
                    {showDropdown && filteredProducts.length > 0 && (
                        <View style={[styles.dropdown, isDarkMode && styles.darkDropdown]}>
                            {filteredProducts.map(item => (
                                <TouchableOpacity key={item.id} style={styles.dropdownItem} onPress={() => selectProduct(item)}>
                                    <Text style={[styles.dropdownText, isDarkMode && styles.darkText]}>{item.descricao}</Text>
                                    <Text style={styles.dropdownSubtext}>Qtd: {item.quantidade} • Lote: {item.lote}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {selectedProduct && (
                        <Text style={styles.helperText}>Estoque atual: {selectedProduct.quantidade}</Text>
                    )}
                </View>

                {/* Quantidade */}
                <View style={styles.inputGroup}>
                    <Text style={[styles.label, isDarkMode && styles.darkText]}>Quantidade Avariada *</Text>
                    <View style={[styles.inputContainer, isDarkMode && styles.darkInputContainer]}>
                        <TextInput
                            style={[styles.input, isDarkMode && styles.darkInputText]}
                            placeholder="0"
                            placeholderTextColor="#999"
                            keyboardType="numeric"
                            value={quantity}
                            onChangeText={setQuantity}
                        />
                    </View>
                </View>

                {/* Tipo de Avaria */}
                <Text style={[styles.label, isDarkMode && styles.darkText, { marginTop: 10 }]}>Tipo de Problema *</Text>
                <View style={styles.typesContainer}>
                    {Object.entries(DAMAGE_TYPES).map(([key, type]) => (
                        <TouchableOpacity
                            key={key}
                            style={[
                                styles.typeCard,
                                damageType === key && { borderColor: type.color, backgroundColor: type.color + '10' },
                                isDarkMode && styles.darkTypeCard
                            ]}
                            onPress={() => setDamageType(key)}
                        >
                            <MaterialCommunityIcons
                                name={type.icon}
                                size={32}
                                color={damageType === key ? type.color : (isDarkMode ? '#666' : '#ccc')}
                            />
                            <Text style={[
                                styles.typeLabel,
                                damageType === key && { color: type.color, fontWeight: 'bold' },
                                isDarkMode && !damageType === key && { color: '#aaa' }
                            ]}>
                                {type.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Observação */}
                <View style={styles.inputGroup}>
                    <Text style={[styles.label, isDarkMode && styles.darkText]}>Observação (Opcional)</Text>
                    <View style={[styles.inputContainer, isDarkMode && styles.darkInputContainer, { height: 100, alignItems: 'flex-start' }]}>
                        <TextInput
                            style={[styles.input, isDarkMode && styles.darkInputText, { height: '100%', textAlignVertical: 'top' }]}
                            placeholder="Detalhes sobre o ocorrido..."
                            placeholderTextColor="#999"
                            multiline
                            value={notes}
                            onChangeText={setNotes}
                        />
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.saveButton, loading && styles.disabledButton]}
                    onPress={handleSave}
                    disabled={loading}
                >
                    <Text style={styles.saveButtonText}>{loading ? 'Salvando...' : 'Registrar Avaria'}</Text>
                </TouchableOpacity>

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
    inputGroup: {
        marginBottom: 20,
        zIndex: 1,
    },
    label: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 8,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 12,
        paddingHorizontal: 12,
        backgroundColor: '#f9f9f9',
        height: 50,
    },
    darkInputContainer: {
        backgroundColor: '#333',
        borderColor: '#444',
    },
    input: {
        flex: 1,
        color: '#333',
        fontSize: 16,
    },
    darkInputText: {
        color: '#fff',
    },
    dropdown: {
        position: 'absolute',
        top: 80,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderRadius: 8,
        elevation: 5,
        zIndex: 1000,
        maxHeight: 200,
        borderWidth: 1,
        borderColor: '#eee',
    },
    darkDropdown: {
        backgroundColor: '#2d2d2d',
        borderColor: '#444',
    },
    dropdownItem: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    dropdownText: {
        fontSize: 16,
        color: '#333',
    },
    dropdownSubtext: {
        fontSize: 12,
        color: '#888',
    },
    helperText: {
        fontSize: 12,
        color: '#0288d1',
        marginTop: 4,
        fontStyle: 'italic',
    },
    typesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 20,
    },
    typeCard: {
        width: '30%',
        aspectRatio: 1,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
        borderRadius: 12,
        backgroundColor: '#f5f5f5',
    },
    darkTypeCard: {
        backgroundColor: '#333',
    },
    typeLabel: {
        fontSize: 11,
        marginTop: 6,
        textAlign: 'center',
        color: '#666',
    },
    saveButton: {
        backgroundColor: SCREEN_COLOR,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 20,
        shadowColor: SCREEN_COLOR,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5,
    },
    disabledButton: {
        opacity: 0.7,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    darkText: {
        color: '#fff',
    },
});

export default AvariaEntryScreen;
