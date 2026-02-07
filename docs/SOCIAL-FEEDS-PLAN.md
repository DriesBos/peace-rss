# Social Feeds Integration Plan (Miniflux + RSS-Bridge + Optional Wallabag)

## Goal
Add support for X/Twitter and Instagram sources in the app while keeping Miniflux as the reader backend.

## Scope
- Keep current feed UX (single "Add feed" input).
- Add server-side URL normalization for social profile URLs.
- Convert social profile URLs to RSS-Bridge feed URLs.
- Store and read social feeds through Miniflux like any other feed.
- Optionally forward selected items to Wallabag for archival.

## Recommended Architecture
- App frontend: unchanged add-feed experience.
- App API (`/api/feeds/create`): detect social URLs and map to bridge feed URL.
- RSS-Bridge: private internal service for feed generation.
- Miniflux: source of truth for subscriptions and entries.
- Wallabag (optional): read-later/archive destination only.

## Why this approach
- Miniflux is strong for feed reading, filtering, and sync.
- X/Instagram are not reliable direct RSS sources.
- RSS-Bridge is the fastest way to expose these sources as feed URLs consumable by Miniflux.
- Wallabag complements Miniflux for archival, highlights, and long-term storage.

## Implementation Plan

### Phase 1: Infrastructure
1. Add `rss-bridge` service to `docker-compose.yml`.
2. Keep bridge private (internal network only).
3. Add env vars:
   - `RSS_BRIDGE_BASE_URL`
   - `RSS_BRIDGE_INSTAGRAM_SESSION_ID` (or equivalent bridge auth input)
   - `RSS_BRIDGE_TWITTER_TOKEN` (if using TwitterV2 bridge)
4. Document setup in `README.md` and `ENV-TEMPLATE.md`.

### Phase 2: Backend Mapping
1. Create a helper in `frontend/src/lib/` to detect and normalize:
   - `x.com/<handle>` / `twitter.com/<handle>`
   - `instagram.com/<handle>`
2. In `frontend/src/app/api/feeds/create/route.ts`:
   - If URL is social profile, build bridge feed URL.
   - Otherwise use existing discovery flow.
3. Keep credentials server-side; never expose secret params to client.

### Phase 3: UX + Validation
1. Add helper text in add-feed modal for supported social URL patterns.
2. Improve error messages for common social failures:
   - Authentication/session expired
   - Account not found / private account
   - Rate limiting
3. Add smoke tests or manual checklist for create-feed flows.

### Phase 4: Hardening
1. Add monitoring for bridge failures and feed parsing errors.
2. Add operational runbook for token/session refresh.
3. Optionally add per-feed Miniflux settings where needed (`fetch_via_proxy`, `user_agent`, etc.).

## Security and Operations
- Host RSS-Bridge privately; do not expose it publicly without controls.
- Rotate bridge credentials and session data regularly.
- Assume social platforms can break bridge adapters at any time.
- Keep fallback messaging clear in UI when a source cannot be fetched.

## Wallabag Positioning
- Use Wallabag only as downstream archive/read-later destination.
- Do not use Wallabag as social feed ingestion source.
- Optional: enable Miniflux -> Wallabag for selected entries.

---

# Instagram-Specific Plan

## Objective
Support adding Instagram creators/accounts as feeds from the existing add-feed field.

## Assumptions
- A private RSS-Bridge instance is available.
- Instagram bridge requires authenticated session context.
- Some accounts (private/restricted) will remain inaccessible by design.

## Execution Steps

### Step 1: Bridge Setup
1. Configure Instagram bridge credentials/session values in environment.
2. Validate one known public Instagram account in browser/feed client.
3. Confirm generated feed URL is consumable by Miniflux.

### Step 2: URL Normalization Rules
1. Accept input forms:
   - `instagram.com/<username>`
   - `www.instagram.com/<username>/`
   - Optional post/reel links -> resolve to profile when possible.
2. Normalize username and reject malformed handles early.

### Step 3: Backend Integration
1. Add `buildInstagramBridgeUrl(username)` helper.
2. Route detected Instagram inputs through this helper before Miniflux create.
3. Preserve existing category assignment behavior.

### Step 4: UX + Errors
1. Add guidance text near feed input: supported Instagram format.
2. Return explicit errors for:
   - Private account
   - Invalid/expired bridge session
   - Bridge unavailable
3. Keep generic fallback for unknown parser errors.

### Step 5: Verification Checklist
1. Add a public Instagram account successfully.
2. Feed appears in list with entries.
3. Category assignment works.
4. Bad username shows actionable error.
5. Expired session scenario shows actionable error.

### Step 6: Maintenance
1. Track bridge breakage incidents.
2. Revalidate Instagram flow after platform changes.
3. Keep a documented process to refresh session values.

## Success Criteria
- Users can paste an Instagram profile URL and subscribe without manual bridge URL construction.
- Failures are understandable and recoverable.
- No bridge secrets are exposed to browser/client logs.

## References
- Miniflux Wallabag integration: https://miniflux.app/docs/wallabag.html
- Wallabag repository: https://github.com/wallabag/wallabag
- Miniflux API docs: https://docs.miniflux.app/en/latest/api.html
- Miniflux integrations: https://docs.miniflux.app/en/latest/integration.html
- RSS-Bridge Instagram bridge: https://rss-bridge.github.io/rss-bridge/Bridge_Specific/InstagramBridge.html
- RSS-Bridge TwitterV2 bridge: https://rss-bridge.github.io/rss-bridge/Bridge_Specific/TwitterV2Bridge.html
