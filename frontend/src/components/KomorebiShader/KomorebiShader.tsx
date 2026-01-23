"use client";

import { useSyncExternalStore } from "react";
import { KomorebiDesktop } from "./KomorebiDesktop";
import { KomorebiSafari } from "./KomorebiSafari";
import { KomorebiIOS } from "./KomorebiIOS";

type Platform = "desktop" | "safari" | "ios";

type KomorebiShaderProps = {
  opacity?: number;
  textureUrl?: string;
  blurPx?: number;
  displacementScale?: number;
};

/**
 * Detect the current platform for rendering the appropriate Komorebi variant.
 * 
 * - iOS: iPhone, iPad, iPod, or iPad Pro (detected via maxTouchPoints)
 * - Safari: macOS Safari (not Chrome, Firefox, etc.)
 * - Desktop: Everything else (Chrome, Firefox, Edge, etc.)
 */
function detectPlatform(): Platform {
  if (typeof navigator === "undefined" || typeof window === "undefined") {
    return "desktop";
  }

  const ua = navigator.userAgent;

  // Detect iOS devices (iPhone, iPad, iPod)
  // Also detect iPad Pro which reports as MacIntel but has touch
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  if (isIOS) {
    return "ios";
  }

  // Detect macOS Safari (not Chrome, Firefox, or other browsers on Mac)
  // CriOS = Chrome on iOS, FxiOS = Firefox on iOS
  const isSafari =
    /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Android/i.test(ua);

  if (isSafari) {
    return "safari";
  }

  return "desktop";
}

// Cache the platform detection result (UA doesn't change during session)
let cachedPlatform: Platform | null = null;
function getPlatform(): Platform {
  if (cachedPlatform === null) {
    cachedPlatform = detectPlatform();
  }
  return cachedPlatform;
}

// For SSR, default to desktop (will be corrected on hydration)
function getServerSnapshot(): Platform {
  return "desktop";
}

// Subscribe is a no-op since platform never changes
function subscribe() {
  return () => {};
}

/**
 * KomorebiShader - Ambient leaf shadow effect
 * 
 * Automatically selects the appropriate rendering variant based on the platform:
 * - Desktop (Chrome, Firefox, Edge): Full SVG filters + 3D transforms
 * - Safari (macOS): 3D transforms without SVG filters
 * - iOS: Simple 2D transforms only
 */
export default function KomorebiShader({
  opacity = 0.1,
  textureUrl = "/images/leaves.png",
  blurPx = 9,
  displacementScale = 50,
}: KomorebiShaderProps) {
  // Detect platform on client using useSyncExternalStore for hydration safety
  const platform = useSyncExternalStore(subscribe, getPlatform, getServerSnapshot);

  switch (platform) {
    case "ios":
      return (
        <KomorebiIOS
          opacity={opacity}
          textureUrl={textureUrl}
          blurPx={blurPx}
        />
      );

    case "safari":
      return (
        <KomorebiSafari
          opacity={opacity}
          textureUrl={textureUrl}
          blurPx={blurPx}
        />
      );

    case "desktop":
    default:
      return (
        <KomorebiDesktop
          opacity={opacity}
          textureUrl={textureUrl}
          blurPx={blurPx}
          displacementScale={displacementScale}
        />
      );
  }
}
