import React, { useLayoutEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ToastAndroid, Alert, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { CORESHOME, CORESMODULEFUNCTIONS } from '../../../components/coresAuth';
import ScreenLayout, {
  createScreenHeaderTemplate,
  createHeaderTitleTemplate,
} from '../../../components/ScreenLayout';

const HOME_COLORS = CORESHOME;
const MODULE_COLORS = CORESMODULEFUNCTIONS;

const hexToRgb = (hex) => {
  const normalized = hex.replace('#', '');
  const full = normalized.length === 3
    ? normalized.split('').map((value) => value + value).join('')
    : normalized;

  const num = parseInt(full, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
};

const withAlpha = (hex, alpha = 1) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const isDarkColor = (hex) => {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.6;
};

const ModuleFunctionsScreen = ({ isDarkMode }) => {
  const navigation = useNavigation();
  const route = useRoute();
  const module = route.params?.module;
  const moduleColor = module?.color || HOME_COLORS.destaqueAzul;
  const onModuleColor = isDarkColor(moduleColor) ? '#ffffff' : '#1f2937';
  const palette = {
    background: isDarkMode ? MODULE_COLORS.backgroundDark : MODULE_COLORS.background,
    card: isDarkMode ? (MODULE_COLORS.cardDark || '#262d47') : (MODULE_COLORS.card || '#ffffff'),
    text: isDarkMode ? MODULE_COLORS.textDark : MODULE_COLORS.text,
    textMuted: isDarkMode ? MODULE_COLORS.textMutedDark : MODULE_COLORS.textMuted,
    emptySubtitle: isDarkMode ? MODULE_COLORS.emptySubtitleDark : MODULE_COLORS.textMuted,
    headerDark: MODULE_COLORS.primary,
  };
  const styles = getStyles(palette);

  const actions = module?.actions || [];

  useLayoutEffect(() => {
    navigation.setOptions({
      ...createScreenHeaderTemplate({
        isDarkMode,
        lightHeaderColor: moduleColor,
        darkHeaderColor: moduleColor,
        tintColor: onModuleColor,
        titleAlign: 'left',
        titleSize: 18,
        titleWeight: '800',
      }),
      headerTitle: () =>
        createHeaderTitleTemplate({
          title: module?.title || 'Funcionalidades',
          subtitle: 'Selecione uma ação',
          iconName: module?.icon || 'apps',
          tintColor: onModuleColor,
          subtitleColor: withAlpha(onModuleColor, 0.86),
        }),
    });
  }, [navigation, isDarkMode, module, moduleColor, onModuleColor]);

  const handleActionPress = (action) => {
    if (action.screen) {
      navigation.navigate(action.screen, action.routeParams || {});
      return;
    }

    if (Platform.OS === 'android') {
      ToastAndroid.show('Funcionalidade em breve', ToastAndroid.SHORT);
      return;
    }

    Alert.alert('Em breve', 'Funcionalidade em desenvolvimento.');
  };

  if (!module) {
    return (
      <ScreenLayout
        isDarkMode={isDarkMode}
        lightBackground={MODULE_COLORS.background}
        darkBackground={MODULE_COLORS.backgroundDark}
        contentStyle={styles.content}
      >
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Módulo não encontrado</Text>
          <Text style={styles.emptySubtitle}>Volte e selecione um módulo na Home.</Text>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout
      isDarkMode={isDarkMode}
      lightBackground={MODULE_COLORS.background}
      darkBackground={MODULE_COLORS.backgroundDark}
      contentStyle={styles.content}
    >
      <View style={styles.listWrapper}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        >
          {actions.map((action) => {
            const actionColor = action.color || moduleColor;
            const onActionColor = isDarkColor(actionColor) ? '#ffffff' : '#1f2937';
            const tintedBackground = withAlpha(actionColor, isDarkMode ? 0.18 : 0.09);
            const borderColor = withAlpha(actionColor, isDarkMode ? 0.46 : 0.24);
            const iconBg = withAlpha(actionColor, isDarkMode ? 0.94 : 0.88);
            const chevronBg = withAlpha(actionColor, isDarkMode ? 0.25 : 0.14);
            const chevronColor = isDarkMode ? '#e7ecff' : actionColor;

            return (
              <Pressable
                key={action.id}
                onPress={() => handleActionPress(action)}
                accessibilityRole="button"
                accessibilityLabel={action.title}
                style={({ pressed }) => [styles.actionCardWrapper, pressed && styles.pressedCard]}
              >
                <View style={[styles.actionCard, { borderColor }]}>
                  <View style={[styles.actionTint, { backgroundColor: tintedBackground }]} />
                  <View style={[styles.actionAccent, { backgroundColor: actionColor }]} />
                  <View style={[styles.actionIconCircle, { backgroundColor: iconBg }]}>
                    <MaterialIcons name={action.icon || 'chevron-right'} size={22} color={onActionColor} />
                  </View>
                  <Text style={styles.actionTitle} numberOfLines={2}>{action.title}</Text>
                  <View style={[styles.chevronBadge, { backgroundColor: chevronBg }]}>
                    <MaterialIcons name="chevron-right" size={22} color={chevronColor} />
                  </View>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </ScreenLayout>
  );
};

const getStyles = (palette) => {
  const actionCardShadow = Platform.select({
    ios: {
      shadowColor: withAlpha(palette.text, 0.45),
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.54,
      shadowRadius: 2,
    },
    android: {
      elevation: 2,
    },
    default: {},
  });

  return StyleSheet.create({
    content: {
      flex: 1,
      paddingHorizontal: 22,
      paddingTop: 14,
    },
    listWrapper: {
      flex: 1,
      position: 'relative',
    },
    listContent: {
      paddingTop: 6,
      paddingBottom: 24,
    },
    actionCardWrapper: {
      marginBottom: 12,
      borderRadius: 16,
      ...actionCardShadow,
    },
    actionCard: {
      position: 'relative',
      overflow: 'hidden',
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 13,
      paddingHorizontal: 14,
      borderRadius: 16,
      minHeight: 72,
      borderWidth: 1,
      backgroundColor: palette.card,
    },
    actionTint: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    actionAccent: {
      width: 4,
      alignSelf: 'stretch',
      borderRadius: 4,
      marginRight: 12,
    },
    actionIconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    actionTitle: {
      flex: 1,
      fontSize: 15,
      fontWeight: '800',
      color: palette.text,
    },
    chevronBadge: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    pressedCard: {
      transform: [{ scale: 0.99 }],
      opacity: 0.9,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: palette.text,
    },
    emptySubtitle: {
      marginTop: 8,
      fontSize: 14,
      color: palette.emptySubtitle,
      textAlign: 'center',
    },
  });
};

export default ModuleFunctionsScreen;
