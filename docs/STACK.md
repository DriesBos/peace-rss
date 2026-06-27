# Stack Overview

## Core

- Next.js
- React
- TypeScript
- TanStack Query
- TanStack Virtual
- Sass modules (one `.module.sass` per component)

## Auth

- Clerk (frontend + server-side keys)

## Backend Services

- Miniflux (RSS engine and API)
- Postgres (Miniflux storage)

## Infra

- Docker Compose for local orchestration
- Caddy reverse proxy (routes `/` to frontend, `/miniflux/` to Miniflux)

## UX / Extras

- Docker Compose runs the frontend as a production build locally.
