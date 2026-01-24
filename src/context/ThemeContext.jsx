import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'eventflow-theme';
const THEME_COLOR_KEY = 'eventflow-theme-colors';

// Default theme colors
const DEFAULT_COLORS = {
  primary: '#0070f3',
  secondary: '#7c3aed',
  accent: '#ec4899',
  neutral: '#6b7280',
  surface: '#ffffff',
  background: '#f9fafb',
};

// Map internal color keys to HeroUI CSS variables
export const COLOR_VAR_MAP = {
  primary: '--heroui-primary',
  secondary: '--heroui-secondary', 
  accent: '--heroui-focus',
  neutral: '--heroui-default',
  surface: '--heroui-content1',
  background: '--heroui-background',
};

function readInitialMode() {
  try {
    const t = localStorage.getItem(STORAGE_KEY);
    if (t === 'dark' || t === 'light') return t === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

function readInitialColors() {
  try {
    const colors = localStorage.getItem(THEME_COLOR_KEY);
    return colors ? JSON.parse(colors) : DEFAULT_COLORS;
  } catch {
    return DEFAULT_COLORS;
  }
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(readInitialMode);
  const [colors, setColors] = useState(readInitialColors);

  // Apply theme colors to CSS variables
  useEffect(() => {
    const root = document.documentElement;
    
    // Apply dark/light mode
    root.classList.toggle('dark', isDark);
    
    // Apply color variables
    Object.entries(colors).forEach(([key, value]) => {
      const varName = COLOR_VAR_MAP[key] || `--color-${key}`;
      //root.style.setProperty(varName, value);

      // Also set the --color- version for backwards compatibility/custom usage
      //root.style.setProperty(`--color-${key}`, value);
    });
  }, [isDark, colors]);

  const setDark = useCallback((value) => {
    setIsDark(!!value);
    try {
      localStorage.setItem(STORAGE_KEY, value ? 'dark' : 'light');
    } catch (_) {}
  }, []);

  const updateColors = useCallback((newColors) => {
    const merged = { ...colors, ...newColors };
    setColors(merged);
    try {
      localStorage.setItem(THEME_COLOR_KEY, JSON.stringify(merged));
    } catch (_) {}
  }, [colors]);

  const resetColors = useCallback(() => {
    setColors(DEFAULT_COLORS);
    try {
      localStorage.removeItem(THEME_COLOR_KEY);
    } catch (_) {}
  }, []);

  return (
    <ThemeContext.Provider 
      value={{ 
        isDark, 
        setDark,
        colors,
        updateColors,
        resetColors,
        defaultColors: DEFAULT_COLORS,
        colorMap: COLOR_VAR_MAP,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const c = useContext(ThemeContext);
  if (!c) throw new Error('useTheme must be used within ThemeProvider');
  return c;
}
