# Environment Variables Template

Copy this template to create your `.env` file in the project root.

## Required Variables

```bash
# ============================================
# Authentication (Better Auth, self-hosted)
# ============================================
# Signs session cookies. Generate with: openssl rand -base64 32
BETTER_AUTH_SECRET=replace_with_a_long_random_secret
# Public URL of the app (exact origin users visit)
BETTER_AUTH_URL=https://komorebi-reader.com
# Encrypts each user's Miniflux API token at rest. Generate with: openssl rand -base64 32
# Never change it after users exist, or stored tokens become unreadable.
MINIFLUX_TOKEN_KEY=replace_with_a_long_random_secret
# Optional: auth database name on the shared Postgres (created on startup)
# AUTH_POSTGRES_DB=komorebi_auth

# ============================================
# Email (Resend) for verification and password reset
# ============================================
# Without RESEND_API_KEY, emails are logged to the frontend container instead.
RESEND_API_KEY=re_xxxxx
AUTH_EMAIL_FROM="Komorebi Reader <no-reply@komorebi-reader.com>"

# ============================================
# Miniflux Configuration
# ============================================
# Internal Docker URL (used by Next.js server to call Miniflux API)
MINIFLUX_BASE_URL=http://miniflux:8080/miniflux

# Admin credentials (must match Miniflux admin user)
MINIFLUX_ADMIN_USERNAME=admin
MINIFLUX_ADMIN_PASSWORD=your_secure_admin_password_here

# ============================================
# Reader database (mirrored posts + tags) - all optional
# ============================================
# Docker Compose defaults this to the Miniflux Postgres database, where the
# app creates and migrates its own `reader` schema on start.
# READER_DATABASE_URL=postgres://user:password@postgres:5432/miniflux?sslmode=disable
# Key for encrypting stored Miniflux tokens (falls back to MINIFLUX_TOKEN_KEY).
# READER_TOKEN_SECRET=
# Posts older than this are dropped from the mirror unless starred or tagged by hand.
# READER_RETENTION_DAYS=180
# How often new posts are pulled from Miniflux.
# READER_SYNC_INTERVAL_SECONDS=60

# Public URL (used by Miniflux for links and BASE_URL config)
MINIFLUX_PUBLIC_URL=https://komorebi-reader.com/miniflux

# Miniflux cleanup behavior
CLEANUP_ARCHIVE_READ_DAYS=30
CLEANUP_ARCHIVE_UNREAD_DAYS=90
CLEANUP_FREQUENCY_HOURS=24

# ============================================
# PostgreSQL Database
# ============================================
POSTGRES_USER=miniflux
POSTGRES_PASSWORD=your_secure_postgres_password_here
POSTGRES_DB=miniflux
```

## Important Notes

1. **Never commit the `.env` file** - it's already in `.gitignore`
2. **Different secrets for dev/prod**:
   - Local development: `BETTER_AUTH_URL=http://localhost`, Resend key optional
   - Production server: its own `BETTER_AUTH_SECRET` and `MINIFLUX_TOKEN_KEY`
3. **MINIFLUX_BASE_URL**:
   - Local Docker: `http://miniflux:8080/miniflux`
   - Production Docker: Same (internal DNS)
4. **MINIFLUX_PUBLIC_URL**:
   - Must match the public HTTPS URL
   - Used by Miniflux for generating links
5. **Removed**: `MINIFLUX_API_TOKEN` is no longer used (replaced by per-user tokens)

## Quick Setup

```bash
# 1. Copy this template
cd /Users/driesbos/Work/peace-suite/peace-rss
cp ENV-TEMPLATE.md .env

# 2. Edit with your values
nano .env

# 3. Secure the file
chmod 600 .env

# 4. Start services
docker compose up -d --build
```

## Verification

```bash
# Check that frontend has all env vars
docker compose exec frontend env | grep -E 'AUTH|MINIFLUX|RESEND'

# Should show:
# BETTER_AUTH_SECRET=...
# BETTER_AUTH_URL=https://komorebi-reader.com
# AUTH_DATABASE_URL=postgres://...@postgres:5432/komorebi_auth?sslmode=disable
# MINIFLUX_BASE_URL=http://miniflux:8080/miniflux
# MINIFLUX_ADMIN_USERNAME=admin
# MINIFLUX_ADMIN_PASSWORD=...
# CLEANUP_ARCHIVE_READ_DAYS=30
# CLEANUP_ARCHIVE_UNREAD_DAYS=90
# CLEANUP_FREQUENCY_HOURS=24
```
