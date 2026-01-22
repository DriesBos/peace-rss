# Komorebi Shader - Quick Integration Guide

## ✅ Installation Complete

The following has been set up in your project:

### Files Created
- `src/components/KomorebiShader.tsx` - Core WebGL shader component
- `src/components/HeroKomorebi.tsx` - Hero section wrapper
- `src/app/example-komorebi-page.tsx` - Usage examples
- `KOMOREBI_SHADER_README.md` - Full documentation

### Dependencies Installed
```json
{
  "@react-three/fiber": "^9.5.0",
  "three": "^0.182.0",
  "@types/three": "^0.182.0"
}
```

---

## 🚀 Quick Start

### Method 1: Use HeroKomorebi (Easiest)

Add this to any page component:

```tsx
import HeroKomorebi from "@/components/HeroKomorebi";

export default function HomePage() {
  return (
    <HeroKomorebi intensity={0.6} speed={0.5} className="min-h-screen">
      <div className="container mx-auto px-4 py-20">
        <h1 className="text-6xl font-bold">Welcome</h1>
        <p className="text-xl mt-4">Beautiful dappled light effect</p>
      </div>
    </HeroKomorebi>
  );
}
```

### Method 2: Import with Dynamic Loading

For more control, use Next.js dynamic imports:

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
      <div className="relative z-10">
        {/* Your content */}
      </div>
    </div>
  );
}
```

---

## 🎛️ Props Reference

### KomorebiShader Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | `""` | CSS class for wrapper |
| `intensity` | `number` | `1.0` | Opacity/brightness (0-1) |
| `speed` | `number` | `1.0` | Animation speed multiplier |
| `textureUrl` | `string` | auto-generated | Path to custom noise texture |

### HeroKomorebi Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | required | Content over shader |
| `intensity` | `number` | `0.5` | Opacity/brightness (0-1) |
| `speed` | `number` | `0.5` | Animation speed multiplier |
| `textureUrl` | `string` | auto-generated | Path to custom noise texture |
| `className` | `string` | `""` | CSS class for section |

---

## 🎨 Customization Examples

### Subtle Background Effect
```tsx
<HeroKomorebi intensity={0.3} speed={0.3}>
  {/* Low intensity for subtle effect */}
</HeroKomorebi>
```

### Dramatic Animation
```tsx
<HeroKomorebi intensity={0.9} speed={1.5}>
  {/* High intensity and faster animation */}
</HeroKomorebi>
```

### Frozen/Static
```tsx
<HeroKomorebi intensity={0.5} speed={0}>
  {/* speed={0} freezes the animation */}
</HeroKomorebi>
```

### Custom Texture
```tsx
<HeroKomorebi
  intensity={0.6}
  speed={0.5}
  textureUrl="/textures/my-custom-noise.png"
>
  {/* Use your own shadow/mask texture */}
</HeroKomorebi>
```

---

## 🔧 Advanced Usage

### Create Custom Wrapper

```tsx
"use client";

import dynamic from "next/dynamic";
import { ReactNode } from "react";

const KomorebiShader = dynamic(() => import("@/components/KomorebiShader"), {
  ssr: false,
});

interface CustomBackgroundProps {
  children: ReactNode;
  variant?: "subtle" | "normal" | "dramatic";
}

export default function CustomBackground({
  children,
  variant = "normal",
}: CustomBackgroundProps) {
  const config = {
    subtle: { intensity: 0.3, speed: 0.3 },
    normal: { intensity: 0.5, speed: 0.5 },
    dramatic: { intensity: 0.9, speed: 1.2 },
  };

  const { intensity, speed } = config[variant];

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 pointer-events-none">
        <KomorebiShader intensity={intensity} speed={speed} />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}
```

### Responsive Intensity

```tsx
"use client";

import { useState, useEffect } from "react";
import HeroKomorebi from "@/components/HeroKomorebi";

export default function ResponsiveHero() {
  const [intensity, setIntensity] = useState(0.5);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    setIntensity(mediaQuery.matches ? 0.3 : 0.6);

    const handler = (e: MediaQueryListEvent) => {
      setIntensity(e.matches ? 0.3 : 0.6);
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  return (
    <HeroKomorebi intensity={intensity} speed={0.5}>
      {/* Lower intensity on mobile */}
    </HeroKomorebi>
  );
}
```

---

## ♿ Accessibility

The shader automatically respects `prefers-reduced-motion`:

- When enabled: animation freezes (`speed` becomes 0)
- Pointer events are disabled on shader overlay (no scroll blocking)
- Still renders beautifully as a static background

Test by enabling reduced motion in your OS accessibility settings.

---

## 🐛 Troubleshooting

### "Three not found" or blank screen
```bash
npm install three @react-three/fiber
```

### TypeScript errors
```bash
npm install -D @types/three
```

### SSR errors (window is not defined)
Make sure to use dynamic import:
```tsx
const KomorebiShader = dynamic(() => import("@/components/KomorebiShader"), {
  ssr: false, // This is required!
});
```

### Performance issues on mobile
- Lower the intensity: `intensity={0.3}`
- Reduce DPR in `KomorebiShader.tsx`: change `dpr={[1, 1.5]}` to `dpr={1}`
- Consider disabling on mobile devices entirely

### Shader blocks scrolling
Ensure `pointer-events: none` is set on the shader wrapper:
```tsx
<div className="absolute inset-0" style={{ pointerEvents: "none" }}>
  <KomorebiShader />
</div>
```

---

## 📚 Additional Resources

- Full documentation: `KOMOREBI_SHADER_README.md`
- Usage examples: `src/app/example-komorebi-page.tsx`
- React Three Fiber docs: https://docs.pmnd.rs/react-three-fiber
- ShaderToy (original): https://www.shadertoy.com

---

## 🎯 Next Steps

1. **Test the example page** (copy from `example-komorebi-page.tsx`)
2. **Integrate into your landing page** using `HeroKomorebi`
3. **Adjust intensity and speed** to match your design
4. **Consider custom textures** for unique effects
5. **Test on mobile** and adjust performance if needed

Happy coding! ✨
