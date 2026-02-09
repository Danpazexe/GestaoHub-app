import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const ScreenLayout = ({
  children,
  isDarkMode = false,
  lightBackground = '#ffffff',
  darkBackground = '#111827',
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
  lightHeaderColor = '#40444c',
  darkHeaderColor = '#1f2937',
  tintColor = '#ffffff',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
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
  tintColor = '#ffffff',
  subtitleColor = 'rgba(255,255,255,0.92)',
  iconSize = 18,
}) => (
  <View style={headerStyles.titleContainer}>
    {iconName ? (
      <View style={headerStyles.titleIcon}>
        <IconComponent name={iconName} size={iconSize} color={tintColor} />
      </View>
    ) : null}
    <View>
      <Text style={[headerStyles.titleText, { color: tintColor }]}>{title}</Text>
      {subtitle ? (
        <Text style={[headerStyles.subtitleText, { color: subtitleColor }]}>{subtitle}</Text>
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
  },
  titleIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginBottom:4,
  },
  titleText: {
    fontSize: 18,
    fontWeight: '800',
  },
  subtitleText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 16,
    paddingBottom: 4,
  },
  actionButton: {
    padding: 6,
    borderRadius: 8,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom:4,
  },
});

export default ScreenLayout;
