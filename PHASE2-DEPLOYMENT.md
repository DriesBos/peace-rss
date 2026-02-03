# Phase 2 Deployment Guide: Multi-User Authentication with Clerk

## Overview

Phase 2 implements per-user authentication using Clerk, with automatic Miniflux user provisioning. Each Clerk user gets their own isolated Miniflux account with a dedicated API token stored in Clerk's private metadata.

## What Changed

### 1. **Miniflux Client Library** (`frontend/src/lib/miniflux.ts`)

- Replaced single `mfFetch` with three functions:
  - `mfFetchUser(token, path, init)` - Per-user API calls with X-Auth-Token
  - `mfFetchAdmin(path, init)` - Admin API calls with Basic Auth
  - `mfFetchUserBasicAuth(username, password, path, init)` - Temporary auth for provisioning

### 2. **Bootstrap Endpoint** (`frontend/src/app/api/bootstrap/route.ts`)

- New POST endpoint that provisions Miniflux users
- Workflow:
  1. Check if user already has `minifluxToken` in Clerk privateMetadata
  2. If not, generate username from email (e.g., `driesbos-7h3k`)
  3. Create Miniflux user via admin API
  4. Create API key for that user
  5. Store token in Clerk privateMetadata
- Handles username collisions with random suffix retry

### 3. **All API Routes Updated**

All routes now:

1. Require Clerk authentication (`auth()`)
2. Load user's Miniflux token from Clerk metadata
3. Return 401 "Not provisioned" if token missing
4. Use `mfFetchUser(token, ...)` instead of shared token

Updated routes:

- `frontend/src/app/api/feeds/route.ts`
- `frontend/src/app/api/entries/route.ts`
- `frontend/src/app/api/entries/status/route.ts`
- `frontend/src/app/api/entries/[id]/star/route.ts`

### 4. **Frontend Changes**

- **Layout** (`frontend/src/app/layout.tsx`):

  - Moved Clerk auth buttons to top-right header
  - Shows "Please sign in" message when signed out
  - Only renders main content when signed in

- **Main Page** (`frontend/src/app/page.tsx`):
  - Calls `/api/bootstrap` on first render
  - Shows "Setting up your account..." during provisioning
  - Shows error panel with retry button if provisioning fails
  - Only loads feeds/entries after successful provisioning

### 5. **Middleware** (`frontend/src/middleware.ts`)

- Added Clerk middleware to protect all routes except:
  - `/api/health`
  - `/sign-in`, `/sign-up`
- Automatically redirects unauthenticated users to sign-in

### 6. **Docker Compose** (`docker-compose.yml`)

- Added Clerk environment variables to frontend service:
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - `CLERK_SECRET_KEY`
- Removed `MINIFLUX_API_TOKEN` (no longer needed)
- Added default value for `MINIFLUX_BASE_URL`

## Required Environment Variables

### Local Development (.env)

```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Miniflux Configuration
MINIFLUX_BASE_URL=http://miniflux:8080/miniflux
MINIFLUX_ADMIN_USERNAME=admin
MINIFLUX_ADMIN_PASSWORD=your_admin_password_here
MINIFLUX_PUBLIC_URL=https://komorebi-reader.com/miniflux

# PostgreSQL (existing)
POSTGRES_USER=miniflux
POSTGRES_PASSWORD=...
POSTGRES_DB=miniflux
```

### Server (.env on production)

Same as above, but ensure:

- Clerk keys are production keys (not test keys)
- `MINIFLUX_BASE_URL=http://miniflux:8080/miniflux` (internal Docker DNS)
- `MINIFLUX_PUBLIC_URL=https://komorebi-reader.com/miniflux` (public HTTPS URL)

## Pre-Deployment Checklist

### 0. Verify Clerk Setup

