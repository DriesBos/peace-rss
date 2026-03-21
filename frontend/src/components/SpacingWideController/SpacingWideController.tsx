'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { getEffectiveTheme } from '@/lib/theme';

function applySpacingWide(isWide: boolean) {
  if (typeof document === 'undefined') return;

  document.body.dataset.spacingWide = String(isWide);
}

export function SpacingWideController() {
  const { theme, resolvedTheme } = useTheme();

  useEffect(() => {
    const effectiveTheme = getEffectiveTheme(theme, resolvedTheme);
    const isDarkTheme = effectiveTheme === 'dark' || effectiveTheme === 'night';
    applySpacingWide(isDarkTheme);
  }, [resolvedTheme, theme]);

  return null;
}
