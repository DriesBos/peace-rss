# Development

## Branches
- Work on the local `preview` branch and push to `origin/preview`.
- `main` is release only (every push deploys). Merge `preview` into `main` only when the owner explicitly asks. See `docs/DEPLOYMENT.md`.

## Environment
- Copy `ENV-TEMPLATE.md` to `.env` and fill values.
- Required variables include Better Auth secrets, a Resend key (optional locally), Miniflux config, and Postgres credentials.

## Quick Start (hot reload)
From the repo root:
```bash
pnpm dev
```
This starts `postgres`, `miniflux` and `rss-bridge` in Docker (via
`docker-compose.dev.yml`), then runs `next dev` on the host at
`http://localhost:3000` with hot reload. The script swaps the Docker hostnames in
`.env` for host URLs, so no extra env file is needed.

- `pnpm dev:https`: same, but `https://localhost:3000` with a self-signed cert
  (browsers warn). Social feeds won't load in this mode: Miniflux fetches them
  back from the host (`host.docker.internal:3000`) over plain HTTP.
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

## Local Reading Data

The local Miniflux/Postgres services use their own Docker volume. Auth uses a
separate `komorebi_auth` database on the same local Postgres, so logging in with
the same email address as production creates a separate development account.
Without `RESEND_API_KEY`, verification and password-reset links are printed to
the Next.js log instead of emailed.

To copy subscriptions into local development:

1. While signed in to the live site, download your subscriptions from
   `https://komorebi-reader.com/api/opml/export`.
2. Open `http://localhost/`, sign in, and open the menu's **Settings** tab.
3. Under **Subscriptions**, choose the exported `.opml` file and click
   **Import OPML**. Files can be up to 5 MB.
4. Refresh feeds to check for articles after the import finishes.

This imports feed subscriptions and categories. Saved articles and reading
history remain in the source reader. Importing only changes the local reader.
You can also download subscriptions with **Export OPML** in the same settings.

## Styling Convention
- Keep component styles in a co-located `.module.sass` next to each component.
- Use `frontend/src/styles/vars.sass` as the guide for shared spacing, colors, and typography variables when implementing styling.
