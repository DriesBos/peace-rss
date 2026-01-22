"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./KomorebiShader.module.sass";

type KomorebiAmbienceProps = {
  opacity?: number;
  textureUrl?: string;
  blurPx?: number;
  displacementScale?: number;
};

function isSafariUA() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // Safari includes "Safari" but not "Chrome" (Chromium) or "Android"
  return /Safari/i.test(ua) && !/Chrome|Chromium|Android/i.test(ua);
}

export default function KomorebiAmbience({
  opacity = 0.1,
  textureUrl = "/images/leaves.png",
  blurPx = 9,
  displacementScale = 50,
}: KomorebiAmbienceProps) {
  const [isSafari, setIsSafari] = useState(false);

  useEffect(() => {
    setIsSafari(isSafariUA());
  }, []);

  const filterValue = useMemo(() => {
    // Safari fallback: avoid url(#komorebi-wind)
    if (isSafari) return `blur(${blurPx}px)`;
    return `url(#komorebi-wind) blur(${blurPx}px)`;
  }, [isSafari, blurPx]);

  return (
    <div aria-hidden="true" className={styles.komorebi}>
      {/* Keep defs for non-Safari */}
      <svg className={styles.komorebi_svg_defs}>
        <defs>
          <filter id="komorebi-wind" x="-20%" y="-20%" width="140%" height="140%">
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

      <div className={styles.komorebi_Perspective}>
        <div
          className={[
            styles.komorebi_Leaves,
            isSafari ? styles.komorebi_LeavesFallback : "",
          ].join(" ")}
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
