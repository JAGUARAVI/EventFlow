import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'designbattles-theme';

function readInitial() {
  try {
    const t = localStorage.getItem(STORAGE_KEY);
    if (t === 'dark' || t === 'light') return t === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(readInitial);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const setDark = useCallback((value) => {
    setIsDark(!!value);
    try {
      localStorage.setItem(STORAGE_KEY, value ? 'dark' : 'light');
    } catch (_) {}
  }, []);

  return (
    <ThemeContext.Provider value={{ isDark, setDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const c = useContext(ThemeContext);
  if (!c) throw new Error('useTheme must be used within ThemeProvider');
  return c;
}
