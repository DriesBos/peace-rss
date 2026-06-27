# Architecture

## High-Level Flow
1. Browser requests `http://localhost/`.
2. Caddy routes `/` to the Next.js frontend and `/miniflux/` to Miniflux.
3. `frontend/src/app/page.tsx` fetches initial reader data on the server and hydrates TanStack Query.
4. `ReaderApp` hydrates as the client reader shell.
5. Next.js API routes proxy and manage Miniflux data.
6. Miniflux reads/writes feeds in Postgres.

## Auth Flow
- Clerk handles user auth in the frontend.
- Server code resolves the Clerk user to a Miniflux token with `frontend/src/lib/minifluxAuth.ts`.
- Already-provisioned users skip `/api/bootstrap`; unprovisioned users still bootstrap once.

## Reader Startup
- `page.tsx` is a Server Component that seeds feeds, categories, counts, preferences, and the first unread entries page.
- Seeded entries reuse `withEntryListMeta`, so previews/thumbnails match `/api/entries`.
- `ReaderApp` remains a Client Component because it reads `useSearchParams`; the win is a hydrated cache, not server-painted entries.

## Key Runtime Pieces
- Next.js App Router UI and API routes live in `frontend/src/app`.
- UI components live in `frontend/src/components` with co-located `.module.sass` styles.
- Reader preferences normalization lives in `frontend/src/lib/readerPrefs.ts`.
- Initial reader data loading lives in `frontend/src/lib/readerServer.ts`.
- Miniflux runs as a separate container in Docker Compose.
- Postgres is used only by Miniflux.
