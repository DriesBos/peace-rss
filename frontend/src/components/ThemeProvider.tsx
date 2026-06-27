'use client';

import {
  ThemeProvider as NextThemesProvider,
  useTheme,
  type ThemeProviderProps,
} from 'next-themes';
import { useEffect } from 'react';
import { getEffectiveTheme, normalizeLegacyTheme } from '@/lib/theme';

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <ThemeStateBridge />
      {children}
    </NextThemesProvider>
  );
}

function ThemeStateBridge() {
  const { resolvedTheme, setTheme, theme } = useTheme();

  useEffect(() => {
    const normalizedTheme = normalizeLegacyTheme(theme);
    if (!normalizedTheme || normalizedTheme === theme) return;
    setTheme(normalizedTheme);
  }, [setTheme, theme]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const applyEffectiveTheme = () => {
      document.documentElement.dataset.theme = getEffectiveTheme(
        theme,
        resolvedTheme,
      );
    };

    applyEffectiveTheme();

    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        applyEffectiveTheme();
      }
    };

    systemTheme.addEventListener('change', applyEffectiveTheme);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      systemTheme.removeEventListener('change', applyEffectiveTheme);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [resolvedTheme, theme]);

  return null;
}
