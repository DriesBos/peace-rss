# Stack Overview

## Core
- Next.js 16 (App Router)
- React 19
- TypeScript 5
- Sass modules (one `.module.sass` per component)

## Auth
- Clerk (frontend + server-side keys)

## Backend Services
- Miniflux (RSS engine and API)
- Postgres (Miniflux storage)

## Infra
- Docker Compose for local orchestration
- Caddy reverse proxy (routes `/` to frontend, `/miniflux/` to Miniflux)

## UX / Extras
- Serwist for PWA/service worker
- React Intersection Observer + IntersectionImage for lazy entry rendering
- React Three Fiber + Three for the background shader
