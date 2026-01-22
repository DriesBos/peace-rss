# Komorebi Shader - Quick Reference

## 🚀 Quick Start (Copy & Paste)

```tsx
import HeroKomorebi from "@/components/HeroKomorebi";

export default function Page() {
  return (
    <HeroKomorebi 
      className="min-h-screen bg-gradient-to-br from-amber-50 to-green-50"
    >
      <div className="container mx-auto px-4 py-20">
        <h1 className="text-6xl font-bold text-gray-900">
          Your Title
        </h1>
        <p className="text-xl text-gray-700">
          Your subtitle
        </p>
      </div>
    </HeroKomorebi>
  );
}
```

---

## 🎛️ Props Reference

```tsx
<HeroKomorebi
  intensity={0.3}   // Shadow darkness (0-1, default: 0.3)
  speed={0.2}       // Animation speed (0-1, default: 0.2)
  scale1={2.5}      // Large cluster size (default: 2.5)
  scale2={4.0}      // Fine detail size (default: 4.0)
  softness={0.5}    // Edge softness (0-1, default: 0.5)
  textureUrl="/path" // Custom texture (optional)
  className="..."   // CSS classes
>
  {children}
</HeroKomorebi>
```

---

## 🎨 Presets

### Very Subtle
```tsx
<HeroKomorebi intensity={0.2} speed={0.1} softness={0.7} />
```

### Balanced (Default)
```tsx
<HeroKomorebi intensity={0.3} speed={0.2} />
```

### Visible
```tsx
<HeroKomorebi intensity={0.5} speed={0.3} softness={0.4} />
```

### Dramatic
```tsx
<HeroKomorebi intensity={0.7} speed={0.4} scale1={3.0} />
```

### Static (No Animation)
```tsx
<HeroKomorebi intensity={0.4} speed={0} />
```

### Large Shadows
```tsx
<HeroKomorebi scale1={1.5} scale2={2.5} />
```

### Fine Detail
```tsx
<HeroKomorebi scale1={4.0} scale2={6.0} />
```

---

## 🎨 Background Colors

**Recommended gradients:**

```tsx
// Warm sunny
className="bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50"

// Fresh garden
className="bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50"

// Clear sky
className="bg-gradient-to-br from-blue-50 via-cyan-50 to-sky-50"

// Soft neutral
className="bg-gradient-to-br from-gray-50 via-slate-50 to-zinc-50"

// Sunset
className="bg-gradient-to-br from-rose-50 via-orange-50 to-amber-50"
```

**Solid colors:**
```tsx
className="bg-amber-50"    // Warm white
className="bg-green-50"    // Light green
className="bg-blue-50"     // Light blue
className="bg-gray-50"     // Soft gray
className="bg-white"       // Pure white
```

---

## 📐 Parameter Guide

### Intensity (Shadow Darkness)

| Value | Effect | Use Case |
|-------|--------|----------|
| 0.1-0.2 | Very subtle | Professional sites, minimal distraction |
| 0.3-0.4 | Balanced | **Recommended** - Landing pages |
| 0.5-0.6 | Pronounced | Creative sites, visual emphasis |
| 0.7+ | Dramatic | Artistic sites, bold statements |

### Speed (Animation)

| Value | Effect | Use Case |
|-------|--------|----------|
| 0 | Static | No motion, frozen pattern |
| 0.1-0.2 | Very slow | **Recommended** - Natural, subtle |
| 0.3-0.5 | Medium | Noticeable but not distracting |
| 0.6+ | Fast | Eye-catching, dynamic |

### Scale1 (Large Clusters)

| Value | Effect | Pattern |
|-------|--------|---------|
| 1.0-2.0 | Very large | Big shadow patches |
| 2.5 | **Default** | Balanced clusters |
| 3.0-4.0 | Smaller | More frequent shadows |
| 5.0+ | Very fine | Busy, detailed |

### Scale2 (Fine Detail)

