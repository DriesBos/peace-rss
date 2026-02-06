# Development

## Environment
- Copy `ENV-TEMPLATE.md` to `.env` and fill values.
- Required variables include Clerk keys, Miniflux config, and Postgres credentials.

## Docker (Recommended)
```bash
docker compose up -d --build
```

Note: the `frontend` service in `docker-compose.yml` runs a production Next.js build (`next build` during image build, then `next start`). That means code/style edits on your host will **not** hot-reload into the running container; you must rebuild the image to see changes.

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
