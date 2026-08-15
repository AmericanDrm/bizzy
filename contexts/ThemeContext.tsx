import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeColors {
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  primary: string;
  primaryLight: string;
  error: string;
  errorBackground: string;
  success: string;
  successBackground: string;
  warning: string;
  card: string;
  cardBackground: string;
  inputBackground: string;
}

interface ThemeContextType {
  themeMode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setThemeMode: (mode: ThemeMode) => void;
}

const lightColors: ThemeColors = {
  background: '#f4f6f8',
  surface: '#ffffff',
  text: '#1a2332',
  textSecondary: '#5a6978',
  border: '#dce3ea',
  primary: '#1B4D6E',
  primaryLight: '#eaf2f8',
  error: '#dc2626',
  errorBackground: '#fef2f2',
  success: '#2D8B57',
  successBackground: '#e8f5ee',
  warning: '#d4850a',
  card: '#ffffff',
  cardBackground: '#ffffff',
  inputBackground: '#f0f3f6',
};

const darkColors: ThemeColors = {
  background: '#0a1118',
  surface: '#141e28',
  text: '#e8edf2',
  textSecondary: '#8899a8',
  border: '#253342',
  primary: '#3a9ad9',
  primaryLight: '#1a3248',
  error: '#f87171',
  errorBackground: '#3a1d1d',
  success: '#3dba6f',
  successBackground: '#1a2d22',
  warning: '#f0a030',
  card: '#141e28',
  cardBackground: '#141e28',
  inputBackground: '#1c2a36',
};

const ThemeContext = createContext<ThemeContextType>({
  themeMode: 'system',
  isDark: false,
  colors: lightColors,
  setThemeMode: () => {},
});

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

const THEME_STORAGE_KEY = '@business_manager_theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
        setThemeModeState(savedTheme as ThemeMode);
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
    } finally {
      setIsLoaded(true);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!isLoaded) {
        console.warn('Theme loading timeout - proceeding with default theme');
        setIsLoaded(true);
      }
    }, 2000);
    return () => clearTimeout(timeout);
  }, [isLoaded]);

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  const isDark =
    themeMode === 'dark' || (themeMode === 'system' && systemColorScheme === 'dark');

  const colors = isDark ? darkColors : lightColors;

  const value = {
    themeMode,
    isDark,
    colors,
    setThemeMode,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export { lightColors, darkColors };
