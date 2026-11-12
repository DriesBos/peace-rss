# AGENTS

Guidance for AI coding agents (Claude, Codex, etc.) working in this repo. Keep it short and current.

## Branches and releases

- Work on the local `preview` branch. Commit there and push to `origin/preview` (`git push origin preview`).
- Pushes to `preview` do not deploy.
- `main` is production. Every push to `main` deploys to the VPS (`.github/workflows/deploy.yml`).
- Only merge `preview` into `main` when the owner explicitly asks. Never push straight to `main`.
- There is no Netlify or Vercel. The VPS is the only deploy target.

## Running locally

- `pnpm dev` from the repo root: Postgres, Miniflux and RSS-Bridge in Docker, `next dev` on the host at `http://localhost:3000` with hot reload. See `docs/DEVELOPMENT.md`.
- `docker compose up -d --build` runs the full production build. Host edits do not hot-reload into that container; rebuild (`docker compose up -d --build frontend`) to see changes.
- Local env lives in `.env.local` (Better Auth secrets, optional Resend key), kept separate from production values. Never commit env files or secrets.
- `NEXT_PUBLIC_ENABLE_DEV_TOOLS=true` shows the Dev menu tab and `/dev` system pages outside development. Never set it in production.

## Code conventions

- Frontend: Next.js App Router in `frontend/`, pnpm, Node 24.
- Each component lives in its own folder in `frontend/src/components/` with a co-located `.module.sass`. Shared variables are in `frontend/src/styles/vars.sass`.
- API routes in `frontend/src/app/api/` proxy Miniflux. Auth is self-hosted Better Auth (`frontend/src/lib/auth.ts`); routes get the user's Miniflux token through `requireMinifluxToken()`.
- Run `pnpm lint` in `frontend/` before finishing.

## Docs

- Start at `docs/README.md` (stack, architecture, structure, development, deployment, app behavior).
- Update the relevant doc in `docs/` when you change behavior, setup or deploys.
