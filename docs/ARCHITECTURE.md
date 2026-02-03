# Architecture

## High-Level Flow
1. Browser requests `http://localhost/`.
2. Caddy routes `/` to the Next.js frontend and `/miniflux/` to Miniflux.
3. Next.js API routes proxy and manage Miniflux data.
4. Miniflux reads/writes feeds in Postgres.

## Auth Flow
- Clerk handles user auth in the frontend.
- API routes use Clerk session data plus Miniflux tokens/credentials to access Miniflux.

## Key Runtime Pieces
- Next.js App Router UI and API routes live in `frontend/src/app`.
- UI components live in `frontend/src/components` with co-located `.module.sass` styles.
- Miniflux runs as a separate container in Docker Compose.
- Postgres is used only by Miniflux.
- Service worker (Serwist) provides offline/PWA behavior.
