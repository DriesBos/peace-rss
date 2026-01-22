"use client";

import styles from "./KomorebiShader.module.sass";

type KomorebiAmbienceProps = {
  /** Controls overall visibility. Good starting range: 0.04–0.12 */
  opacity?: number;
  /** Path to your leaf mask texture in /public */
  textureUrl?: string;
  /** Blur radius in px (softens the dapple) */
  blurPx?: number;
  /** Displacement intensity (wind wobble) */
  displacementScale?: number;
};

export default function KomorebiAmbience({
  opacity = 0.1,
  textureUrl = "/images/leaves.png",
  blurPx = 9,
  displacementScale = 50,
}: KomorebiAmbienceProps) {
  return (
    <div aria-hidden="true" className={styles.komorebi}>
      {/* SVG filter defs (kept tiny; no layout impact) */}
      <svg className={styles.komorebi_svg_defs}>
        <defs>
          <filter
            id="komorebi-wind"
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
          >
            <feTurbulence type="fractalNoise" numOctaves="2" seed="1">
              <animate
                attributeName="baseFrequency"
                dur="16s"
                calcMode="spline"
                values="0.007 0.005;0.01 0.009;0.008 0.005;0.005 0.003"
                keyTimes="0;0.33;0.66;1"
                keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1"
                repeatCount="indefinite"
              />
            </feTurbulence>

            <feDisplacementMap in="SourceGraphic" scale={displacementScale}>
              <animate
                attributeName="scale"
                dur="20s"
                calcMode="spline"
                values="45;55;75;55;45"
                keyTimes="0;0.25;0.5;0.75;1"
                keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1"
                repeatCount="indefinite"
              />
            </feDisplacementMap>
          </filter>
        </defs>
      </svg>

      {/* Perspective container for 3D transform */}
      <div className={styles.komorebi_Perspective}>
        {/* Leaves layer */}
        <div
          className={styles.komorebi_Leaves}
          style={{
            opacity: opacity,
            backgroundImage: `url(${textureUrl})`,
            filter: `url(#komorebi-wind) blur(${blurPx}px)`,
          }}
        />
      </div>
    </div>
  );
}
