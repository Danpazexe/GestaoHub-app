import React from 'react';
import { Pressable, View, Text, StyleSheet, Platform } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

// Card de navegação padrão do app (Home, submenus de módulo e telas de menu):
// fundo suavemente tingido pela cor + barra de acento à esquerda + ícone em
// círculo sólido + título (e subtítulo opcional) + chevron num badge colorido.
// As variações de cor são derivadas de uma única `color` por card.

const hexToRgb = (hex) => {
  const normalized = String(hex || '#334155').replace('#', '');
  const full = normalized.length === 3
    ? normalized.split('').map((value) => value + value).join('')
    : normalized;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
};

const withAlpha = (hex, alpha = 1) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const isDarkColor = (hex) => {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.6;
};

const NavCard = ({
  title,
  subtitle,
  icon = 'chevron-right',
  color = '#334155',
  isDarkMode = false,
  onPress,
  style,
  accessibilityLabel,
}) => {
  const onColor = isDarkColor(color) ? '#ffffff' : '#1f2937';
  const tint = withAlpha(color, isDarkMode ? 0.18 : 0.09);
  const border = withAlpha(color, isDarkMode ? 0.46 : 0.24);
  const iconBg = withAlpha(color, isDarkMode ? 0.94 : 0.88);
  const chevronBg = withAlpha(color, isDarkMode ? 0.25 : 0.14);
  const chevronColor = isDarkMode ? '#e7ecff' : color;
  const cardBg = isDarkMode ? '#262d47' : '#ffffff';
  const titleColor = isDarkMode ? '#f3f5ff' : '#1f2937';
  const subtitleColor = isDarkMode ? '#aab1cf' : '#667085';
  // Sombra idêntica à da Home (HomeScreen menuCardShadow).
  const shadowStyle = Platform.select({
    ios: {
      shadowColor: withAlpha('#2f333a', isDarkMode ? 0.5 : 0.25),
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.54,
      shadowRadius: 2,
    },
    android: { elevation: 2 },
    default: {},
  });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      style={({ pressed }) => [styles.wrapper, shadowStyle, style, pressed && styles.pressed]}
    >
      <View style={[styles.card, { borderColor: border, backgroundColor: cardBg }]}>
        <View style={[styles.tint, { backgroundColor: tint }]} />
        <View style={[styles.accent, { backgroundColor: color }]} />
        <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
          <MaterialIcons name={icon} size={22} color={onColor} />
        </View>
        <View style={styles.textWrap}>
          <Text style={[styles.title, { color: titleColor }]} numberOfLines={subtitle ? 1 : 2}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: subtitleColor }]} numberOfLines={1}>{subtitle}</Text>
          ) : null}
        </View>
        <View style={[styles.chevronBadge, { backgroundColor: chevronBg }]}>
          <MaterialIcons name="chevron-right" size={22} color={chevronColor} />
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
    borderRadius: 16,
  },
  pressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.92,
  },
  card: {
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 16,
    minHeight: 72,
    borderWidth: 1,
  },
  tint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  accent: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 4,
    marginRight: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  chevronBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default NavCard;
