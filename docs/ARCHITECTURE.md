# Architecture

## High-Level Flow
1. Browser requests `http://localhost/`.
2. Caddy routes `/` to the Next.js frontend and `/miniflux/` to Miniflux.
3. Next.js API routes proxy and manage Miniflux data.
4. Miniflux reads/writes feeds in Postgres.

## Auth Flow
- Better Auth runs inside the Next.js app (`/api/auth/*`, config in `frontend/src/lib/auth.ts`) with its tables in a separate `komorebi_auth` database on the same Postgres. The app creates the database and tables on startup (`instrumentation.ts`).
- Sessions last 90 days and slide forward with use.
- API routes call `requireMinifluxToken()` (`frontend/src/lib/minifluxAuth.ts`), which reads the session and the user's encrypted Miniflux token from the `miniflux_account` table.

## Key Runtime Pieces
- Next.js App Router UI and API routes live in `frontend/src/app`.
- UI components live in `frontend/src/components` with co-located `.module.sass` styles.
- Miniflux runs as a separate container in Docker Compose.
- Postgres is used only by Miniflux.
- Service worker (Serwist) provides offline/PWA behavior.
