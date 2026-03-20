'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';

function applySpacingWide(isWide: boolean) {
  if (typeof document === 'undefined') return;

  document.body.dataset.spacingWide = String(isWide);
}

export function SpacingWideController() {
  const { theme, resolvedTheme } = useTheme();

  useEffect(() => {
    const isDarkTheme = theme === 'dark' || resolvedTheme === 'dark';
    applySpacingWide(isDarkTheme);
  }, [resolvedTheme, theme]);

  return null;
}
