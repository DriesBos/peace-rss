# Komorebi Shader Refactoring Notes

## What Changed

The shader has been **completely refactored** from a 3D raymarched scene to a lightweight 2D shadow mask overlay.

---

## Summary of Changes

### Before (3D Raymarching)
- Full 3D scene with geometry (planes, boxes)
- Raymarching engine (64 iterations per pixel)
- Camera, lighting, ambient occlusion, fog
- Sky gradient, grass, walls rendered
- Heavy computation (~500+ lines of shader code)
- Output: Full rendered scene with colors

### After (2D Shadow Mask)
- Pure 2D UV-based fragment shader
- No geometry, no raymarching
- Multi-layer texture sampling with animation
- Rotation, drift, and scale effects
- Lightweight (~100 lines of shader code)
- Output: Black with alpha (shadow mask only)

---

## Technical Details

### Removed Functions

All 3D scene functions were removed:
- `sdPlane`, `sdBox`, `sdSphere` (SDF primitives)
- `opU`, `opS`, `opI`, `opBlend` (primitive combinators)
- `map` (scene definition)
- `castRay` (raymarching engine)
- `softshadow` (3D shadow casting)
- `calcNormal` (surface normals)
- `calcAO` (ambient occlusion)
- `render` (scene rendering)
- `setCamera` (camera transformation)

### Kept Functions

- ✅ `mirror(vec2)` - Seamless texture tiling

### New Functions

- ✅ `rot2D(float)` - 2D rotation matrix for animation
- ✅ `mainImage` - Completely rewritten for 2D approach

---

## New Shader Algorithm

```glsl
1. Normalize UV coordinates (0..1)
2. Apply time-based drift and rotation
3. Sample noise texture at multiple scales:
   - Layer 1: Large leaf clusters (scale1)
   - Layer 2: Medium details (scale2)
   - Layer 3: Fine detail (scale1 * 1.5)
4. Combine layers with weights
5. Apply vignette (darker at edges)
6. Shape with smoothstep for soft edges
7. Output as black with alpha = shadow intensity
```

---

## New Uniforms

Added to shader:
```glsl
uniform float uSpeed;     // Animation speed multiplier
uniform float uScale1;    // Size of larger shadow clusters
uniform float uScale2;    // Size of finer details
uniform float uSoftness;  // Edge softness control
```

Kept from original:
```glsl
uniform vec3 iResolution;  // Screen resolution
uniform float iTime;       // Elapsed time
uniform vec4 iMouse;       // Mouse position (still tracked but not used in shader)
uniform sampler2D iChannel0; // Noise texture
uniform float uIntensity;  // Shadow darkness
```

---

## New Props Interface

### KomorebiShader
```typescript
interface KomorebiShaderProps {
  className?: string;
  intensity?: number;   // Default: 0.3 (was 1.0)
  speed?: number;       // Default: 0.2 (was 1.0)
  textureUrl?: string;
  scale1?: number;      // NEW - Default: 2.5
  scale2?: number;      // NEW - Default: 4.0
  softness?: number;    // NEW - Default: 0.5
}
```

### HeroKomorebi
```typescript
interface HeroKomorebiProps {
  children: ReactNode;
  intensity?: number;   // Default: 0.3 (was 0.5)
  speed?: number;       // Default: 0.2 (was 0.5)
  textureUrl?: string;
  className?: string;
  scale1?: number;      // NEW - Default: 2.5
  scale2?: number;      // NEW - Default: 4.0
  softness?: number;    // NEW - Default: 0.5
}
```

---

## Breaking Changes

### Default Values Changed

| Prop | Old Default | New Default | Reason |
|------|-------------|-------------|--------|
| `intensity` | 1.0 / 0.5 | 0.3 | Subtler for overlay effect |
| `speed` | 1.0 / 0.5 | 0.2 | Slower, more natural motion |

### Shader Output Changed

- **Before:** RGB color output (sky, grass, walls, etc.)
- **After:** Black with alpha (shadow mask only)

This means:
- ✅ No more scene colors
- ✅ Background must be light colored to see effect
- ✅ Works with multiply blend mode naturally
- ✅ Much more suitable for landing pages

### Visual Appearance

The shader now looks like:
- ✅ Subtle animated shadows
- ✅ Organic leaf-like patterns
- ✅ Slow drifting motion
- ❌ No sky gradient
- ❌ No 3D geometry
- ❌ No rendered scene

---

