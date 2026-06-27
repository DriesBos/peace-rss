# Project Structure

## Top Level
- `docker-compose.yml` and `docker-compose.prod.yml`: services
- `ENV-TEMPLATE.md`: environment variables template
- `infra/`: Caddy reverse proxy config
- `frontend/`: Next.js app

## Frontend (Next.js)
- `frontend/src/app/`: App Router routes and API endpoints
- `frontend/src/app/page.tsx`: server reader hydration wrapper
- `frontend/src/app/ReaderApp.tsx`: client reader shell
- `frontend/src/app/_lib/`: route-level utilities and types
- `frontend/src/components/`: UI components, each in its own folder with a co-located `.module.sass`
- `frontend/src/hooks/`: shared hooks
- `frontend/src/lib/`: shared utilities, including reader server data, auth token lookup, and preferences normalization
- `frontend/src/styles/`: Sass variables and shared styles

## Infra
- `infra/proxy/Caddyfile.local`: local routing