1. Go to [Clerk Dashboard](https://dashboard.clerk.com/)
2. Get your production keys:
   - Publishable key (starts with `pk_live_...`)
   - Secret key (starts with `sk_live_...`)
3. Add these to your `.env` file (both local and server)

### 1. Remove Old Token

```bash
# In your .env file, remove or comment out:
# MINIFLUX_API_TOKEN=...
```

### 2. Verify Miniflux Admin Credentials

```bash
# Test on server that admin creds work:
curl -u "admin:your_password" http://localhost:8080/miniflux/v1/users
# Should return JSON array of users
```

### 3. Update Local .env

Ensure all required variables are set (see above)

### 4. Test Locally

```bash
cd frontend
npm run dev
```

- Visit http://localhost:3000
- Sign in with Clerk
- Should see "Setting up your account..." then feed list
- Check browser console for errors

## Deployment Steps

### 1. Commit and Push

```bash
git add .
git commit -m "Phase 2: Multi-user auth with Clerk and per-user Miniflux provisioning"
git push
```

### 2. Update Server Environment

SSH into server and update `.env`:

```bash
ssh user@your-server
cd /opt/peace-rss

# Edit .env with production values
nano .env

# Verify these are set:
# - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY (production key)
# - CLERK_SECRET_KEY (production key)
# - MINIFLUX_ADMIN_USERNAME
# - MINIFLUX_ADMIN_PASSWORD
# - MINIFLUX_BASE_URL=http://miniflux:8080/miniflux
# - MINIFLUX_PUBLIC_URL=https://komorebi-reader.com/miniflux

# Remove or comment out MINIFLUX_API_TOKEN
```

### 3. Deploy

```bash
# Pull latest code
git pull

# Rebuild and restart containers
docker compose down
docker compose up -d --build

# Check logs
docker compose logs -f frontend
```

### 4. Verify Deployment

```bash
# Health check
curl -4 -fsS https://komorebi-reader.com/api/health && echo OK

# This should now require auth (will redirect or return 401)
curl -i https://komorebi-reader.com/api/feeds
```

## Verification Steps (In Browser)

### First User Sign-Up

1. Navigate to `https://komorebi-reader.com`
2. Click "Sign Up" (top right)
3. Complete Clerk sign-up flow
4. Should see "Setting up your account..." briefly
5. Then see empty feed list (or existing feeds if you had them)

### Provisioning Check

Open browser DevTools (Console tab):

1. Should see successful POST to `/api/bootstrap`
2. Check Network tab: POST `/api/bootstrap` returns `{"ok":true,"provisioned":true}`
3. GET `/api/feeds` should return `[]` or your feeds
4. No 401 or provisioning errors

### Add Feed Test

1. Go to "Open Miniflux" link
2. Sign in with automatically created credentials (username shown in Clerk metadata)
3. Add a feed (e.g., `https://xkcd.com/rss.xml`)
4. Go back to Peace RSS UI
5. Click "Refresh"
6. Feed should appear

### Multi-User Test

1. Open incognito/private window
2. Sign up with different email
3. Should see separate, empty feed list
4. Add different feed in Miniflux
5. Verify feeds are isolated between users

### Check Miniflux Users (Admin)

```bash
# SSH into server
ssh user@your-server

# Check Miniflux users via API
docker exec -it peace-rss-miniflux-1 sh -c "curl -u admin:your_password http://localhost:8080/miniflux/v1/users"

# Should see admin + one user per Clerk account
# Each user has username like "driesbos-7h3k"
```

## Troubleshooting

### "Not provisioned" Error

**Symptom**: API calls return `{"error":"Not provisioned. Call /api/bootstrap first."}`

**Fix**:

1. Open browser DevTools → Console
2. Check for bootstrap errors
3. Try clicking Retry button
4. If persists, check server logs:
   ```bash
   docker compose logs frontend | grep bootstrap
   ```

### "MINIFLUX_ADMIN_USERNAME is not set"

**Fix**: Ensure environment variables are passed to container

```bash
# Check frontend container env
docker compose exec frontend env | grep MINIFLUX

# If missing, verify .env file and restart:
docker compose down
docker compose up -d
```

### Bootstrap Creates User But Can't Create API Key

**Symptom**: Error "Failed to create API key"

**Fix**:

1. Check Miniflux logs:
   ```bash
   docker compose logs miniflux | tail -50
   ```
2. Verify the created user exists:
   ```bash
   curl -u admin:password http://localhost:8080/miniflux/v1/users
   ```
3. Try creating API key manually:
   ```bash
   curl -u username:password -X POST http://localhost:8080/miniflux/v1/api-keys \
     -H "Content-Type: application/json" \
     -d '{"description":"test"}'
   ```

### Username Collision

**Symptom**: "username already exists" in logs

**Fix**: Already handled automatically—bootstrap retries with random suffix. If still fails, check for special characters in email prefix.

### Clerk Webhook Issues (Future)

Currently we don't use webhooks. If you add user deletion via Clerk webhook later, also delete the corresponding Miniflux user via admin API.

## Security Notes

✅ **Good**:

- Miniflux tokens stored in Clerk `privateMetadata` (server-only)
- Tokens never sent to browser
- Each user has isolated feeds
- Admin credentials in `.env` (not committed)
- Middleware protects all routes

⚠️ **Important**:

- Never commit `.env` file
- Keep `MINIFLUX_ADMIN_PASSWORD` secure
- Use strong Clerk password policy
- Consider adding rate limiting later (not critical for friends & family)

## Rollback Plan

If deployment fails:

1. **Quick rollback**:

   ```bash
   cd /opt/peace-rss
   git reset --hard HEAD~1  # Go back one commit
   docker compose down
   docker compose up -d --build
   ```

2. **Restore shared token** (temporary):

   - Uncomment `MINIFLUX_API_TOKEN` in `.env`
   - Add to docker-compose.yml frontend environment
   - This requires reverting code changes too

3. **Check backups**:
   ```bash
   ls -lh /opt/peace-rss/backups/
   # Restore if needed
   ```

## Success Criteria

✅ All tests pass:

- [ ] Can sign up with Clerk
- [ ] Bootstrap provisions Miniflux user automatically
- [ ] Feeds load after provisioning
- [ ] Can add feed in Miniflux UI
- [ ] Can mark entries read/unread/starred
- [ ] Second user gets isolated account
- [ ] No 401 errors in browser console
- [ ] Health check returns 200

## Next Steps (Future Enhancements)

- [ ] Add user profile page showing Miniflux username
- [ ] Implement password reset flow
- [ ] Add Clerk webhook to clean up deleted users
- [ ] Move tokens to database for better scalability
- [ ] Add rate limiting to API routes
- [ ] Implement user invitation system

## Support

If you encounter issues:

1. Check logs: `docker compose logs -f frontend`
2. Verify environment variables: `docker compose exec frontend env | grep -E 'CLERK|MINIFLUX'`
3. Test Miniflux admin API: `curl -u admin:pass http://localhost:8080/miniflux/v1/users`
4. Check Clerk dashboard for user metadata

---

**Deployed on**: _[Date]_  
**By**: Dries Bos  
**Version**: Phase 2.0