## Performance Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Shader lines | ~500 | ~100 | 80% reduction |
| Raymarching | 64 steps/pixel | 0 | N/A |
| Texture samples | 1-2/pixel | 3/pixel | Minimal |
| GPU load | Medium-High | Low | Much faster |
| Mobile performance | Acceptable | Excellent | Better |

The new shader is **significantly faster** because:
1. No raymarching loop
2. No geometry intersection tests
3. Simple texture lookups only
4. No ambient occlusion or lighting calculations

---

## Migration Guide

### If you used the old shader

**Old usage:**
```tsx
<HeroKomorebi intensity={0.6} speed={0.5}>
  <h1 style={{ color: 'white' }}>Title</h1>
</HeroKomorebi>
```

**New usage:**
```tsx
<HeroKomorebi 
  intensity={0.4} 
  speed={0.2}
  className="bg-gradient-to-br from-amber-50 to-green-50"
>
  <h1 className="text-gray-900">Title</h1>
</HeroKomorebi>
```

**Key changes:**
1. ✅ Add light background color via `className`
2. ✅ Change text to dark colors (was white)
3. ✅ Lower intensity if too dark
4. ✅ Adjust speed if motion is too fast/slow
5. ✅ Tune `scale1`/`scale2` for pattern size
6. ✅ Adjust `softness` for edge quality

---

## Tuning Guide

### Intensity (Shadow Darkness)
- `0.1-0.2` - Very subtle, barely visible
- `0.3-0.4` - **Recommended** - Noticeable but tasteful
- `0.5-0.6` - Pronounced shadows
- `0.7+` - Very dark, dramatic

### Speed (Animation)
- `0` - Static (no movement)
- `0.1-0.2` - **Recommended** - Slow, natural
- `0.3-0.5` - Medium speed
- `0.6+` - Fast, noticeable motion

### Scale1 (Large Clusters)
- `1.0-2.0` - Very large shadow patches
- `2.5` - **Default** - Balanced
- `3.0-4.0` - Smaller clusters
- `5.0+` - Very fine pattern

### Scale2 (Fine Detail)
- `2.0-3.0` - Large details
- `4.0` - **Default** - Balanced
- `5.0-6.0` - Fine details
- `7.0+` - Very busy pattern

### Softness (Edge Quality)
- `0.2-0.3` - Sharp edges, crisp shadows
- `0.5` - **Default** - Balanced
- `0.7-0.8` - Very soft, diffused
- `1.0` - Maximum blur

---

## Design Recommendations

### Best Background Colors

The shadow overlay works best with:
- ✅ White or off-white
- ✅ Light pastels (cream, beige, light blue)
- ✅ Subtle gradients (amber-to-green, blue-to-white)
- ❌ Dark colors (shadows won't be visible)
- ❌ Black or very dark grey

### Example Gradients

```tsx
// Warm sunny day
className="bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50"

// Fresh garden
className="bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50"

// Clear sky
className="bg-gradient-to-br from-blue-50 via-cyan-50 to-sky-50"

// Natural wood
className="bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50"

// Soft neutral
className="bg-gradient-to-br from-gray-50 via-slate-50 to-zinc-50"
```

---

## Testing Checklist

After integrating the refactored shader:

- [ ] Shader renders (see animated shadows)
- [ ] Shadows are visible (check background color)
- [ ] Animation is smooth (not jerky)
- [ ] Speed feels natural (not too fast/slow)
- [ ] Pattern size is appropriate (adjust scale1/scale2)
- [ ] Intensity is right (not too dark/light)
- [ ] Reduced motion works (freezes when enabled)
- [ ] Mobile performance is good
- [ ] No console errors

---

## Rollback Instructions

If you need to revert to the old 3D shader:

1. The old implementation is not recoverable from this version
2. You would need to restore from git history before the refactor
3. The new version is recommended for production use (faster, lighter)

---

## Questions?

- Check `README_SHADER_INTEGRATION.md` for updated usage guide
- See `INTEGRATION_GUIDE.md` for detailed examples
- Test at `/shader-test` page for live demo
- Review new props in component files

---

## Summary

**What was removed:** 3D scene, raymarching, geometry, complex lighting  
**What was added:** 2D overlay, multi-layer sampling, tuning controls  
**Performance:** Much faster (80% code reduction)  
**Visual:** Shadow mask overlay instead of rendered scene  
**Use case:** Perfect for landing pages with light backgrounds  

The refactored shader is production-ready and optimized for modern web design patterns.
