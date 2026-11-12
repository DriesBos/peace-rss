# Development

## Environment
- Copy `ENV-TEMPLATE.md` to `.env` and fill values.
- Required variables include Clerk keys, Miniflux config, and Postgres credentials.

## Quick Start (hot reload)
From the repo root:
```bash
pnpm dev
```
This starts `postgres`, `miniflux` and `rss-bridge` in Docker (via
`docker-compose.dev.yml`), then runs `next dev` on the host at
`https://localhost:3000` with hot reload. The script swaps the Docker hostnames in
`.env` for host URLs, so no extra env file is needed.

- `pnpm dev:http`: same, but plain `http://localhost:3000`. Use it when testing
  social feeds: Miniflux fetches them back from the host
  (`host.docker.internal:3000`) and rejects the self-signed HTTPS cert.
- `pnpm dev:services`: start only the Docker services.
- `pnpm dev:down`: stop the Docker services (data stays in the volume).
- `pnpm dev:logs`: tail service logs.
- Miniflux UI: `http://localhost:8080/miniflux/`

Requires Docker (OrbStack) running and a root `.env` (symlink to `.env.local`).
Port 3000 must be free (the script stops if it isn't).
Services keep running after you stop Next.js, so the next `pnpm dev` is quick.

## Docker (full stack, production build)
```bash
docker compose up -d --build
```

Note: the `frontend` service in `docker-compose.yml` runs a production Next.js build (`pnpm build` during image build, then the standalone Next.js server). That means code/style edits on your host will **not** hot-reload into the running container; you must rebuild the image to see changes.

Stop services:
```bash
docker compose down
```

Tail logs:
```bash
docker compose logs -f frontend
```

## Local URLs
- App: `http://localhost/`
- Miniflux: `http://localhost/miniflux/`

## Common Tasks
- Rebuild frontend only:
```bash
docker compose build frontend
```
- Restart frontend:
```bash
docker compose up -d frontend
```
- Rebuild + restart frontend (after edits):
```bash
docker compose up -d --build frontend
```

## Styling Convention
- Keep component styles in a co-located `.module.sass` next to each component.
- Use `frontend/src/styles/vars.sass` as the guide for shared spacing, colors, and typography variables when implementing styling.
