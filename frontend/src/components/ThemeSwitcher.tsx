'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import styles from './ThemeSwitcher.module.sass';

const THEMES = [
  'light',
  'dark',
  'softlight',
  'softdark',
  'green',
  'nightmode',
] as const;

const THEME_LABELS: Record<string, string> = {
  light: 'Light',
  dark: 'Dark',
  softlight: 'Soft Light',
  softdark: 'Soft Dark',
  green: 'Green',
  nightmode: 'Nightmode',
};

export function ThemeSwitcher() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  // useEffect only runs on the client, so now we can safely show the UI
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Return a placeholder with same dimensions to avoid layout shift
    return (
      <div className={styles.themeSwitcher}>
        <span className={styles.label}>Theme</span>
        <div className={styles.placeholder} />
      </div>
    );
  }

  return (
    <div className={styles.themeSwitcher}>
      <label htmlFor="theme-select" className={styles.label}>
        Theme
      </label>
      <select
        id="theme-select"
        value={theme}
        onChange={(e) => setTheme(e.target.value)}
        className={styles.select}
      >
        {THEMES.map((t) => (
          <option key={t} value={t}>
            {THEME_LABELS[t]}
          </option>
        ))}
      </select>
    </div>
  );
}
