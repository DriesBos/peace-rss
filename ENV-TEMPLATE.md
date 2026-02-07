# Environment Variables Template

Copy this template to create your `.env` file in the project root.

## Required Variables

```bash
# ============================================
# Clerk Authentication
# ============================================
# Get these from: https://dashboard.clerk.com/
# Development: Use keys starting with pk_test_ and sk_test_
# Production: Use keys starting with pk_live_ and sk_live_

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx

# ============================================
# Miniflux Configuration
# ============================================
# Internal Docker URL (used by Next.js server to call Miniflux API)
MINIFLUX_BASE_URL=http://miniflux:8080/miniflux

# Admin credentials (must match Miniflux admin user)
MINIFLUX_ADMIN_USERNAME=admin
MINIFLUX_ADMIN_PASSWORD=your_secure_admin_password_here

# Public URL (used by Miniflux for links and BASE_URL config)
MINIFLUX_PUBLIC_URL=https://komorebi-reader.com/miniflux

# ============================================
# RSS-Bridge Social Feeds
# ============================================
# Internal RSS-Bridge URL used by frontend server routes
RSS_BRIDGE_BASE_URL=http://rss-bridge

# URL Miniflux will subscribe to for social feeds (must be reachable by Miniflux container)
# Docker setup: http://frontend:3000
SOCIAL_FEEDS_BASE_URL=http://frontend:3000

# Secret used to encrypt social feed proxy tokens (use a long random value)
SOCIAL_FEED_TOKEN_SECRET=replace_with_a_long_random_secret

# Optional token to protect /api/social/metrics (set to enable endpoint)
SOCIAL_METRICS_TOKEN=replace_with_metrics_token

# Phase 2/3 tuning (defaults shown)
SOCIAL_CREATE_RATE_LIMIT_PER_MINUTE=20
SOCIAL_PROXY_GLOBAL_RATE_LIMIT_PER_MINUTE=300
SOCIAL_PROXY_SOURCE_RATE_LIMIT_PER_MINUTE=120
SOCIAL_PROXY_CACHE_TTL_MS=120000
SOCIAL_DISCOVERY_CACHE_TTL_MS=600000

# ============================================
# PostgreSQL Database
# ============================================
POSTGRES_USER=miniflux
POSTGRES_PASSWORD=your_secure_postgres_password_here
POSTGRES_DB=miniflux
```

## Important Notes

1. **Never commit the `.env` file** - it's already in `.gitignore`
2. **Different keys for dev/prod**:
   - Local development: Use Clerk test keys
   - Production server: Use Clerk live keys
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
docker compose exec frontend env | grep -E 'CLERK|MINIFLUX'

# Should show:
# NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
# CLERK_SECRET_KEY=sk_...
# MINIFLUX_BASE_URL=http://miniflux:8080/miniflux
# MINIFLUX_ADMIN_USERNAME=admin
# MINIFLUX_ADMIN_PASSWORD=...
# RSS_BRIDGE_BASE_URL=http://rss-bridge
# SOCIAL_FEEDS_BASE_URL=http://frontend:3000
# SOCIAL_FEED_TOKEN_SECRET=...
# SOCIAL_METRICS_TOKEN=...
# SOCIAL_CREATE_RATE_LIMIT_PER_MINUTE=20
# SOCIAL_PROXY_GLOBAL_RATE_LIMIT_PER_MINUTE=300
# SOCIAL_PROXY_SOURCE_RATE_LIMIT_PER_MINUTE=120
# SOCIAL_PROXY_CACHE_TTL_MS=120000
# SOCIAL_DISCOVERY_CACHE_TTL_MS=600000
```
