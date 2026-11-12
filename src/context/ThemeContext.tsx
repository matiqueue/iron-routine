import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { LIGHT_THEME, DARK_THEME, ThemeColors, ThemeContextType } from '../constants/theme';

const THEME_STORAGE_KEY = '@iron_routine_theme_dark_mode';

export const ThemeContext = createContext<ThemeContextType>({
  theme: LIGHT_THEME,
  isDark: false,
  toggleTheme: () => {},
  setThemeMode: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Default to light mode (false) as requested by user
  const [isDark, setIsDark] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (stored !== null) {
          setIsDark(stored === 'true');
        }
      } catch (e) {
        console.warn('Failed to load theme preference', e);
      }
    })();
  }, []);

  const toggleTheme = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const next = !isDark;
      setIsDark(next);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, String(next));
    } catch (e) {
      console.warn('Failed to save theme preference', e);
    }
  };

  const setThemeMode = async (dark: boolean) => {
    try {
      setIsDark(dark);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, String(dark));
    } catch (e) {
      console.warn('Failed to save theme preference', e);
    }
  };

  const theme: ThemeColors = isDark ? DARK_THEME : LIGHT_THEME;

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useAppTheme = () => useContext(ThemeContext);
