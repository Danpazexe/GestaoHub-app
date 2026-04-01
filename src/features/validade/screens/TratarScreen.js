import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import Share from 'react-native-share';
import { Menu } from 'react-native-paper';
import Toast from 'react-native-toast-message';
import ReactNativeBlobUtil from 'react-native-blob-util';
import ScreenLayout, {
  createScreenHeaderTemplate,
  createHeaderTitleTemplate,
} from '../../../components/ScreenLayout';
import SwipeableHistoryItem from '../../../components/validade/SwipeableHistoryItem';
import {
  clearTreatedValidadeProducts,
  deleteValidadeProductRecord,
  listTreatedValidadeProducts,
} from '../services/validadeProductsService';
import { validadeTratativasTemplate } from '../../../assets/templates/validadeTratativasTemplate';
import { readStoredUserName } from '../../../services/userSessionStorageService';
import { tratarTheme } from '../../../theme/domains/validade';

const COLORS = tratarTheme;

const TREATMENT_TYPES = {
  sold: { label: 'Vendido', color: COLORS.sold, icon: 'shopping-cart' },
  exchanged: { label: 'Trocado', color: COLORS.exchanged, icon: 'swap-horiz' },
  returned: { label: 'Devolvido', color: COLORS.returned, icon: 'assignment-return' },
  expired: { label: 'Vencido', color: COLORS.expired, icon: 'error' },
};

