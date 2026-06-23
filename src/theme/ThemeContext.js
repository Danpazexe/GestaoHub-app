import React, { createContext, useContext, useMemo } from 'react';
import { semanticColors } from './colors';
import { spacing } from './spacing';
import { typography } from './typography';
import { elevation } from './elevation';

// Resolve os tokens (que são "crus") para um tema já pronto para a tela atual,
// eliminando os ternários `isDarkMode ? a : b` espalhados por todo o app.
export const buildTheme = (isDarkMode = false) => ({
  isDarkMode,
  colors: {
    primary: semanticColors.primary,
    success: semanticColors.success,
    warning: semanticColors.warning,
    error: semanticColors.error,
    info: semanticColors.info,
    white: semanticColors.white,
    black: semanticColors.black,
    background: isDarkMode ? semanticColors.backgroundDark : semanticColors.background,
    surface: isDarkMode ? semanticColors.surfaceDark : semanticColors.surface,
    card: isDarkMode ? semanticColors.surfaceDark : semanticColors.surface,
    text: isDarkMode ? semanticColors.textDark : semanticColors.text,
    textMuted: isDarkMode ? semanticColors.textMutedDark : semanticColors.textMuted,
    border: isDarkMode ? semanticColors.borderDark : semanticColors.border,
  },
  spacing,
  typography,
  elevation,
});

// Default = tema claro. useTheme() nunca lança, então um componente
// compartilhado renderizado fora do provider continua funcionando (adoção incremental).
const ThemeContext = createContext({
  ...buildTheme(false),
  setDarkMode: () => {},
  toggleTheme: () => {},
});

export const ThemeProvider = ({ isDarkMode = false, setDarkMode, children }) => {
  const value = useMemo(
    () => ({
      ...buildTheme(isDarkMode),
      setDarkMode: setDarkMode || (() => {}),
      toggleTheme: () => setDarkMode?.((prev) => !prev),
    }),
    [isDarkMode, setDarkMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);

export default ThemeContext;
