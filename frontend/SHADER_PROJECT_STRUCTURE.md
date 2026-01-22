# Komorebi Shader - Project Structure

## 📁 File Organization

```
frontend/
├── src/
│   ├── components/
│   │   ├── KomorebiShader.tsx           ⭐ Core shader component (522 lines)
│   │   ├── HeroKomorebi.tsx             ⭐ Hero wrapper component (34 lines)
│   │   └── KomorebiShader/
│   │       └── index.ts                  📦 Export barrel
│   │
│   └── app/
│       ├── shader-test/
│       │   └── page.tsx                  🧪 Live test page
│       └── example-komorebi-page.tsx     📚 Usage examples
│
├── public/
│   └── textures/                         🎨 (Optional) Custom textures go here
│       └── komorebi-noise.png            (Not required - auto-generated)
│
├── INTEGRATION_GUIDE.md                  📖 Quick start guide
├── KOMOREBI_SHADER_README.md             📖 Full documentation
├── KOMOREBI_IMPLEMENTATION_SUMMARY.md    📋 Implementation details
└── SHADER_PROJECT_STRUCTURE.md           📁 This file
```

---

## 🔍 Component Hierarchy

```
Application
│
└── Page Component (Your page)
    │
    ├── Option A: HeroKomorebi (Recommended)
    │   ├── <section> (relative positioning)
    │   │   ├── Shader Overlay (absolute, pointer-events: none)
    │   │   │   └── KomorebiShader
    │   │   │       └── Canvas (R3F)
    │   │   │           └── ShaderPlane
    │   │   │               └── ShaderMaterial
    │   │   │
    │   │   └── Content (relative, z-10)
    │   │       └── {children}
    │
    └── Option B: KomorebiShader (Direct)
        └── Canvas (R3F)
            └── ShaderPlane
                └── ShaderMaterial
```

---

## 🎯 Component Responsibilities

### KomorebiShader.tsx
**Purpose:** Core WebGL shader renderer

**Exports:**
- `default KomorebiShader` component

**Dependencies:**
- `react` - Hooks (useRef, useEffect, useMemo, useState)
- `@react-three/fiber` - Canvas, useFrame, useThree
- `three` - THREE.* (Texture, Vector3, Vector4, ShaderMaterial, etc.)

**Internal Components:**
- `ShaderPlane` - Mesh with shader material
- `createNoiseTexture()` - Procedural texture generator

**Props:**
```typescript
{
  className?: string;      // Wrapper CSS class
  intensity?: number;      // 0-1, opacity control
  speed?: number;          // Time multiplier
  textureUrl?: string;     // Optional custom texture
}
```

**Responsibilities:**
- ✅ WebGL canvas management
- ✅ Shader compilation and linking
- ✅ Uniform updates (frame-by-frame)
- ✅ Texture loading/generation
- ✅ Mouse tracking
- ✅ Resize handling
- ✅ Reduced motion detection

---

### HeroKomorebi.tsx
**Purpose:** Convenient wrapper for hero sections

**Exports:**
- `default HeroKomorebi` component

**Dependencies:**
- `react` - ReactNode type
- `next/dynamic` - Dynamic import
- `./KomorebiShader` - The shader component

**Props:**
```typescript
{
  children: ReactNode;     // Content over shader
  intensity?: number;      // 0-1, default 0.5
  speed?: number;          // Time multiplier, default 0.5
  textureUrl?: string;     // Optional texture
  className?: string;      // Section CSS class
}
```

**Responsibilities:**
- ✅ Dynamic import (SSR safety)
- ✅ Layout positioning (absolute shader, relative content)
- ✅ Z-index management
- ✅ Pointer events handling

---

## 🧩 Data Flow

```
User Interaction
    │
    ├─► Mouse Move ──► window.pointermove event
    │                   └─► Update iMouse uniform
    │
    ├─► Window Resize ──► R3F size.width/height
    │                      └─► Update iResolution uniform
    │
    └─► Prop Changes ──► React state/props
                          ├─► intensity → uIntensity uniform
                          ├─► speed → time multiplier
                          └─► textureUrl → texture reload

Animation Loop
    │
    └─► useFrame (60 FPS)
         └─► Update iTime uniform
             └─► Shader recompute
                 └─► gl_FragColor rendered
```

---

## 🎨 Rendering Pipeline

```
1. Component Mount
   ├─► Detect reduced motion
   ├─► Load/generate texture
   └─► Initialize uniforms

2. First Render
   ├─► Create Canvas (R3F)
   ├─► Setup Camera (orthographic)
   └─► Create Mesh + ShaderMaterial

3. Every Frame (useFrame)
   ├─► Calculate elapsed time
   ├─► Update iTime uniform
   └─► WebGL draws frame

4. On Interaction
   ├─► Mouse Move → iMouse.xy update
   ├─► Window Resize → iResolution update
   └─► Prop Change → uniform update

5. Component Unmount
   ├─► Remove event listeners
   ├─► Dispose textures
   └─► Cleanup WebGL context
```

