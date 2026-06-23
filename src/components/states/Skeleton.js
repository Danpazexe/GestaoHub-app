import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

// Placeholder pulsante para o carregamento (em vez de só um spinner central):
// o usuário já vê a "forma" do conteúdo que está chegando.
export const SkeletonBlock = ({ width = '100%', height = 16, radius = 8, style }) => {
  const { isDarkMode } = useTheme();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, opacity, backgroundColor: isDarkMode ? '#3a4265' : '#e5e7eb' },
        style,
      ]}
    />
  );
};

export const SkeletonList = ({ count = 6, rowHeight = 56 }) => (
  <View style={styles.list}>
    {Array.from({ length: count }).map((_, index) => (
      <SkeletonBlock key={index} height={rowHeight} radius={12} style={styles.row} />
    ))}
  </View>
);

const styles = StyleSheet.create({
  list: { padding: 16 },
  row: { marginBottom: 12 },
});

export default SkeletonBlock;
