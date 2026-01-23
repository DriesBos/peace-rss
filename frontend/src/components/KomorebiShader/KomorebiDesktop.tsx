"use client";

import styles from "./KomorebiDesktop.module.sass";

type KomorebiDesktopProps = {
  opacity?: number;
  textureUrl?: string;
  blurPx?: number;
  displacementScale?: number;
};

/**
 * Desktop/Chrome version of the Komorebi effect.
 * Uses full SVG filters (feTurbulence + feDisplacementMap) for wind animation,
 * complex 3D matrix transforms, and mix-blend-mode for the best visual effect.
 */
export function KomorebiDesktop({
  opacity = 0.1,
  textureUrl = "/images/leaves.png",
  blurPx = 9,
  displacementScale = 50,
}: KomorebiDesktopProps) {
  const filterValue = `url(#komorebi-wind) blur(${blurPx}px)`;

  const svgFilterMarkup = `
    <svg class="${styles.svgDefs}" style="display: none;">
      <defs>
        <filter id="komorebi-wind" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" numOctaves="2" seed="1">
            <animate attributeName="baseFrequency" dur="16s" calcMode="spline" values="0.007 0.005;0.01 0.009;0.008 0.005;0.005 0.003" keyTimes="0;0.33;0.66;1" keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" scale="${displacementScale}">
            <animate attributeName="scale" dur="20s" calcMode="spline" values="45;55;75;55;45" keyTimes="0;0.25;0.5;0.75;1" keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1" repeatCount="indefinite" />
          </feDisplacementMap>
        </filter>
      </defs>
    </svg>
  `;

  return (
    <div aria-hidden="true" className={styles.komorebi}>
      <div dangerouslySetInnerHTML={{ __html: svgFilterMarkup }} />

      <div className={styles.perspective}>
        <div
          className={styles.leaves}
          style={{
            opacity,
            backgroundImage: `url(${textureUrl})`,
            filter: filterValue,
          }}
        />
      </div>
    </div>
  );
}