---

## 📦 Bundle Analysis

### Main Dependencies

```
@react-three/fiber (^9.5.0)
├── Size: ~50KB (gzipped: ~15KB)
└── Dependencies:
    ├── react
    ├── react-dom
    └── three (peer)

three (^0.182.0)
├── Size: ~550KB (gzipped: ~130KB)
└── Tree-shakeable: Yes
    └── Used: Core, TextureLoader, ShaderMaterial, Mesh, etc.

@types/three (^0.182.0)
└── Dev only, not in bundle
```

**Total Added Bundle Size:**
- Uncompressed: ~600KB
- Gzipped: ~145KB
- Brotli: ~120KB

**Optimization Opportunities:**
- Three.js is tree-shakeable (only used parts included)
- Consider code splitting for shader pages
- Lazy load with dynamic imports (already implemented)

---

## 🔄 State Management

### Component State (KomorebiShader)

```typescript
// Texture state
const [texture, setTexture] = useState<THREE.Texture | null>(null);

// Reduced motion detection
const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

// Refs (no re-render)
const meshRef = useRef<THREE.Mesh>(null);

// Memoized values (expensive computations)
const uniforms = useMemo(() => ({
  iTime: { value: 0 },
  iResolution: { value: new THREE.Vector3() },
  iMouse: { value: new THREE.Vector4() },
  iChannel0: { value: texture },
  uIntensity: { value: intensity }
}), [texture, intensity, size]);
```

### Props Flow

```
Page Component
    │
    ├─► intensity={0.6}
    │   └─► HeroKomorebi
    │       └─► KomorebiShader
    │           └─► uIntensity uniform
    │
    ├─► speed={0.5}
    │   └─► HeroKomorebi
    │       └─► KomorebiShader
    │           └─► iTime multiplier
    │
    └─► textureUrl="/path"
        └─► HeroKomorebi
            └─► KomorebiShader
                └─► TextureLoader
```

---

## 🧪 Testing Structure

### Test Page (`/shader-test`)

```
ShaderTestPage
├── HeroKomorebi (min-h-screen)
│   ├── Shader Background
│   └── Hero Content
│       ├── Title
│       ├── Description
│       └── CTA Buttons
│
├── Info Section (white bg)
│   └── Feature List
│
└── Next Steps Section (gray bg)
    └── Integration Guide
```

**Purpose:**
- Visual verification of shader rendering
- Test pointer events (should scroll freely)
- Test mouse tracking
- Test reduced motion
- Demonstrate content overlay

---

## 🎛️ Configuration Presets

### Recommended Settings

```typescript
// Subtle background (good for text-heavy pages)
{
  intensity: 0.3,
  speed: 0.3
}

// Normal (balanced)
{
  intensity: 0.5,
  speed: 0.5
}

// Dramatic (hero sections)
{
  intensity: 0.7,
  speed: 0.6
}

// Static (no animation)
{
  intensity: 0.5,
  speed: 0
}

// Mobile-optimized
{
  intensity: 0.3,
  speed: 0.4
}
```

---

## 🔐 Type Safety

### Exported Types

```typescript
// KomorebiShader.tsx
interface KomorebiShaderProps {
  className?: string;
  intensity?: number;
  speed?: number;
  textureUrl?: string;
}

// HeroKomorebi.tsx
interface HeroKomorebiProps {
  children: ReactNode;
  intensity?: number;
  speed?: number;
  textureUrl?: string;
  className?: string;
}
```

### Internal Types

```typescript
// Shader plane props
interface ShaderPlaneProps {
  intensity: number;
  speed: number;
  texture: THREE.Texture;
}

// Uniform structure
type UniformsType = {
  iTime: { value: number };
  iResolution: { value: THREE.Vector3 };
  iMouse: { value: THREE.Vector4 };
  iChannel0: { value: THREE.Texture };
  uIntensity: { value: number };
};
```

---

## 📊 Performance Metrics

### Target Performance

- **FPS:** 60 (stable)
- **Initial Load:** < 500ms (shader compile + texture gen)
- **Frame Time:** < 16ms
- **Memory:** < 50MB GPU memory
- **CPU:** < 10% single core

### Monitoring

```typescript
// Add to KomorebiShader for debugging
useFrame((state, delta) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('Frame time:', delta * 1000, 'ms');
    console.log('FPS:', Math.round(1 / delta));
  }
});
```

---

## 🎨 Shader Architecture

### Shader Code Structure

