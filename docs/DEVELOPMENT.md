# Development

## Environment
- Copy `ENV-TEMPLATE.md` to `.env` and fill values.
- Required variables include Clerk keys, Miniflux config, and Postgres credentials.

## Docker (Recommended)
```bash
docker compose up -d --build
```

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

## Styling Convention
- Keep component styles in a co-located `.module.sass` next to each component.
