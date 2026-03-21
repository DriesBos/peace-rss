"use client";

import type { CSSProperties } from "react";
import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { KomorebiDesktop } from "./KomorebiDesktop";
import { KomorebiSafari } from "./KomorebiSafari";
import { KomorebiIOS } from "./KomorebiIOS";
import { getEffectiveTheme } from "@/lib/theme";

type Platform = "desktop" | "safari" | "ios";

type KomorebiShaderProps = {
  opacity?: number;
  textureUrl?: string;
  darkTextureUrl?: string;
  blurPx?: number;
  displacementScale?: number;
};

type ThemeSettings = {
  blendMode: CSSProperties["mixBlendMode"];
  layerColor: string;
  opacity: number;
  textureUrl: string;
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
  darkTextureUrl = "/images/leaves-inverted.png",
  blurPx = 9,
  displacementScale = 50,
}: KomorebiShaderProps) {
  const { resolvedTheme, theme } = useTheme();

  // Detect platform on client using useSyncExternalStore for hydration safety
  const platform = useSyncExternalStore(subscribe, getPlatform, getServerSnapshot);

  if (theme === undefined && resolvedTheme === undefined) {
    return null;
  }

  const effectiveTheme = getEffectiveTheme(theme, resolvedTheme);

  if (effectiveTheme === "night") {
    return null;
  }

  const themeSettings: ThemeSettings =
    effectiveTheme === "dark"
      ? {
          blendMode: "screen",
          layerColor: "rgba(244, 233, 201, 0.92)",
          opacity: opacity * 0.8,
          textureUrl: darkTextureUrl,
        }
      : {
          blendMode: "multiply",
          layerColor: "rgba(20, 16, 10, 0.9)",
          opacity,
          textureUrl,
        };

  switch (platform) {
    case "ios":
      return (
        <KomorebiIOS
          opacity={themeSettings.opacity}
          blurPx={blurPx}
          layerColor={themeSettings.layerColor}
          maskUrl={themeSettings.textureUrl}
        />
      );

    case "safari":
      return (
        <KomorebiSafari
          opacity={themeSettings.opacity}
          blendMode={themeSettings.blendMode}
          blurPx={blurPx}
          layerColor={themeSettings.layerColor}
          maskUrl={themeSettings.textureUrl}
        />
      );

    case "desktop":
    default:
      return (
        <KomorebiDesktop
          opacity={themeSettings.opacity}
          blendMode={themeSettings.blendMode}
          blurPx={blurPx}
          displacementScale={displacementScale}
          layerColor={themeSettings.layerColor}
          maskUrl={themeSettings.textureUrl}
        />
      );
  }
}
