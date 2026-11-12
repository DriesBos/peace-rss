# Clerk → Better Auth cutover

One-time steps to move production users from Clerk to Better Auth. Users keep their Clerk IDs and passwords; Miniflux data does not move. Every user signs in once after cutover because Clerk sessions cannot be carried over.

## 1. Prepare (before deploying)

1. Set up the sending domain in [Resend](https://resend.com/domains) (add its DNS records) and create an API key.
2. Add to the production `.env`:
   ```bash
   BETTER_AUTH_SECRET=$(openssl rand -base64 32)
   BETTER_AUTH_URL=https://komorebi-reader.com
   MINIFLUX_TOKEN_KEY=$(openssl rand -base64 32)
   RESEND_API_KEY=re_...
   AUTH_EMAIL_FROM="Komorebi Reader <no-reply@komorebi-reader.com>"
   ```
   Keep `CLERK_SECRET_KEY` in `.env` until step 3 is done; the app no longer reads it.
3. Export users from the Clerk dashboard (Users → Export, CSV). The CSV holds the bcrypt password hashes; keep it private and delete it after.

## 2. Deploy

Merge to `main`. On startup the frontend creates the `komorebi_auth` database and its tables. Check:

```bash
docker compose -f docker-compose.prod.yml logs frontend | grep '\[auth\]'
```

## 3. Migrate users

Run the script in a throwaway Node container on the compose network (Postgres is not exposed to the host):

```bash
cd /opt/peace-rss
set -a; . ./.env; set +a
docker run --rm -it \
  --network "$(basename "$PWD")_default" \
  -v "$PWD/frontend":/app -v /path/to/clerk-export.csv:/export.csv:ro \
  -w /app \
  -e CLERK_SECRET_KEY -e MINIFLUX_TOKEN_KEY \
  -e AUTH_DATABASE_URL="postgres://$POSTGRES_USER:$POSTGRES_PASSWORD@postgres:5432/komorebi_auth?sslmode=disable" \
  -e CLERK_EXPORT_CSV=/export.csv \
  node:24-bookworm sh -c "corepack enable && pnpm install --frozen-lockfile && node scripts/migrate-clerk-users.mjs --dry-run"
```

Check the dry-run list, then run again without `--dry-run`. The script is safe to re-run: existing users are skipped.

Expected result: the number of migrated users matches Clerk, and `miniflux` matches the number of non-admin Miniflux users.

## 4. After cutover

- Announce the one-time sign-in in Updates.
- Users who only used social sign-in in Clerk have no password; they use "Forgot password" once.
- Remove `CLERK_SECRET_KEY` from `.env`. Keep the Clerk app for 30 days as a fallback, then delete it.
