"use client";

import styles from "./KomorebiIOS.module.sass";

type KomorebiIOSProps = {
  opacity?: number;
  textureUrl?: string;
  blurPx?: number;
};

/**
 * iOS Safari version of the Komorebi effect.
 * Uses only 2D transforms to avoid iOS Safari rendering bugs with:
 * - SVG filters (feTurbulence/feDisplacementMap)
 * - mix-blend-mode (causes flickering)
 * - Complex 3D transforms (unreliable compositing)
 * - perspective() in animations (causes elements to disappear)
 * 
 * Still provides a gentle, ambient effect that works reliably on iOS.
 */
export function KomorebiIOS({
  opacity = 0.1,
  textureUrl = "/images/leaves.png",
  blurPx = 9,
}: KomorebiIOSProps) {
  return (
    <div aria-hidden="true" className={styles.komorebi}>
      <div className={styles.perspective}>
        <div
          className={styles.leaves}
          style={{
            opacity,
            backgroundImage: `url(${textureUrl})`,
            WebkitFilter: `blur(${blurPx}px)`,
            filter: `blur(${blurPx}px)`,
          }}
        />
      </div>
    </div>
  );
}
