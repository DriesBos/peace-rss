# Development

## Environment
- Copy `ENV-TEMPLATE.md` to `.env` and fill values.
- Required variables include Clerk keys, Miniflux config, and Postgres credentials.

## Docker (Recommended)
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

The local Miniflux/Postgres services use their own Docker volume. Use Clerk
development keys (`pk_test_` and `sk_test_`) locally; logging in with the same
email address as production creates a separate development account.

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
