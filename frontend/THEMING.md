# Theme System Documentation

## Overview

This app uses **next-themes** - the battle-tested theming library for Next.js that provides:
- ✅ **Zero flickering** - theme is applied before first paint
- ✅ **Persistent across sessions** - stored in localStorage
- ✅ **Automatic script injection** - handles SSR/hydration seamlessly
- ✅ **5 beautiful themes** - light, dark, softlight, softdark, green
- ✅ **Type-safe** - full TypeScript support

## Architecture

### ThemeProvider
Wraps the entire app in `layout.tsx` and configures next-themes:
- Sets `data-theme` attribute on HTML element
- Stores preference in localStorage as `peace-rss-theme`
- Defaults to `light` theme
- Disables system preference detection (you can enable it if desired)

### ThemeSwitcher Component
Interactive dropdown that allows users to select themes:
- Uses `useTheme()` hook from next-themes
- Prevents hydration mismatch with proper mounting check
- Shows placeholder during SSR to avoid layout shift

## How It Works

### 1. Initial Page Load
```
next-themes injects script → Reads localStorage → Sets data-theme on <html> → Page renders with correct theme → Zero flicker!
```

### 2. Theme Change
```
User selects theme → setTheme() called → DOM updates instantly → localStorage updated → Persists across sessions
```

### 3. Under the Hood
next-themes automatically:
- Injects a tiny script in `<head>` that runs before React
- Reads from localStorage before first paint
- Sets the `data-theme` attribute on the `<html>` element
- Manages all state and persistence for you

## Available Themes

| Theme | Description |
|-------|-------------|
| `light` | Clean white background with dark text |
| `dark` | Dark background with light text |
| `softlight` | Warm beige tones |
| `softdark` | Muted gray tones |
| `green` | Nature-inspired dark green |

## Usage

### Using the Theme Switcher

The theme switcher is already added to your sidebar in `page.tsx`. To use it elsewhere:

```tsx
import { ThemeSwitcher } from '@/components/ThemeSwitcher';

// Inside your component:
<ThemeSwitcher />
```

### Programmatically Change Theme

You can change the theme programmatically using the `useTheme` hook:

```tsx
'use client';

import { useTheme } from 'next-themes';

export function MyComponent() {
  const { theme, setTheme } = useTheme();
  
  return (
    <button onClick={() => setTheme('dark')}>
      Switch to Dark Mode
    </button>
  );
}
```

### Available Theme Hook Methods

```tsx
const {
  theme,           // Current theme name
  setTheme,        // Function to change theme
  themes,          // Array of all available themes
  systemTheme,     // System preference (if enabled)
  resolvedTheme,   // Actual theme being used
} = useTheme();
```

### Using Theme Colors in Your Styles

All theme colors are available as CSS custom properties defined on `:root`:

```sass
.myComponent
  background: var(--color-app)
  color: var(--color-text)
  border: 1px solid var(--color-text-secondary)
```

Available CSS variables:
- `--color-app` - Primary background color
- `--color-app-secondary` - Secondary background color
- `--color-text` - Primary text color
- `--color-text-secondary` - Secondary/muted text color

### Adding a New Theme

1. **Open `/frontend/src/styles/vars.sass`**

Add a new theme block:

```sass
:root
  &[data-theme="mytheme"]
    --color-app: #yourcolor
    --color-app-secondary: #yourcolor
    --color-text: #yourcolor
    --color-text-secondary: #yourcolor
```

2. **Update `/frontend/src/app/layout.tsx`**

Add your theme to the `themes` array in the ThemeProvider:

```tsx
<ThemeProvider
  themes={['light', 'dark', 'softlight', 'softdark', 'green', 'mytheme']}
  // ... other props
>
```

3. **Update `/frontend/src/components/ThemeSwitcher.tsx`**

Add theme to constants:

```typescript
const THEMES = ['light', 'dark', 'softlight', 'softdark', 'green', 'mytheme'] as const;

const THEME_LABELS: Record<string, string> = {
  // ... existing themes
  mytheme: 'My Theme',
};
```

## Configuration

### ThemeProvider Props (in layout.tsx)

```tsx
<ThemeProvider
  attribute="data-theme"           // HTML attribute to set
  defaultTheme="light"             // Default if no saved preference
  themes={['light', 'dark', ...]}  // Available themes
  enableSystem={false}             // Use system preference?
  storageKey="peace-rss-theme"     // localStorage key
>
```

### Enable System Preference Detection

If you want to respect the user's system dark/light mode preference:

```tsx
<ThemeProvider
  enableSystem={true}              // Enable system detection
  defaultTheme="system"            // Default to system preference
  // ... other props
>
```

Then users can select "System" in the theme switcher to follow their OS preference.

## Technical Details

### Preventing Hydration Warnings
- Added `suppressHydrationWarning` to `<html>` tag
- ThemeSwitcher shows placeholder until client-side mounted
- Prevents React hydration mismatch errors

### Storage
- **Key**: `peace-rss-theme`
- **Location**: localStorage
- **Persistence**: Permanent (until user clears browser data)
- **Scope**: Per domain

### Script Injection
next-themes automatically injects this script in `<head>`:
```html
<script>
  // Simplified version - next-themes handles this
  const theme = localStorage.getItem('peace-rss-theme') || 'light';
  document.documentElement.setAttribute('data-theme', theme);
</script>
```

This runs **before** React hydration, preventing any flicker.

## Files Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── ThemeProvider.tsx         # next-themes wrapper
│   │   ├── ThemeSwitcher.tsx         # Theme selector UI
│   │   └── ThemeSwitcher.module.sass # Styles
│   ├── styles/
│   │   └── vars.sass                 # Theme definitions
│   └── app/
│       ├── layout.tsx                # ThemeProvider setup
│       └── page.tsx                  # ThemeSwitcher usage
└── package.json                      # next-themes dependency
```

## Why next-themes?

### Advantages
✅ **Battle-tested** - Used by thousands of projects
✅ **Zero config** - Works out of the box
✅ **No flicker** - Automatic script injection
✅ **TypeScript** - Full type support
✅ **Framework agnostic** - Works with any React framework
✅ **Small bundle** - ~1KB minified + gzipped
✅ **Actively maintained** - Regular updates and fixes

### Comparison with Alternatives

| Feature | next-themes | Custom Cookie | Inline Script |
|---------|-------------|---------------|---------------|
| Zero flicker | ✅ | ✅ | ✅ |
| Easy setup | ✅ | ❌ | ❌ |
| Maintenance | ✅ | ❌ | ❌ |
| Type safety | ✅ | ⚠️ | ❌ |
| Bundle size | 1KB | 0KB | 0KB |
| System detection | ✅ | ❌ | ❌ |

## Troubleshooting

### Theme not persisting
- Check browser localStorage (DevTools → Application → Local Storage)
- Verify key is `peace-rss-theme`
- Ensure localStorage is not disabled in browser

### Flickering on page load
- Verify `suppressHydrationWarning` is on `<html>` tag
- Check that next-themes script is in the `<head>`
- Clear cache and hard reload

### Theme not changing
- Check browser console for errors
- Verify theme name matches exactly (case-sensitive)
- Ensure theme is defined in vars.sass

### Hydration Warnings
- Ensure ThemeSwitcher uses the mounting check
- Don't render theme-dependent content during SSR
- Use `suppressHydrationWarning` on `<html>`

## Resources

- [next-themes Documentation](https://github.com/pacocoursey/next-themes)
- [Next.js App Router Docs](https://nextjs.org/docs/app)
- [CSS Custom Properties](https://developer.mozilla.org/en-US/docs/Web/CSS/--*)

