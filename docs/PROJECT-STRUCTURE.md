# Project Structure

## Top Level
- `docker-compose.yml` and `docker-compose.prod.yml`: services
- `ENV-TEMPLATE.md`: environment variables template
- `infra/`: Caddy reverse proxy config
- `frontend/`: Next.js app

## Frontend (Next.js)
- `frontend/src/app/`: App Router routes, API endpoints, and page UI
- `frontend/src/app/_components/`: route-level UI components extracted from `page.tsx`
- `frontend/src/app/_lib/`: route-level utilities and types
- `frontend/src/components/`: shared UI components (buttons, modals, icons, etc.)
- `frontend/src/hooks/`: shared hooks
- `frontend/src/lib/`: shared utilities
- `frontend/src/styles/`: Sass variables and shared styles

## Infra
- `infra/proxy/Caddyfile.local`: local routing
