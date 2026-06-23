import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { colors as themeColors } from '../theme/colors';
import { elevation } from '../theme/elevation';
import { typography } from '../theme/typography';

// Expande a área de toque dos botões de ícone do header sem mudar o visual.
const HEADER_HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

const ScreenLayout = ({
  children,
  isDarkMode = false,
  lightBackground = themeColors.background,
  darkBackground = themeColors.backgroundDark,
  edges = ['left', 'right', 'bottom'],
  safeAreaStyle,
  contentStyle,
}) => {
  const backgroundColor = isDarkMode ? darkBackground : lightBackground;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }, safeAreaStyle]} edges={edges}>
      <View style={[styles.content, { backgroundColor }, contentStyle]}>{children}</View>
    </SafeAreaView>
  );
};

export const createScreenHeaderTemplate = ({
  isDarkMode = false,
  lightHeaderColor = themeColors.primary,
  darkHeaderColor = themeColors.backgroundDark,
  tintColor = themeColors.white,
  titleAlign = 'left',
  titleSize = 18,
  titleWeight = '700',
  titleLetterSpacing = 0.4,
  headerStyleOverride = {},
  headerTitleStyleOverride = {},
} = {}) => ({
  headerShown: true,
  headerStyle: {
    backgroundColor: isDarkMode ? darkHeaderColor : lightHeaderColor,
    elevation: 0,
    ...elevation.sm,
    ...headerStyleOverride,
  },
  headerTintColor: tintColor,
  headerTitleAlign: titleAlign,
  headerTitleStyle: {
    fontSize: titleSize,
    fontWeight: titleWeight,
    letterSpacing: titleLetterSpacing,
    ...headerTitleStyleOverride,
  },
});

export const createHeaderTitleTemplate = ({
  title,
  subtitle,
  iconName,
  IconComponent = MaterialIcons,
  tintColor = themeColors.white,
  subtitleColor = 'rgba(255,255,255,0.92)',
  iconSize = 18,
}) => (
  <View style={headerStyles.titleContainer}>
    {iconName ? (
      <View style={headerStyles.titleIcon}>
        <IconComponent name={iconName} size={iconSize} color={tintColor} />
      </View>
    ) : null}
    <View style={headerStyles.titleTextColumn}>
      <Text numberOfLines={1} accessibilityRole="header" style={[headerStyles.titleText, typography.title, { color: tintColor }]}>{title}</Text>
      {subtitle ? (
        <Text numberOfLines={1} style={[headerStyles.subtitleText, typography.subtitle, { color: subtitleColor }]}>{subtitle}</Text>
      ) : null}
    </View>
  </View>
);

export const createHeaderActionsTemplate = ({
  actions = [],
  isDarkMode = false,
  rightSpacing = 8,
}) => (
  <View style={{ flexDirection: 'row', marginRight: rightSpacing }}>
    {actions.map((action) => {
      const IconComponent = action.IconComponent || MaterialIcons;
      const backgroundColor = action.isActive
        ? (action.activeBackgroundColor || '#f4cc84')
        : (action.baseBackgroundColor || (isDarkMode ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.22)'));

      return (
        <TouchableOpacity
          key={action.key}
          style={[headerStyles.actionButton, { backgroundColor }]}
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.accessibilityLabel || action.label || action.iconName}
          accessibilityState={{ selected: !!action.isActive }}
          hitSlop={HEADER_HIT_SLOP}
        >
          <IconComponent
            name={action.iconName}
            size={action.iconSize || 24}
            color={action.iconColor || '#ffffff'}
          />
        </TouchableOpacity>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});

const headerStyles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    flexShrink: 1,
  },
  titleTextColumn: {
    flexShrink: 1,
  },
  titleIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginBottom: 4,
  },
  titleText: {
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
  },
  subtitleText: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: typography.subtitle.fontWeight,
    lineHeight: typography.subtitle.lineHeight,
    paddingBottom: 4,
  },
  actionButton: {
    // Tamanho visual compacto para não invadir o título; o alvo de toque de 44px
    // vem do hitSlop (estende a área tocável sem ocupar espaço de layout).
    padding: 6,
    borderRadius: 8,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    ...elevation.none,
  },
});

export default ScreenLayout;
