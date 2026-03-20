'use client';

import type { CSSProperties } from 'react';
import styles from './BackgroundGradient.module.sass';

type BackgroundGradientProps = {
  opacity?: number;
};

export function BackgroundGradient({
  opacity = 1,
}: BackgroundGradientProps) {
  return (
    <div
      aria-hidden="true"
      className={styles.backgroundGradient}
      style={
        {
          '--background-gradient-opacity': opacity,
        } as CSSProperties
      }
    />
  );
}
