"use client";

import type { CSSProperties } from "react";
import styles from "./KomorebiSafari.module.sass";

type KomorebiSafariProps = {
  opacity?: number;
  maskUrl?: string;
  layerColor?: string;
  blendMode?: CSSProperties["mixBlendMode"];
  blurPx?: number;
  displacementScale?: number;
};

/**
 * macOS Safari version of the Komorebi effect.
 * Uses a reduced-cost SVG turbulence/displacement pass
 * to stay closer to the desktop rendering on modern Safari.
 */
export function KomorebiSafari({
  opacity = 0.1,
  maskUrl = "/images/leaves.png",
  layerColor = "rgba(20, 16, 10, 0.9)",
  blendMode = "multiply",
  blurPx = 9,
  displacementScale = 25,
}: KomorebiSafariProps) {
  const filterValue = `url(#komorebi-wind-safari) blur(${blurPx}px)`;
  const minScale = Math.max(12, Math.round(displacementScale * 0.76));
  const maxScale = Math.max(minScale + 6, Math.round(displacementScale * 1.24));
  const svgFilterMarkup = `
    <svg class="${styles.svgDefs}" style="display: none;">
      <defs>
        <filter id="komorebi-wind-safari" x="-18%" y="-18%" width="136%" height="136%">
          <feTurbulence type="fractalNoise" numOctaves="1" seed="1">
            <animate attributeName="baseFrequency" dur="18s" calcMode="spline" values="0.006 0.004;0.008 0.006;0.006 0.004" keyTimes="0;0.5;1" keySplines="0.4 0 0.6 1; 0.4 0 0.6 1" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" scale="${displacementScale}">
            <animate attributeName="scale" dur="24s" calcMode="spline" values="${minScale};${displacementScale};${maxScale};${displacementScale};${minScale}" keyTimes="0;0.25;0.5;0.75;1" keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1" repeatCount="indefinite" />
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
            WebkitFilter: filterValue,
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
