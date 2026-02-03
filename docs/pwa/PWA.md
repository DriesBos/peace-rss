# PWA Guide

## Status
This app is already configured as a PWA with a manifest, iOS meta tags, and a service worker built by Serwist.

## Key Files
- `frontend/public/manifest.json`
- `frontend/src/app/layout.tsx`
- `frontend/src/app/sw.ts`
- `frontend/next.config.ts`

## Required Icons
Place these in `frontend/public/`:
- `icon-192x192.png`
- `icon-512x512.png`
- `apple-touch-icon.png`

## Build And Install Test
1. Create icons in `frontend/public/`.
2. Build production so the service worker is generated.
3. Run the app and open it in a browser.
4. Install from the browser UI or add to home screen.

## Notes
- Service worker output is `frontend/public/sw.js`.
- Serwist is disabled in development builds.
- HTTPS is required for installability, with localhost as an exception.

## Optional Enhancements
- Offline-first caching for entries
- Install prompt UI
- App shortcuts additions
- Push notifications
- Share target integration
- App icon badge for unread count

## Quick Troubleshooting
- Verify `manifest.json` loads without errors.
- Confirm icons exist and paths match the manifest.
- Clear browser cache after icon updates.
- Use Lighthouse PWA audit for installability checks.

## Legacy Docs
Longer PWA notes are archived in `docs/pwa/_archive` if you want the full history.
