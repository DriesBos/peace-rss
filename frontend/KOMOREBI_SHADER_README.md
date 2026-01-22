# Komorebi Shader Integration

This directory contains a complete implementation of the "Dappled Light" ShaderToy shader integrated into your Next.js app using React Three Fiber.

## Installation

Install the required dependencies:

```bash
npm install three @react-three/fiber
# or
yarn add three @react-three/fiber
# or
pnpm add three @react-three/fiber
```

## Files Created

1. **`src/components/KomorebiShader.tsx`** - Core shader component
2. **`src/components/HeroKomorebi.tsx`** - Hero section wrapper component
3. **`src/app/example-komorebi-page.tsx`** - Usage examples and documentation

## Quick Start

### Option 1: Hero Section (Recommended)

```tsx
import HeroKomorebi from "@/components/HeroKomorebi";

export default function HomePage() {
  return (
    <HeroKomorebi intensity={0.6} speed={0.5} className="min-h-screen">
      <div className="container mx-auto px-4 py-20">
        <h1>Your Hero Content</h1>
      </div>
    </HeroKomorebi>
  );
}
```

### Option 2: Direct Usage

```tsx
import dynamic from "next/dynamic";

const KomorebiShader = dynamic(() => import("@/components/KomorebiShader"), {
  ssr: false,
});

export default function Page() {
  return (
    <div className="relative h-screen">
      <div className="absolute inset-0 pointer-events-none">
        <KomorebiShader intensity={0.8} speed={1.0} />
      </div>
      <div className="relative z-10">Your content</div>
    </div>
  );
}
```

## Props

### KomorebiShader

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | `""` | CSS class for wrapper div |
| `intensity` | `number` | `1.0` | Shader opacity/brightness (0-1) |
| `speed` | `number` | `1.0` | Animation speed multiplier |
| `textureUrl` | `string` | `undefined` | Optional custom noise texture path |

### HeroKomorebi

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | - | Content to render over shader |
| `intensity` | `number` | `0.5` | Shader opacity/brightness (0-1) |
| `speed` | `number` | `0.5` | Animation speed multiplier |
| `textureUrl` | `string` | `undefined` | Optional custom noise texture path |
| `className` | `string` | `""` | CSS class for section wrapper |

## Features

✅ **Client-side only** - No SSR issues with WebGL  
✅ **Accessibility** - Respects `prefers-reduced-motion`  
✅ **Performance optimized** - DPR capping, power preferences  
✅ **Non-intrusive** - Pointer events disabled on overlay  
✅ **Type-safe** - Full TypeScript support  
✅ **Zero manual setup** - Procedural noise texture generated automatically  

## Custom Textures

To use a custom noise/mask texture:

1. Place your texture in `/public/textures/` (e.g., `komorebi-noise.png`)
2. Pass the path to the component:

```tsx
<KomorebiShader textureUrl="/textures/komorebi-noise.png" />
```

**Texture requirements:**
- Grayscale or RGB (shader uses first channel)
- Any reasonable size (128x128 to 512x512 recommended)
- PNG or JPG format

If the texture fails to load, the component automatically falls back to procedurally generated noise.

## Performance Notes

- **DPR**: Capped at 1.5x to balance quality and performance
- **AA**: Set to 1 sample (configurable in shader `#define AA 1`)
- **Power**: Uses `high-performance` preference for better GPU scheduling
- **Depth**: Disabled depth writes/testing (overlay doesn't need z-buffer)

## Troubleshooting

### Blank screen / not rendering
- Ensure dependencies are installed: `npm install three @react-three/fiber`
- Check browser console for WebGL errors
- Verify the component is imported with `dynamic(..., { ssr: false })`

### Performance issues
- Lower the `intensity` prop
- Reduce DPR in `KomorebiShader.tsx`: change `dpr={[1, 1.5]}` to `dpr={1}`
- Use a smaller texture or reduce raymarching iterations in shader

### Animation not respecting reduced motion
- The component automatically checks `prefers-reduced-motion`
- Test by enabling reduced motion in your OS accessibility settings

## About the Shader

This shader simulates **dappled light** (Japanese: 木漏れ日 "komorebi") - the beautiful effect when sunlight passes through tree leaves, creating dancing patterns of light and shadow on the ground.

The technique uses:
- Raymarching for 3D scene rendering
- Soft shadows with multiple samples
- Ambient occlusion for realistic shading
- A texture mask to simulate leaf shadows

Inspired by Claude Monet's "Garden Path" (1901) and the physics of pinhole lighting effects.

## Credits

Original ShaderToy shader: "Dappled Light"  
Primitives and techniques: Inigo Quilez (IQ)  
React/Next.js integration: Custom implementation

## License

Check your project's license. The shader techniques are based on public ShaderToy code.
