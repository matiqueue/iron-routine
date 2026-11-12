import { createContext, useContext } from 'react';

export interface ThemeColors {
  isDark: boolean;
  bg: string;
  bgSecondary: string;
  bgTertiary: string;
  card: string;
  cardSubtle: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderDark: string;
  primary: string;
  primaryText: string;
  primaryGlow: string;
  accent: string;
  accentGlow: string;
  accentBlue: string;
  accentOrange: string;
  accentOrangeGlow: string;
  accentPurple: string;
  success: string;
  danger: string;
  hairline: string;
  inputBg: string;
  // Backward-compatibility aliases
  bgCard: string;
  bgCardElevated: string;
  bgInput: string;
  borderLight: string;
}

export const LIGHT_THEME: ThemeColors = {
  isDark: false,
  bg: '#FFFFFF',
  bgSecondary: '#F5F5F7',
  bgTertiary: '#E5E5EA',
  card: '#FFFFFF',
  cardSubtle: '#F9F9FB',
  text: '#000000',
  textSecondary: '#555555',
  textMuted: '#8E8E93',
  border: '#E5E5EA',
  borderDark: '#D1D1D6',
  primary: '#000000',
  primaryText: '#FFFFFF',
  primaryGlow: 'rgba(0, 0, 0, 0.08)',
  accent: '#111111',
  accentGlow: 'rgba(0, 0, 0, 0.06)',
  accentBlue: '#000000',
  accentOrange: '#333333',
  accentOrangeGlow: 'rgba(0, 0, 0, 0.06)',
  accentPurple: '#222222',
  success: '#111111',
  danger: '#DC2626',
  hairline: '#E5E5EA',
  inputBg: '#F2F2F7',
  bgCard: '#FFFFFF',
  bgCardElevated: '#F5F5F7',
  bgInput: '#F2F2F7',
  borderLight: '#E5E5EA',
};

export const DARK_THEME: ThemeColors = {
  isDark: true,
  bg: '#000000',
  bgSecondary: '#121214',
  bgTertiary: '#1C1C1E',
  card: '#121214',
  cardSubtle: '#18181A',
  text: '#FFFFFF',
  textSecondary: '#A1A1AA',
  textMuted: '#71717A',
  border: '#27272A',
  borderDark: '#3F3F46',
  primary: '#FFFFFF',
  primaryText: '#000000',
  primaryGlow: 'rgba(255, 255, 255, 0.12)',
  accent: '#EEEEEE',
  accentGlow: 'rgba(255, 255, 255, 0.08)',
  accentBlue: '#FFFFFF',
  accentOrange: '#CCCCCC',
  accentOrangeGlow: 'rgba(255, 255, 255, 0.08)',
  accentPurple: '#DDDDDD',
  success: '#FFFFFF',
  danger: '#EF4444',
  hairline: '#27272A',
  inputBg: '#1C1C1E',
  bgCard: '#121214',
  bgCardElevated: '#1C1C1E',
  bgInput: '#1C1C1E',
  borderLight: '#27272A',
};

export const THEME = {
  colors: LIGHT_THEME,
  radius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 22,
    full: 9999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 28,
  },
};

export interface ThemeContextType {
  theme: ThemeColors;
  isDark: boolean;
  toggleTheme: () => void;
  setThemeMode: (dark: boolean) => void;
}

export const ThemeContext = createContext<ThemeContextType>({
  theme: LIGHT_THEME,
  isDark: false,
  toggleTheme: () => {},
  setThemeMode: () => {},
});

export const useAppTheme = () => useContext(ThemeContext);
