# Komorebi Reader

A minimalist RSS reader built on Miniflux, wrapped in a modern Next.js UI with Clerk auth.

## What This Repo Contains

- Next.js App Router frontend with API routes for Miniflux proxying
- UI components in `frontend/src/components`, each with a co-located `.module.sass`
- Miniflux + Postgres via Docker Compose
- Caddy reverse proxy for local routing

## Quickstart (Local)

1. Create a `.env` in the project root based on `ENV-TEMPLATE.md`.
2. Build and run services:

```bash
docker compose up -d --build
```

Note: the `frontend` container runs a production Next.js build, so edits to files (e.g. `.module.sass`) won’t show up until you rebuild (`--build`) and restart the `frontend` service.

3. Open the app:

- App: `http://localhost/`
- Miniflux: `http://localhost/miniflux/`

## Where To Look Next

- Tech stack overview: `docs/STACK.md`
- Architecture and data flow: `docs/ARCHITECTURE.md`
- Project layout guide: `docs/PROJECT-STRUCTURE.md`
- Development workflows: `docs/DEVELOPMENT.md`
