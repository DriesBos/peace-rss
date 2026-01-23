"use client";

import styles from "./KomorebiSafari.module.sass";

type KomorebiSafariProps = {
  opacity?: number;
  textureUrl?: string;
  blurPx?: number;
};

/**
 * macOS Safari version of the Komorebi effect.
 * Uses 3D transforms with perspective but avoids SVG filters (feTurbulence/feDisplacementMap)
 * which can cause rendering issues in Safari. Still looks good with the billowing animation.
 */
export function KomorebiSafari({
  opacity = 0.1,
  textureUrl = "/images/leaves.png",
  blurPx = 9,
}: KomorebiSafariProps) {
  return (
    <div aria-hidden="true" className={styles.komorebi}>
      <div className={styles.perspective}>
        <div
          className={styles.leaves}
          style={{
            opacity,
            backgroundImage: `url(${textureUrl})`,
            filter: `blur(${blurPx}px)`,
            WebkitFilter: `blur(${blurPx}px)`,
          }}
        />
      </div>
    </div>
  );
}
