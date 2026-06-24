import React, { useLayoutEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import ScreenLayout, { createScreenHeaderTemplate, createHeaderTitleTemplate } from '../../../components/ScreenLayout';
import { CORESHOME } from '../../../components/coresAuth';

const COLORS = CORESHOME;

const ModuleBaseScreen = ({ isDarkMode }) => {
  const navigation = useNavigation();
  const route = useRoute();

  const title = route.params?.title || 'Funcionalidade';
  const subtitle = route.params?.subtitle || 'Tela base em implementação';
  const icon = route.params?.icon || 'widgets';
  const color = route.params?.color || COLORS.destaqueAzul;
  const bullets = Array.isArray(route.params?.bullets) ? route.params.bullets : [];

  const palette = {
    card: isDarkMode ? '#262d47' : '#ffffff',
    cardBorder: isDarkMode ? '#3a4265' : 'rgba(64, 68, 76, 0.16)',
    bulletBorder: isDarkMode ? '#3a4265' : 'rgba(64, 68, 76, 0.14)',
    title: isDarkMode ? '#f3f5ff' : '#2f333a',
    subtitle: isDarkMode ? '#aab1cf' : '#4b5563',
    bulletText: isDarkMode ? '#aab1cf' : '#374151',
  };

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
      darkBackground={COLORS.fundoDark}
      contentStyle={styles.content}
    >
      <View
        style={[
          styles.heroCard,
          { backgroundColor: palette.card, borderColor: palette.cardBorder, borderLeftColor: color },
        ]}
      >
        <Text style={[styles.heroTitle, { color: palette.title }]}>{title}</Text>
        <Text style={[styles.heroSubtitle, { color: palette.subtitle }]}>{subtitle}</Text>
      </View>

      <Text style={[styles.sectionTitle, { color: palette.title }]}>Próximas entregas</Text>
      {bullets.map((item) => (
        <View
          key={item}
          style={[styles.bulletCard, { backgroundColor: palette.card, borderColor: palette.bulletBorder }]}
        >
          <MaterialIcons name="check-circle-outline" size={20} color={color} />
          <Text style={[styles.bulletText, { color: palette.bulletText }]}>{item}</Text>
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
    borderRadius: 14,
    padding: 16,
    borderLeftWidth: 5,
    borderWidth: 1,
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
  },
  bulletCard: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ModuleBaseScreen;
