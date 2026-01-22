"use client";


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
  opacity = 0.07,
  textureUrl = "/public/leaves.png",
  blurPx = 9,
  displacementScale = 50,
}: KomorebiAmbienceProps) {
  return (
    <div aria-hidden="true" className="komorebi-root">
      {/* SVG filter defs (kept tiny; no layout impact) */}
      <svg className="komorebi-svg-defs">
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

      {/* Leaves layer */}
      <div
        className="komorebi-leaves"
        style={{
          opacity,
          backgroundImage: `url(${textureUrl})`,
          filter: `url(#komorebi-wind) blur(${blurPx}px)`,
        }}
      />

      <style jsx global>{`
        .komorebi-svg-defs {
          width: 0;
          height: 0;
          position: absolute;
        }

        .komorebi-leaves {
          position: absolute;
          inset: -10%;
          background-repeat: repeat;
          background-size: 900px auto; /* tweak: larger = slower/broader patches */
          transform: translateZ(0);
          will-change: filter, transform;
          /* Choose blend mode depending on whether you want additive light or shadow */
          mix-blend-mode: multiply;
        }

        /* Reduced motion: keep the layer but stop expensive animated displacement */
        @media (prefers-reduced-motion: reduce) {
          .komorebi-leaves {
            filter: blur(${blurPx}px);
          }
          .komorebi-svg-defs {
            display: none;
          }
        }

        /* High contrast users: remove decorative effect */
        @media (prefers-contrast: high) {
          .komorebi-root {
            display: none !important;
          }
        }

        /* Firefox can be CPU-heavy with feDisplacementMap; degrade gracefully */
        @-moz-document url-prefix() {
          .komorebi-leaves {
            filter: blur(${blurPx}px);
          }
        }
      `}</style>
    </div>
  );
}
