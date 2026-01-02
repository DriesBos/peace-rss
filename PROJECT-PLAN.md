# Peace RSS – Project Plan

## Goal

- Custom RSS reader for friends & family
- Open sign-up, minimal UI, max functionality
- Clean, modern, low-maintenance stack

## Stack

- Frontend: Next.js (App Router, TS)
- Styling: CSS Modules + Sass (minimal)
- Auth: Clerk (open signup)
- RSS backend: Miniflux v2
- Infra: Docker Compose, single AWS Lightsail VM

## Architecture

- Public: Next.js app only
- Private: Miniflux + Postgres (internal network)
- API flow: Browser → Next.js → Miniflux REST API
- User mapping: Clerk user ↔ Miniflux user + API key

## Auth & Users

- Clerk handles signup/login/reset
- Open signup + email verification
- First login → provision Miniflux user
- Store mapping + encrypted API key server-side

## Core Features (MVP)

- Auth: signup / login / logout
- Feeds: add feed, list feeds, categories, starred feeds
- Reading: unread, starred, history
- Actions: read/unread, star/unstar
- Entry view: full content + source link

## UI Principles

- Functionality > design
- Simple 3-column layout (sidebar / list / detail)
- Text buttons, no icon lib
- CSS only for layout, spacing, states

## API Surface (Next.js)

- /api/me (onboarding check)
- /api/categories (list/create)
- /api/feeds (list/create)
- /api/entries (list/filter/search)
- /api/entries/:id (detail/actions)
- Normalize errors from Miniflux

## Data & Secrets

- App DB: user ↔ Miniflux mapping
- Encrypt stored Miniflux API keys
- Secrets via env vars only
- No secrets committed to git

## Deployment

- Lightsail Ubuntu VM
- Docker Compose (proxy + web + miniflux + db)
- Reverse proxy (Caddy) with TLS
- Miniflux not publicly exposed

## CI/CD

- GitHub → Actions → SSH deploy
- On push to main:
  - git pull
  - docker compose up -d
- Manual deploy first, automate after

## Phase 1 — Backend First (Miniflux Only)

- Deploy Miniflux v2 + Postgres on Lightsail
- Use Miniflux UI directly (single admin user)
- Test feeds, categories, rules, full-content fetching
- Set backups + update routine
- Keep Miniflux simple; minimal customization

## Phase 2 — Custom Frontend (Single User)

**Goal:** Build product UI without auth complexity

- Add Next.js frontend (App Router, TS)
- Minimal UI, functionality-first
- Read/write via Miniflux REST API (single user)
- Features:
  - Unread / starred / history
  - Entry detail view
  - Mark read / star
- Styling: CSS Modules + Sass, minimal CSS
- Miniflux still private / internal

## Phase 3 — Open Signup (Friends & Family)

**Goal:** Turn project into shared product

- Add Clerk auth (open signup + email verification)
- On first login:
  - Provision Miniflux user
  - Create API key
  - Store mapping (securely)
- Enable multi-user flows
- Add basic abuse controls (rate limits)
- Invite friends & family for testing