| Value | Effect | Pattern |
|-------|--------|---------|
| 2.0-3.0 | Large | Broad details |
| 4.0 | **Default** | Balanced details |
| 5.0-6.0 | Fine | Rich texture |
| 7.0+ | Very fine | Very busy |

### Softness (Edge Quality)

| Value | Effect | Look |
|-------|--------|------|
| 0.2-0.3 | Sharp | Crisp, defined edges |
| 0.5 | **Default** | Natural, soft |
| 0.7-0.8 | Very soft | Diffused, dreamy |
| 1.0 | Maximum | Very blurred |

---

## ⚡ Performance Tips

### Good Performance ✅
```tsx
<HeroKomorebi intensity={0.3} speed={0.2} />
```

### Mobile-Optimized ✅
```tsx
<HeroKomorebi intensity={0.2} speed={0.1} />
```

### Desktop Only
```tsx
{!isMobile && <HeroKomorebi intensity={0.5} speed={0.3} />}
```

---

## 🎯 Common Patterns

### Hero Section
```tsx
<HeroKomorebi 
  intensity={0.4} 
  speed={0.2}
  className="min-h-screen bg-gradient-to-br from-amber-50 to-green-50"
>
  <header className="container mx-auto px-4 py-20">
    <h1>Welcome</h1>
    <button>Get Started</button>
  </header>
</HeroKomorebi>
```

### Full Page Background
```tsx
<div className="relative min-h-screen">
  <div className="fixed inset-0 bg-amber-50 pointer-events-none">
    <KomorebiShader intensity={0.3} speed={0.2} />
  </div>
  <div className="relative z-10">
    {/* Your content */}
  </div>
</div>
```

### Card/Section Background
```tsx
<div className="relative rounded-lg overflow-hidden bg-white">
  <div className="absolute inset-0 pointer-events-none">
    <KomorebiShader intensity={0.2} speed={0.1} />
  </div>
  <div className="relative z-10 p-6">
    <h3>Card Title</h3>
  </div>
</div>
```

---

## 🐛 Troubleshooting

### Shader not visible?
- ✅ Check background color (must be light)
- ✅ Increase intensity
- ✅ Check browser console for errors

### Animation too fast?
- ✅ Lower speed to 0.1-0.2

### Pattern too busy?
- ✅ Lower scale1 and scale2
- ✅ Increase softness

### Shadows too dark?
- ✅ Lower intensity to 0.2-0.3

### Performance issues?
- ✅ Lower intensity
- ✅ Reduce speed
- ✅ Test on target devices

---

## 📱 Responsive Example

```tsx
"use client";

import { useState, useEffect } from "react";
import HeroKomorebi from "@/components/HeroKomorebi";

export default function ResponsivePage() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <HeroKomorebi
      intensity={isMobile ? 0.2 : 0.4}
      speed={isMobile ? 0.1 : 0.2}
      className="min-h-screen bg-amber-50"
    >
      {/* Content */}
    </HeroKomorebi>
  );
}
```

---

## 📚 Documentation

- **Quick Start**: This file
- **Full Guide**: `README_SHADER_INTEGRATION.md`
- **Migration**: `SHADER_REFACTOR_NOTES.md`
- **Examples**: `example-komorebi-page.tsx`
- **Test Page**: Navigate to `/shader-test`

---

## ✅ Checklist

Before deploying:

- [ ] Background is light colored
- [ ] Text is dark colored
- [ ] Intensity is appropriate (0.2-0.5)
- [ ] Speed feels natural (0.1-0.3)
- [ ] Pattern size looks good
- [ ] Test on mobile
- [ ] Test with reduced motion enabled
- [ ] No console errors
- [ ] Scrolling works (not blocked)
- [ ] Performance is acceptable

---

## 🆘 Need Help?

1. Check `/shader-test` page
2. Read `README_SHADER_INTEGRATION.md`
3. Review examples in `example-komorebi-page.tsx`
4. See migration guide in `SHADER_REFACTOR_NOTES.md`

---

**Built with React Three Fiber + Three.js**  
**Optimized for modern web browsers**  
**Production ready** ✨
