# AGENTS

Guidance for AI coding agents (Claude, Codex, etc.) working in this repo. Keep it short and current.

## Branches and releases

- `preview` is the working branch. Branch off it, and open PRs into it.
- `main` is production. Every push to `main` deploys to the VPS (`.github/workflows/deploy.yml`), so only merge `preview` into `main` to release.
- Never push straight to `main`, and never merge into it without the owner asking.
- There is no Netlify or Vercel. The VPS is the only deploy target.

## Running locally

- The app runs through Docker Compose (`docker compose up -d --build`). The `frontend` service is a production Next.js build.
- Host-side edits do not hot-reload into the container. Rebuild (`docker compose up -d --build frontend`) to see changes.
- Local env lives in `.env.local` (Clerk dev keys), kept separate from production values. Never commit env files or secrets.
- `NEXT_PUBLIC_ENABLE_DEV_TOOLS=true` shows the Dev menu tab and `/dev` system pages. Never set it in production.

## Code conventions

- Frontend: Next.js App Router in `frontend/`, pnpm, Node 24.
- Each component lives in its own folder in `frontend/src/components/` with a co-located `.module.sass`. Shared variables are in `frontend/src/styles/vars.sass`.
- API routes in `frontend/src/app/api/` proxy Miniflux. Auth is Clerk.
- Run `pnpm lint` in `frontend/` before finishing.

## Docs

- Start at `docs/README.md` (stack, architecture, structure, development, deployment, app behavior).
- Update the relevant doc in `docs/` when you change behavior, setup or deploys.
