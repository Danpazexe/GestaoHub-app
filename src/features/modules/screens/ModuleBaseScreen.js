import React, { useLayoutEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import ScreenLayout, { createScreenHeaderTemplate, createHeaderTitleTemplate } from '../../../shared/components/ScreenLayout';
import { CORESHOME } from '../../../../assets/cores/coresAuth';

const COLORS = CORESHOME;

const ModuleBaseScreen = ({ isDarkMode }) => {
  const navigation = useNavigation();
  const route = useRoute();

  const title = route.params?.title || 'Funcionalidade';
  const subtitle = route.params?.subtitle || 'Tela base em implementação';
  const icon = route.params?.icon || 'widgets';
  const color = route.params?.color || COLORS.destaqueAzul;
  const bullets = Array.isArray(route.params?.bullets) ? route.params.bullets : [];

  useLayoutEffect(() => {
    navigation.setOptions({
      ...createScreenHeaderTemplate({
        isDarkMode,
        lightHeaderColor: color,
        darkHeaderColor: COLORS.destaqueCinza,
        tintColor: '#ffffff',
        titleSize: 18,
        titleWeight: '800',
        isMultilineTitle: true,
      }),
      headerTitle: () =>
        createHeaderTitleTemplate({
          title,
          subtitle: 'Base do módulo',
          iconName: icon,
          tintColor: '#ffffff',
        }),
    });
  }, [navigation, isDarkMode, title, icon, color]);

  return (
    <ScreenLayout
      isDarkMode={isDarkMode}
      lightBackground={COLORS.fundo}
      darkBackground={COLORS.destaqueCinza}
      contentStyle={styles.content}
    >
      <View style={[styles.heroCard, { borderLeftColor: color }]}> 
        <Text style={styles.heroTitle}>{title}</Text>
        <Text style={styles.heroSubtitle}>{subtitle}</Text>
      </View>

      <Text style={styles.sectionTitle}>Próximas entregas</Text>
      {bullets.map((item) => (
        <View key={item} style={styles.bulletCard}>
          <MaterialIcons name="check-circle-outline" size={20} color={color} />
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 16,
  },
  heroCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderLeftWidth: 5,
    borderWidth: 1,
    borderColor: 'rgba(64, 68, 76, 0.16)',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#2f333a',
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2f333a',
    marginBottom: 10,
  },
  bulletCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(64, 68, 76, 0.14)',
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bulletText: {
    flex: 1,
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ModuleBaseScreen;