const TratarScreen = ({ navigation, isDarkMode }) => {
  const [treatedItems, setTreatedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [stats, setStats] = useState({ total: 0, byType: {} });

  useEffect(() => {
    navigation.setOptions({
      ...createScreenHeaderTemplate({
        isDarkMode,
        lightHeaderColor: COLORS.primary,
        darkHeaderColor: COLORS.primary,
        tintColor: COLORS.white,
        titleSize: 18,
        titleWeight: '800',
      }),
      headerTitle: () =>
        createHeaderTitleTemplate({
          title: 'Historico de Tratativas',
          subtitle: 'Gestao de saidas e ocorrencias',
          iconName: 'assignment-turned-in',
          tintColor: COLORS.white,
        }),
      headerRight: () => (
        <View style={{ flexDirection: 'row', marginRight: 8 }}>
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <TouchableOpacity
                onPress={() => setMenuVisible(true)}
                style={styles.headerButton}
              >
                <MaterialIcons name="more-vert" size={24} color={COLORS.white} />
              </TouchableOpacity>
            }
          >
            <Menu.Item
              onPress={() => { setMenuVisible(false); exportToPDF(); }}
              title="Exportar Relatorio PDF"
              leadingIcon="file-pdf-box"
            />

            <Menu.Item
              onPress={() => { setMenuVisible(false); clearHistoryConfirm(); }}
              title="Limpar Historico"
              leadingIcon="delete-sweep"
              titleStyle={{ color: COLORS.expired }}
            />
          </Menu>
        </View>
      ),
    });
  }, [navigation, isDarkMode, menuVisible, treatedItems]);

  const loadTreatedItems = useCallback(async () => {
    setLoading(true);
    try {
      const treated = await listTreatedValidadeProducts();
      setTreatedItems(treated);
      calculateStats(treated);
    } catch (error) {
      console.error('Erro ao carregar itens:', error);
      Toast.show({ type: 'error', text1: 'Erro', text2: 'Falha ao carregar dados.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTreatedItems();

    const unsubscribe = navigation.addListener('focus', () => {
      loadTreatedItems();
    });
    return unsubscribe;
  }, [loadTreatedItems, navigation]);

  const calculateStats = (items) => {
    const byType = {};
    items.forEach((item) => {
      const type = item.treatmentType || 'unknown';
      byType[type] = (byType[type] || 0) + (item.quantidade || 0);
    });
    setStats({
      total: items.reduce((acc, curr) => acc + (curr.quantidade || 0), 0),
      byType,
    });
  };

  const filteredItems = useMemo(() => {
    return treatedItems.filter((item) => {
      const matchesFilter = selectedFilter === 'all' || item.treatmentType === selectedFilter;
      const matchesSearch = searchText === ''
        || item.descricao?.toLowerCase().includes(searchText.toLowerCase())
        || item.codprod?.toString().includes(searchText)
        || item.lote?.toLowerCase().includes(searchText);

      return matchesFilter && matchesSearch;
    });
  }, [treatedItems, selectedFilter, searchText]);

  const handleDeleteItem = (itemToDelete) => {
    Alert.alert(
      'Excluir Registro',
      'Deseja remover este registro do historico? Isso nao devolve o item ao estoque.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteValidadeProductRecord(itemToDelete.id);
              loadTreatedItems();
              Toast.show({ type: 'success', text1: 'Registro removido' });
            } catch (error) {
              Toast.show({ type: 'error', text1: 'Erro ao excluir' });
            }
          },
        },
      ],
    );
  };

  const clearHistoryConfirm = () => {
    if (treatedItems.length === 0) return;

    Alert.alert(
      'Limpar Todo Historico',
      'Tem certeza que deseja apagar TODOS os registros de tratativas? Esta acao nao pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar Tudo',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearTreatedValidadeProducts();
              loadTreatedItems();
              Toast.show({ type: 'success', text1: 'Historico limpo com sucesso' });
            } catch (error) {
              Toast.show({ type: 'error', text1: 'Erro ao limpar historico' });
            }
          },
        },
      ],
    );
  };

  const getLogoBase64 = async () => {
    try {
      const assetSource = Image.resolveAssetSource(require('../../../../assets/Image/LOGO.png'));
      const assetUri = assetSource?.uri;
      if (!assetUri) return null;

      if (assetUri.startsWith('http')) {
        const response = await fetch(assetUri);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }

      const path = assetUri.startsWith('file://') ? assetUri.replace('file://', '') : assetUri;
      const base64 = await ReactNativeBlobUtil.fs.readFile(path, 'base64');
      return `data:image/png;base64,${base64}`;
    } catch (e) {
      console.log('Erro ao carregar logo:', e);
      return null;
    }
  };

  const exportToPDF = async () => {
    if (filteredItems.length === 0) {
      return Toast.show({ type: 'info', text1: 'Sem dados', text2: 'Nao ha itens para exportar.' });
    }

    setLoading(true);
    try {
      const userName = await readStoredUserName('---');

      let logoBase64 = await getLogoBase64();
      if (!logoBase64) logoBase64 = '';

      const tableRows = filteredItems.map((item, idx) => {
        const typeInfo = TREATMENT_TYPES[item.treatmentType] || { label: 'Outro', color: '#000' };

        return `
          <tr>
            <td>${idx + 1}</td>
            <td style="text-align:left; padding-left:10px;"><b>${item.descricao}</b></td>
            <td>${item.codprod || '-'}</td>
            <td>${item.lote || '-'}</td>
            <td>${item.quantidade}</td>
            <td style="color:${typeInfo.color}; font-weight:bold;">${typeInfo.label.toUpperCase()}</td>
            <td>${new Date(item.treatmentDate).toLocaleDateString('pt-BR')} ${new Date(item.treatmentDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
          </tr>
        `;
      }).join('');

      const html = validadeTratativasTemplate
        .replace('{{LOGO_HTML}}', logoBase64 ? `<img src="${logoBase64}" class="logo" />` : '')
        .replace('{{DATA_EMISSAO}}', new Date().toLocaleDateString('pt-BR'))
        .replace('{{TOTAL_ITENS}}', filteredItems.length)
        .replace('{{USER_NAME}}', userName)
        .replace('{{FILTRO_APLICADO}}', selectedFilter === 'all' ? 'Todos' : TREATMENT_TYPES[selectedFilter]?.label || selectedFilter)
        .replace('{{PRODUTOS_HTML}}', tableRows)
        .replace('{{ANO_EMISSAO}}', String(new Date().getFullYear()));

      const { filePath } = await RNHTMLtoPDF.convert({
        html,
        fileName: `Tratativas_${Date.now()}`,
        directory: 'Documents',
      });

      const fileUrl = filePath.startsWith('file://') ? filePath : `file://${filePath}`;
      await Share.open({
        url: fileUrl,
        type: 'application/pdf',
        title: 'Exportar Relatorio',
      });
    } catch (error) {
      if (error.message !== 'User did not share') {
        Toast.show({ type: 'error', text1: 'Erro na exportacao', text2: error.message });
      }
    } finally {
      setLoading(false);
    }
  };

  const FilterChip = ({ type, label, icon }) => {
    const isSelected = selectedFilter === type;
    const typeInfo = type === 'all' ? { color: COLORS.primary } : TREATMENT_TYPES[type];

    return (
      <TouchableOpacity
        style={[
          styles.filterChip,
          isSelected && { backgroundColor: typeInfo.color || COLORS.primary },
          !isSelected && isDarkMode && styles.darkFilterChip,
        ]}
        onPress={() => setSelectedFilter(type)}
        activeOpacity={0.7}
      >
        <MaterialIcons
          name={icon}
          size={16}
          color={isSelected ? '#FFF' : (isDarkMode ? COLORS.textMuted : COLORS.textMuted)}
        />
        <Text
          style={[
            styles.filterChipText,
            isSelected && styles.filterChipTextSelected,
            !isSelected && isDarkMode && { color: COLORS.textMuted },
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const StatsCard = ({ label, value, color, icon }) => (
    <View style={[styles.statsCard, isDarkMode && styles.darkStatsCard, { borderBottomColor: color, borderBottomWidth: 3 }]}>
      <View style={[styles.statsIconConfig, { backgroundColor: `${color}20` }]}>
        <MaterialIcons name={icon} size={20} color={color} />
      </View>
      <View>
        <Text style={[styles.statsValue, isDarkMode && styles.darkText]}>{value}</Text>
        <Text style={[styles.statsLabel, isDarkMode && styles.darkTextMuted]}>{label}</Text>
      </View>
    </View>
  );

  const renderItem = ({ item }) => {
    const info = TREATMENT_TYPES[item.treatmentType] || { label: 'Outro', color: '#999', icon: 'help' };

    return (
      <SwipeableHistoryItem
        onDelete={() => handleDeleteItem(item)}
        isDarkMode={isDarkMode}
      >
        <View style={[styles.itemCard, isDarkMode && styles.darkItemCard]}>
          <View style={styles.itemHeader}>
            <View style={[styles.iconContainer, { backgroundColor: info.color }]}>
              <MaterialIcons name={info.icon} size={20} color="#FFF" />
            </View>
            <View style={styles.itemHeaderText}>
              <Text style={[styles.itemTitle, isDarkMode && styles.darkText]} numberOfLines={1}>
                {item.descricao}
              </Text>
              <Text style={styles.itemDate}>
                {new Date(item.treatmentDate).toLocaleDateString('pt-BR')} as {new Date(item.treatmentDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          </View>

          <View style={styles.itemDivider} />

          <View style={styles.itemBody}>
            <View style={styles.infoRow}>
              <MaterialIcons name="qr-code" size={14} color={COLORS.textMuted} />
              <Text style={[styles.infoText, isDarkMode && styles.darkTextMuted]}>
                Cod: {item.codprod || '-'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <MaterialIcons name="layers" size={14} color={COLORS.textMuted} />
              <Text style={[styles.infoText, isDarkMode && styles.darkTextMuted]}>
                Lote: {item.lote || '-'}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: `${info.color}15` }]}>
              <Text style={[styles.statusText, { color: info.color }]}>
                {info.label.toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={[styles.quantityBadge, { backgroundColor: info.color }]}>
            <Text style={styles.quantityText}>{item.quantidade}</Text>
          </View>
        </View>
      </SwipeableHistoryItem>
    );
  };

  return (
    <ScreenLayout
      isDarkMode={isDarkMode}
      lightBackground={COLORS.background}
      darkBackground={COLORS.backgroundDark}
    >
      <View style={styles.container}>
        <View style={[styles.searchContainer, isDarkMode && styles.darkSearchContainer]}>
          <MaterialIcons name="search" size={22} color={COLORS.textMuted} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, isDarkMode && styles.darkSearchInput]}
            placeholder="Buscar por nome, codigo ou lote..."
            placeholderTextColor={COLORS.textMuted}
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <MaterialIcons name="close" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsScroll}>
            <StatsCard label="Total Itens" value={stats.total} color={COLORS.primary} icon="poll" />
            <StatsCard label="Vendidos" value={stats.byType.sold || 0} color={COLORS.sold} icon="shopping-cart" />
            <StatsCard label="Vencidos" value={stats.byType.expired || 0} color={COLORS.expired} icon="error-outline" />
            <StatsCard label="Trocados" value={stats.byType.exchanged || 0} color={COLORS.exchanged} icon="swap-horiz" />
          </ScrollView>
        </View>

        <View style={styles.filtersWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
            <FilterChip type="all" label="Todos" icon="list" />
            {Object.keys(TREATMENT_TYPES).map((key) => (
              <FilterChip
                key={key}
                type={key}
                label={TREATMENT_TYPES[key].label}
                icon={TREATMENT_TYPES[key].icon}
              />
            ))}
          </ScrollView>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={filteredItems}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialIcons name="history" size={48} color={`${COLORS.textMuted}50`} />
                <Text style={[styles.emptyText, isDarkMode && styles.darkTextMuted]}>
                  Nenhum registro encontrado
                </Text>
              </View>
            }
          />
        )}
      </View>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    margin: 12,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  darkSearchContainer: {
    backgroundColor: COLORS.cardDark,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
  },
  darkSearchInput: {
    color: '#FFF',
  },
  statsScroll: {
    paddingHorizontal: 12,
    paddingBottom: 4,
    gap: 8,
  },
  statsCard: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 10,
    minWidth: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginRight: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    height: 54,
  },
  darkStatsCard: {
    backgroundColor: COLORS.cardDark,
  },
  statsIconConfig: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statsLabel: {
    fontSize: 10,
    color: '#888',
    textTransform: 'uppercase',
  },
  filtersWrapper: {
    height: 50,
    justifyContent: 'center',
  },
  filtersScroll: {
    paddingHorizontal: 12,
    gap: 8,
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  darkFilterChip: {
    backgroundColor: '#262d47',
    borderColor: '#333',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginLeft: 6,
  },
  filterChipTextSelected: {
    color: '#FFF',
  },
  listContent: {
    padding: 12,
    paddingTop: 4,
    paddingBottom: 24,
  },
  itemCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 12,
    padding: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  darkItemCard: {
    backgroundColor: COLORS.cardDark,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  itemHeader: {
    flexDirection: 'row',
    padding: 12,
    paddingBottom: 8,
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemHeaderText: {
    flex: 1,
    justifyContent: 'center',
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    marginBottom: 2,
  },
  itemDate: {
    fontSize: 11,
    color: '#999',
  },
  itemDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 12,
    marginVertical: 4,
  },
  itemBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    paddingTop: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 12,
  },
  infoText: {
    fontSize: 12,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 'auto',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  quantityBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    borderBottomLeftRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  quantityText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  headerButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  emptyState: {
    marginTop: 60,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.7,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: '#888',
    fontWeight: '500',
  },
  darkText: {
    color: '#FFF',
  },
  darkTextMuted: {
    color: '#AAA',
  },
});

export default TratarScreen;