```glsl
// VERTEX SHADER (simple passthrough)
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}

// FRAGMENT SHADER (complex)
├── Uniforms
│   ├── iTime (animated time)
│   ├── iResolution (screen size)
│   ├── iMouse (pointer position)
│   ├── iChannel0 (texture sampler)
│   └── uIntensity (opacity control)
│
├── Primitives (IQ distance functions)
│   ├── sdPlane() - Distance to plane
│   ├── sdBox() - Distance to box
│   ├── sdSphere() - Distance to sphere
│   └── opU(), opS(), opI(), opBlend() - Combinators
│
├── Scene Definition
│   └── map() - Returns (distance, material) for scene
│
├── Ray Marching
│   ├── castRay() - March ray through scene
│   └── 64 iterations, precision 0.0005*t
│
├── Lighting
│   ├── calcNormal() - Surface normal via central differences
│   ├── calcAO() - Ambient occlusion (5 samples)
│   ├── softshadow() - Soft shadows (16 samples)
│   └── calcShadow() - Shadow with texture mask
│
├── Rendering
│   └── render() - Combine lighting + materials
│
└── Main Entry
    ├── mainImage() - ShaderToy entry point
    └── main() - WebGL entry point
        └── Calls mainImage()
            └── Applies uIntensity
                └── Sets gl_FragColor
```

---

## 🚀 Deployment Flow

```
Development
    │
    ├─► Local Dev Server (npm run dev)
    │   └─► http://localhost:3000/shader-test
    │
    └─► Hot Reload (changes update instantly)

Build
    │
    ├─► Next.js Build (npm run build)
    │   ├─► TypeScript compilation
    │   ├─► Bundle optimization
    │   └─► Code splitting
    │
    └─► Output
        ├─► Static pages
        ├─► Client bundles
        └─► Server components

Production
    │
    ├─► Deploy to Vercel/Netlify/etc
    │   └─► CDN distribution
    │
    └─► Monitoring
        ├─► WebGL errors
        ├─► Performance metrics
        └─► User analytics
```

---

## 📚 Documentation Map

```
Documentation/
│
├── INTEGRATION_GUIDE.md
│   ├── Installation
│   ├── Quick Start
│   ├── Props Reference
│   ├── Examples
│   └── Troubleshooting
│
├── KOMOREBI_SHADER_README.md
│   ├── Overview
│   ├── Technical Details
│   ├── Shader Explanation
│   ├── Custom Textures
│   └── Advanced Usage
│
├── KOMOREBI_IMPLEMENTATION_SUMMARY.md
│   ├── What Was Built
│   ├── Features
│   ├── Architecture
│   ├── Testing
│   └── Deployment
│
└── SHADER_PROJECT_STRUCTURE.md (This file)
    ├── File Organization
    ├── Component Hierarchy
    ├── Data Flow
    ├── Rendering Pipeline
    └── Configuration
```

**Reading Order:**
1. Start: `INTEGRATION_GUIDE.md` (Quick start)
2. Next: `KOMOREBI_IMPLEMENTATION_SUMMARY.md` (What was built)
3. Deep dive: `KOMOREBI_SHADER_README.md` (Technical details)
4. Reference: `SHADER_PROJECT_STRUCTURE.md` (Architecture)

---

## 🎓 Learning Path

### Beginner
1. Read `INTEGRATION_GUIDE.md`
2. Copy basic example
3. Test on `/shader-test` page
4. Adjust `intensity` and `speed` props

### Intermediate
1. Read `KOMOREBI_SHADER_README.md`
2. Try custom textures
3. Create variant wrapper components
4. Optimize for mobile

### Advanced
1. Study `KomorebiShader.tsx` source
2. Modify shader code (add features)
3. Implement dynamic uniforms
4. Create custom ShaderToy ports

---

## ✅ Checklist for New Developers

**Setup:**
- [ ] Dependencies installed (`npm install`)
- [ ] TypeScript compiling (`npm run build`)
- [ ] Dev server running (`npm run dev`)

**Verification:**
- [ ] Navigate to `/shader-test`
- [ ] See animated background
- [ ] Scroll works (not blocked)
- [ ] Mouse tracking works
- [ ] No console errors

**Integration:**
- [ ] Read `INTEGRATION_GUIDE.md`
- [ ] Copy example to your page
- [ ] Adjust props to taste
- [ ] Test on mobile
- [ ] Verify accessibility

**Deployment:**
- [ ] Build succeeds
- [ ] No TypeScript errors
- [ ] Lighthouse score good
- [ ] Cross-browser tested

---

## 🎉 Summary

The Komorebi shader implementation is:

✅ **Complete** - All files created, documented, and tested  
✅ **Production-ready** - No TODOs or placeholders  
✅ **Well-structured** - Clean separation of concerns  
✅ **Type-safe** - Full TypeScript coverage  
✅ **Documented** - Multiple guides for all skill levels  
✅ **Tested** - Live test page included  
✅ **Performant** - Optimized for web  
✅ **Accessible** - Respects user preferences  

**Ready to use!** 🚀
