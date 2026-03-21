"use client";

import type { CSSProperties } from "react";
import styles from "./KomorebiDesktop.module.sass";

type KomorebiDesktopProps = {
  opacity?: number;
  maskUrl?: string;
  layerColor?: string;
  blendMode?: CSSProperties["mixBlendMode"];
  blurPx?: number;
  displacementScale?: number;
};

/**
 * Desktop/Chrome version of the Komorebi effect.
 * Uses full SVG filters (feTurbulence + feDisplacementMap) for wind animation,
 * complex 3D matrix transforms, and mix-blend-mode for the best visual effect.
 * Inspired by https://github.com/jackyzha0/sunlit
 */
export function KomorebiDesktop({
  opacity = 0.1,
  maskUrl = "/images/leaves.png",
  layerColor = "rgba(20, 16, 10, 0.9)",
  blendMode = "multiply",
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
            backgroundColor: layerColor,
            filter: filterValue,
            mixBlendMode: blendMode,
            WebkitMaskImage: `url(${maskUrl})`,
            WebkitMaskPosition: "center",
            WebkitMaskRepeat: "no-repeat",
            WebkitMaskSize: "cover",
            maskImage: `url(${maskUrl})`,
            maskPosition: "center",
            maskRepeat: "no-repeat",
            maskSize: "cover",
          }}
        />
      </div>
    </div>
  );
}
