import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import ScreenLayout, {
  createHeaderTitleTemplate,
  createScreenHeaderTemplate,
} from '../../../components/ScreenLayout';
import { CORESCONFERENCIADIVERG } from '../../../components/coresAuth';
import { STORAGE_KEYS } from '../../../constants/storage';

const ConferenciaDivergenciasScreen = ({ navigation, isDarkMode }) => {
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState('pendente');

  const colors = useMemo(() => {
    const base = CORESCONFERENCIADIVERG;
    const dark = !!isDarkMode;

    const background = dark ? '#1f2438' : base.background || '#ecfeff';
    const surface = dark ? '#262d47' : '#ffffff';
    const surface2 = dark ? '#2b3350' : '#f7f7f8';
    const text = dark ? '#f3f5ff' : '#2f333a';
    const textMuted = dark ? '#aab1cf' : 'rgba(64, 68, 76, 0.78)';
    const border = dark ? '#3a4265' : 'rgba(64, 68, 76, 0.18)';
    const divider = dark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(64, 68, 76, 0.14)';
    const inputBg = dark ? '#202846' : '#ffffff';

    return {
      primary: base.primary,
      secondary: base.secondary,
      accentText: base.text,
      background,
      surface,
      surface2,
      text,
      textMuted,
      border,
      divider,
      inputBg,
      onPrimary: '#ffffff',
      shadow: '#000000',
      danger: '#dc2626',
      success: '#059669',
      warning: '#f59e0b',
      card: surface,
    };
  }, [isDarkMode]);
  const styles = getStyles(colors);

  useLayoutEffect(() => {
    navigation.setOptions({
      ...createScreenHeaderTemplate({
        isDarkMode,
        lightHeaderColor: colors.primary,
        darkHeaderColor: colors.primary,
        tintColor: '#ffffff',
      }),
      headerTitle: () =>
        createHeaderTitleTemplate({
          title: 'Divergências',
          subtitle: 'Somente visualização',
          iconName: 'rule',
          tintColor: '#ffffff',
        }),
    });
  }, [navigation, isDarkMode, colors.primary]);

  const loadDivergencias = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.CONFERENCIA_DIVERGENCIAS);
      const parsed = raw ? JSON.parse(raw) : [];
      setList(parsed);
    } catch {
      setList([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDivergencias();
    }, [loadDivergencias]),
  );

  const filtered = useMemo(() => {
    if (filter === 'todos') return list;
    return list.filter((item) => item.status === filter);
  }, [list, filter]);

  const stats = useMemo(() => {
    const pendente = list.filter((item) => item.status === 'pendente').length;
    const resolvida = list.filter((item) => item.status === 'resolvida').length;
    return { pendente, resolvida, total: list.length };
  }, [list]);

  const header = useMemo(() => {
    return (
      <>
        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Pendentes</Text>
            <Text style={[styles.metricValue, { color: colors.danger }]}>{stats.pendente}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Resolvidas</Text>
            <Text style={[styles.metricValue, { color: colors.success }]}>{stats.resolvida}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Total</Text>
            <Text style={styles.metricValue}>{stats.total}</Text>
          </View>
        </View>

        <View style={styles.filterRow}>
          {['pendente', 'resolvida', 'todos'].map((key) => (
            <Pressable
              key={key}
              onPress={() => setFilter(key)}
              style={[
                styles.filterButton,
                filter === key && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
            >
              <Text style={[styles.filterButtonText, filter === key && { color: colors.onPrimary }]}>
                {key === 'pendente' ? 'Pendentes' : key === 'resolvida' ? 'Resolvidas' : 'Todos'}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Lista de divergências</Text>
          </View>
        </View>
      </>
    );
  }, [styles, colors.danger, colors.success, colors.primary, colors.onPrimary, stats, filter]);

  return (
    <ScreenLayout
      isDarkMode={isDarkMode}
      lightBackground={colors.background}
      darkBackground={colors.background}
      contentStyle={styles.content}
    >
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <View style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemTitle}>
                {item.source === 'recebimento' ? 'Recebimento' : 'Saída'} - {item.code}
              </Text>
              <Text style={[styles.statusTag, item.status === 'resolvida' ? styles.statusResolved : styles.statusPending]}>
                {item.status}
              </Text>
            </View>
            <Text style={styles.itemDetail}>{item.description}</Text>
            <Text style={styles.itemDetail}>
              Esperado: {item.expectedQty} | Conferido: {item.checkedQty} | Diferença: {item.diff > 0 ? `+${item.diff}` : item.diff}
            </Text>
            <Text style={styles.itemDetail}>
              {item.source === 'recebimento' ? `Nota: ${item.invoice || '-'}` : `Pedido: ${item.orderCode || '-'}`}
            </Text>
            {item.status === 'resolvida' ? (
              <Text style={styles.resolutionText}>
                Resolvida em {item.resolvedAt ? new Date(item.resolvedAt).toLocaleString('pt-BR') : '-'}
                {item.resolutionNote ? ` | Obs: ${item.resolutionNote}` : ''}
              </Text>
            ) : null}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.card}>
            <Text style={styles.emptyText}>Nenhuma divergência para este filtro.</Text>
          </View>
        }
      />
    </ScreenLayout>
  );
};

const getStyles = (colors) =>
  StyleSheet.create({
    content: {
      flex: 1,
      paddingHorizontal: 18,
      paddingTop: 14,
    },
    scrollContent: {
      paddingBottom: 28,
    },
    metricsRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 10,
    },
    metricCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 10,
    },
    metricLabel: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '700',
    },
    metricValue: {
      marginTop: 6,
      fontSize: 20,
      color: colors.text,
      fontWeight: '900',
    },
    filterRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 10,
    },
    filterButton: {
      flex: 1,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
    },
    filterButtonText: {
      color: colors.text,
      fontWeight: '700',
      fontSize: 12,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 12,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.text,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
    },
    itemCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 10,
      marginBottom: 10,
      backgroundColor: colors.surface,
    },
    itemHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    itemTitle: {
      color: colors.text,
      fontWeight: '800',
      fontSize: 13,
    },
    statusTag: {
      textTransform: 'uppercase',
      fontSize: 10,
      fontWeight: '900',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      overflow: 'hidden',
      color: '#ffffff',
    },
    statusPending: {
      backgroundColor: colors.danger,
    },
    statusResolved: {
      backgroundColor: colors.success,
    },
    itemDetail: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 2,
    },
    resolutionText: {
      marginTop: 8,
      color: colors.success,
      fontSize: 12,
      fontWeight: '700',
    },
  });

export default ConferenciaDivergenciasScreen;
