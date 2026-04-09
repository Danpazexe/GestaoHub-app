import React, { useEffect } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { CORESSETTINGS } from '../../../components/coresAuth';
import ScreenLayout, {
  createScreenHeaderTemplate,
  createHeaderTitleTemplate,
} from '../../../components/ScreenLayout';
import useLogisticsLocationConfig from '../hooks/useLogisticsLocationConfig';
import { LOGISTICS_LOCATION_FIELDS } from '../../validade/constants/logisticsLocation';

const COLORS = CORESSETTINGS;

const EnderecosScreen = ({ isDarkMode, navigation }) => {
  const {
    config: logisticsLocationConfig,
    isLoaded: isLogisticsLocationConfigLoaded,
    toggleFieldEnabled,
    toggleFieldRequired,
  } = useLogisticsLocationConfig();

  useEffect(() => {
    navigation.setOptions({
      ...createScreenHeaderTemplate({
        isDarkMode,
        lightHeaderColor: COLORS.primary,
        darkHeaderColor: COLORS.primary,
        tintColor: '#FFFFFF',
        titleSize: 18,
        titleWeight: '700',
        titleLetterSpacing: 0.4,
        headerStyleOverride: {
          shadowOpacity: 0.08,
        },
      }),
      headerTitle: () =>
        createHeaderTitleTemplate({
          title: 'Endereços',
          iconName: 'map-marker-path',
          IconComponent: MaterialCommunityIcons,
          tintColor: '#FFFFFF',
        }),
    });
  }, [navigation, isDarkMode]);

  const LogisticsFieldItem = ({ field, isLast = false }) => {
    const fieldConfig = logisticsLocationConfig?.[field.key] || { enabled: false, required: false };

    return (
      <View
        style={[
          styles.logisticsItem,
          !isLast && styles.rowDivider,
          !isLast && (isDarkMode ? styles.darkRowDivider : styles.lightRowDivider),
        ]}
      >
        <View style={styles.logisticsHeader}>
          <Text style={[styles.rowTitle, isDarkMode ? styles.darkText : styles.lightText]}>
            {field.label}
          </Text>
          <Text style={[styles.rowSubtitle, isDarkMode ? styles.darkMutedText : styles.lightMutedText]}>
            {field.placeholder}
          </Text>
        </View>

        <View style={styles.logisticsControlsRow}>
          <View style={[styles.logisticsControl, isDarkMode ? styles.darkLogisticsControl : styles.lightLogisticsControl]}>
            <Text style={[styles.logisticsControlLabel, isDarkMode ? styles.darkMutedText : styles.lightMutedText]}>
              Exibir
            </Text>
            <Switch
              value={fieldConfig.enabled}
              onValueChange={(value) => toggleFieldEnabled(field.key, value)}
              trackColor={{
                false: isDarkMode ? '#4B5563' : '#D1D5DB',
                true: isDarkMode ? '#10B981' : '#059669',
              }}
              thumbColor={fieldConfig.enabled ? '#FFFFFF' : isDarkMode ? '#1F2937' : '#9CA3AF'}
              ios_backgroundColor={isDarkMode ? '#4B5563' : '#D1D5DB'}
            />
          </View>

          <View style={[styles.logisticsControl, isDarkMode ? styles.darkLogisticsControl : styles.lightLogisticsControl]}>
            <Text
              style={[
                styles.logisticsControlLabel,
                isDarkMode ? styles.darkMutedText : styles.lightMutedText,
                !fieldConfig.enabled && styles.disabledControlText,
              ]}
            >
              Obrigatório
            </Text>
            <Switch
              disabled={!fieldConfig.enabled}
              value={fieldConfig.required}
              onValueChange={(value) => toggleFieldRequired(field.key, value)}
              trackColor={{
                false: isDarkMode ? '#4B5563' : '#D1D5DB',
                true: isDarkMode ? '#10B981' : '#059669',
              }}
              thumbColor={fieldConfig.required ? '#FFFFFF' : isDarkMode ? '#1F2937' : '#9CA3AF'}
              ios_backgroundColor={isDarkMode ? '#4B5563' : '#D1D5DB'}
            />
          </View>
        </View>
      </View>
    );
  };

  return (
    <ScreenLayout
      isDarkMode={isDarkMode}
      lightBackground="#F4F6FB"
      darkBackground="#111827"
      contentStyle={[styles.container, isDarkMode ? styles.darkBackground : styles.lightBackground]}
    >
      <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroCard, isDarkMode ? styles.darkSectionCard : styles.lightSectionCard]}>
          <View style={[styles.heroIconWrap, isDarkMode ? styles.darkIconBadge : styles.lightIconBadge]}>
            <MaterialCommunityIcons
              name="warehouse"
              size={26}
              color={isDarkMode ? COLORS.textDark : COLORS.primary}
            />
          </View>
          <Text style={[styles.heroTitle, isDarkMode ? styles.darkText : styles.lightText]}>
            Configuração de Localização Logística
          </Text>
          <Text style={[styles.heroDescription, isDarkMode ? styles.darkMutedText : styles.lightMutedText]}>
            Defina quais campos de endereço aparecem no cadastro e quais passam a ser obrigatórios no fluxo de produtos.
          </Text>
        </View>

        <View style={[styles.sectionCard, isDarkMode ? styles.darkSectionCard : styles.lightSectionCard]}>
          {!isLogisticsLocationConfigLoaded ? (
            <View style={styles.logisticsLoadingRow}>
              <ActivityIndicator size="small" color={isDarkMode ? COLORS.textDark : COLORS.primary} />
              <Text style={[styles.logisticsLoadingText, isDarkMode ? styles.darkMutedText : styles.lightMutedText]}>
                Carregando configuração logística...
              </Text>
            </View>
          ) : (
            LOGISTICS_LOCATION_FIELDS.map((field, index) => (
              <LogisticsFieldItem
                key={field.key}
                field={field}
                isLast={index === LOGISTICS_LOCATION_FIELDS.length - 1}
              />
            ))
          )}
        </View>
      </ScrollView>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  lightBackground: {
    backgroundColor: '#F4F6FB',
  },
  darkBackground: {
    backgroundColor: '#111827',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 28,
  },
  sectionCard: {
    borderRadius: 18,
    paddingHorizontal: 14,
    marginBottom: 18,
    borderWidth: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  heroCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  lightSectionCard: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(46,53,84,0.08)',
  },
  darkSectionCard: {
    backgroundColor: COLORS.cardDark,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  rowDivider: {
    borderBottomWidth: 1,
  },
  lightRowDivider: {
    borderBottomColor: 'rgba(46,53,84,0.08)',
  },
  darkRowDivider: {
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  lightIconBadge: {
    backgroundColor: 'rgba(60,68,108,0.08)',
  },
  darkIconBadge: {
    backgroundColor: 'rgba(159,167,199,0.18)',
  },
  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  heroDescription: {
    fontSize: 13.5,
    lineHeight: 20,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  rowSubtitle: {
    fontSize: 12.5,
    marginTop: 3,
  },
  logisticsLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
  },
  logisticsLoadingText: {
    marginLeft: 10,
    fontSize: 13,
    fontWeight: '600',
  },
  logisticsItem: {
    paddingVertical: 16,
  },
  logisticsHeader: {
    marginBottom: 12,
  },
  logisticsControlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  logisticsControl: {
    flex: 1,
    minHeight: 62,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lightLogisticsControl: {
    backgroundColor: '#F8FAFC',
    borderColor: 'rgba(148,163,184,0.22)',
  },
  darkLogisticsControl: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderColor: 'rgba(148,163,184,0.18)',
  },
  logisticsControlLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  disabledControlText: {
    opacity: 0.5,
  },
  lightText: {
    color: '#2E3554',
  },
  darkText: {
    color: '#F3F5FF',
  },
  lightMutedText: {
    color: 'rgba(46,53,84,0.72)',
  },
  darkMutedText: {
    color: '#AAB1CF',
  },
});

export default EnderecosScreen;
