"use client";

import type { CSSProperties } from "react";
import styles from "./KomorebiSafari.module.sass";

type KomorebiSafariProps = {
  opacity?: number;
  maskUrl?: string;
  layerColor?: string;
  blendMode?: CSSProperties["mixBlendMode"];
  blurPx?: number;
};

/**
 * macOS Safari version of the Komorebi effect.
 * Uses 3D transforms with perspective but avoids SVG filters (feTurbulence/feDisplacementMap)
 * which can cause rendering issues in Safari. Still looks good with the billowing animation.
 */
export function KomorebiSafari({
  opacity = 0.1,
  maskUrl = "/images/leaves.png",
  layerColor = "rgba(20, 16, 10, 0.9)",
  blendMode = "multiply",
  blurPx = 9,
}: KomorebiSafariProps) {
  return (
    <div aria-hidden="true" className={styles.komorebi}>
      <div className={styles.perspective}>
        <div
          className={styles.leaves}
          style={{
            opacity,
            backgroundColor: layerColor,
            filter: `blur(${blurPx}px)`,
            mixBlendMode: blendMode,
            WebkitFilter: `blur(${blurPx}px)`,
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
