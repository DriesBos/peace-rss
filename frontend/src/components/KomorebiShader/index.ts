// KomorebiShader - Ambient leaf shadow effect
// Automatically selects the best rendering variant for the current platform

export { default } from "./KomorebiShader";
export { default as KomorebiShader } from "./KomorebiShader";

// Platform-specific variants (for direct use if needed)
export { KomorebiDesktop } from "./KomorebiDesktop";
export { KomorebiSafari } from "./KomorebiSafari";
export { KomorebiIOS } from "./KomorebiIOS";
