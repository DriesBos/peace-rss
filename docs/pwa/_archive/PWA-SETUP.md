# Progressive Web App (PWA) Setup Guide

## Overview
Peace RSS is now configured as a Progressive Web App with `standalone` display mode, allowing it to be installed on devices and run like a native application.

## Current Configuration

### ✅ Implemented Features

1. **Web App Manifest** (`/public/manifest.json`)
   - Display mode: `standalone` - App runs without browser UI
   - Orientation: `portrait-primary`
   - Theme colors configured for light/dark modes
   - App shortcuts for quick access to Unread and Bookmarks

2. **iOS-Specific Meta Tags** (in `layout.tsx`)
   - `apple-mobile-web-app-capable`: Enables standalone mode on iOS
   - `apple-mobile-web-app-status-bar-style`: Controls status bar appearance
   - `viewport-fit=cover`: Ensures proper display on iPhone X+ notch/island
   - Prevents automatic phone number detection

3. **Responsive Viewport**
   - Mobile-optimized viewport settings
   - Prevents user scaling (app-like behavior)

## 🎨 Required: Icon Assets

You need to create the following icon files and place them in `/frontend/public/`:

### Required Sizes:
- **`icon-192x192.png`** - Standard PWA icon (192×192px)
- **`icon-512x512.png`** - Large PWA icon (512×512px)
- **`apple-touch-icon.png`** - iOS home screen icon (180×180px)

### Optional but Recommended:
- **`icon-152x152.png`** - iPad icon
- **`icon-167x167.png`** - iPad Pro icon
- **`favicon.ico`** - Browser tab icon (already exists)

### Icon Design Guidelines:
- Use PNG format with transparency
- Design should work on both light and dark backgrounds
- Avoid text that's too small (illegible at small sizes)
- iOS automatically adds rounded corners and shadow effects
- Consider using your app's primary brand color

### Quick Icon Generation Tools:
- [PWA Asset Generator](https://www.npmjs.com/package/pwa-asset-generator): `npx pwa-asset-generator logo.svg public --favicon`
- [RealFaviconGenerator](https://realfavicongenerator.net/)
- [PWA Builder](https://www.pwabuilder.com/imageGenerator)

## 🚀 Testing Your PWA

### Desktop (Chrome/Edge):
1. Open your app in browser
2. Look for install icon in address bar (⊕ or 🖥️)
3. Click "Install Peace RSS"
4. App opens in standalone window

### Mobile (iOS):
1. Open in Safari
2. Tap Share button (□↑)
3. Scroll down and tap "Add to Home Screen"
4. App icon appears on home screen

### Mobile (Android):
1. Open in Chrome
2. Tap menu (⋮)
3. Tap "Install app" or "Add to Home Screen"
4. App installs like native app

## 📱 Current PWA Features

### Display Mode: `standalone`
- ✅ No browser address bar
- ✅ No browser navigation buttons
- ✅ Runs in its own window
- ✅ Appears in task switcher as separate app
- ✅ Custom splash screen on launch

### App Shortcuts
Two quick actions are available when right-clicking/long-pressing the app icon:
1. **Unread Articles** - Jump directly to unread items
2. **Bookmarks** - Quick access to bookmarked articles

## 🔄 Optional Enhancements

### 1. Service Worker (Offline Support)
Enable users to read cached articles without internet connection.

**Implementation:**
```typescript
// public/sw.js
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('peace-rss-v1').then((cache) => {
      return cache.addAll([
        '/',
        '/manifest.json',
        // Add other critical assets
      ]);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
```

Register in `layout.tsx`:
```typescript
useEffect(() => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
  }
}, []);
```

### 2. Push Notifications
Notify users when new articles arrive from their feeds.

**Requirements:**
- HTTPS (already configured)
- User permission
- Backend push service integration

### 3. Background Sync
Update feeds even when app is closed.

### 4. Share Target API
Allow users to share articles TO your app from other apps.

**Add to manifest.json:**
```json
"share_target": {
  "action": "/share",
  "method": "GET",
  "params": {
    "title": "title",
    "text": "text",
    "url": "url"
  }
}
```

### 5. Screenshots
Add promotional screenshots to manifest for app stores:
```json
"screenshots": [
  {
    "src": "/screenshot1.png",
    "sizes": "1280x720",
    "type": "image/png"
  }
]
```

## 🎨 Theme Customization

### Changing Theme Colors
Edit `manifest.json`:
```json
{
  "theme_color": "#your-color",
  "background_color": "#your-background"
}
```

Also update in `layout.tsx` metadata:
```typescript
themeColor: [
  { media: '(prefers-color-scheme: light)', color: '#your-light-color' },
  { media: '(prefers-color-scheme: dark)', color: '#your-dark-color' },
]
```

### Status Bar Styles (iOS)
Options in `layout.tsx`:
- `default` - Black text (for light backgrounds)
- `black` - Black text
- `black-translucent` - White text, translucent background

## 📊 PWA Audit

Test your PWA with Lighthouse:
1. Open Chrome DevTools (F12)
2. Go to "Lighthouse" tab
3. Select "Progressive Web App"
4. Click "Generate report"

**Target Scores:**
- ✅ Installable
- ✅ PWA-optimized
- ✅ Offline support (after service worker)

## 🔗 Resources

- [MDN: PWA Display Modes](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/display)
- [Apple: Configuring Web Applications](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html)
- [Web.dev: PWA Checklist](https://web.dev/pwa-checklist/)
- [PWA Builder](https://www.pwabuilder.com/)

## 🐛 Troubleshooting

### App won't install
- Ensure HTTPS is enabled
- Check manifest.json is valid (use [Manifest Validator](https://manifest-validator.appspot.com/))
- Verify all required icons exist

### Icons not showing
- Clear browser cache
- Check icon paths in manifest.json
- Verify PNG files are not corrupted

### iOS-specific issues
- Icons must be PNG (not SVG)
- Safari requires `apple-touch-icon.png` in public folder
- Clear Safari cache and website data

