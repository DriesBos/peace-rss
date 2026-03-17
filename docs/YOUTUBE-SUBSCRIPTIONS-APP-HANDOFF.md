# YouTube Subscriptions App Handoff

## Goal

Build a separate app that lets a user connect their YouTube account and import all channels they are subscribed to.

This should not try to scrape or mirror `https://www.youtube.com/feed/subscriptions` directly.

## Recommendation

Use Google OAuth 2.0 plus the YouTube Data API to read the authenticated user's subscriptions, then convert those subscriptions into app-managed records.

Recommended flow:

1. User signs in with Google.
2. App requests read-only YouTube scope.
3. App calls `subscriptions.list?mine=true`.
4. App stores the returned subscribed channel IDs and channel metadata.
5. App offers:
   - one-time import
   - manual re-sync
   - optional scheduled sync later

## Why This Approach

- It is the supported API path.
- It is more stable than scraping YouTube HTML.
- It does not depend on private website behavior.
- It maps cleanly to a product where the app owns the imported subscription list.
- It keeps the initial product simple: import subscriptions first, then add richer feed/video sync later if needed.

## Important Constraint

There is no supported API that directly exposes the personalized `youtube.com/feed/subscriptions` page as a feed endpoint.

The old `activities.list?home=true` path is not a suitable replacement:

- Google documents `home` as deprecated.
- It is described as similar to a logged-out home feed, not the authenticated user's subscriptions feed.

## Minimal Viable Product

The MVP should focus on subscription import, not full YouTube feed replication.

Suggested MVP scope:

1. Google OAuth login
2. Request `youtube.readonly`
3. Fetch all subscribed channels with pagination
4. Save:
   - YouTube channel ID
   - channel title
   - thumbnails
   - imported timestamp
5. Show imported subscriptions in the app
6. Add a "Sync subscriptions" action

## Good V1 / V2 Split

### V1

- Connect YouTube account
- Import all subscriptions
- Manual resync
- Handle revoked tokens and expired sessions cleanly

### V2

- Periodic background sync
- Detect newly subscribed / unsubscribed channels
- Pull recent uploads per channel if the product needs videos, not just subscription metadata
- Per-channel notifications or filtering

## If The Product Also Needs Videos

If the separate app must also show recent videos from those subscriptions:

1. Get subscribed channel IDs from `subscriptions.list?mine=true`
2. For each channel, fetch channel details with `channels.list`
3. Use each channel's uploads playlist
4. Fetch videos from `playlistItems.list`

This is still better than trying to mirror YouTube's private subscriptions page.

## OAuth / Compliance Notes

- `youtube.readonly` is the correct read-only scope for this use case.
- This scope is tied to user YouTube account data.
- Google documents that public apps using sensitive user-data scopes must complete verification before broad production use.

Plan for:

- OAuth consent screen setup
- secure token storage
- refresh token handling
- token revocation / reconnect UX
- possible Google verification before public launch

## Quota Notes

This approach is operationally reasonable.

Google documents low quota cost for the main list endpoints involved:

- `subscriptions.list`: 1 unit
- `channels.list`: 1 unit
- `playlistItems.list`: 1 unit

Default quota is documented as `10,000 units per day`, which is enough for an MVP unless sync frequency or user count becomes large.

## Architecture Recommendation

For a separate app, prefer this structure:

- Frontend: connect account, show sync status, list subscriptions
- Backend:
  - OAuth callback handling
  - token storage
  - YouTube API sync jobs
  - persistence for channels and sync state
- Database:
  - users
  - connected Google account
  - YouTube channel subscriptions
  - sync runs / errors

## What Not To Build

Do not build around:

- scraping `youtube.com/feed/subscriptions`
- browser automation to read the page
- undocumented internal YouTube endpoints
- deprecated `activities.list?home=true` as the main source of truth

Those approaches are brittle and product-risky.

## Final Recommendation

Build the separate app around OAuth-based subscription import.

If the main user need is "connect my YouTube account and get everything I subscribe to", the right product shape is:

- account connection
- subscription import
- sync

If later needed, layer recent-upload retrieval on top of the imported subscription graph.

## Sources

- YouTube Data API `subscriptions.list`
  - https://developers.google.com/youtube/v3/docs/subscriptions/list
- YouTube `subscriptions` resource
  - https://developers.google.com/youtube/v3/docs/subscriptions
- YouTube Data API `channels.list`
  - https://developers.google.com/youtube/v3/docs/channels/list
- YouTube Data API `playlistItems.list`
  - https://developers.google.com/youtube/v3/docs/playlistItems/list
- YouTube Data API `activities.list`
  - https://developers.google.com/youtube/v3/docs/activities/list
- YouTube Data API quota costs
  - https://developers.google.com/youtube/v3/determine_quota_cost
- Google OAuth 2.0 scopes
  - https://developers.google.com/identity/protocols/oauth2/scopes
- YouTube server-side OAuth flow
  - https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps
- Google OAuth sensitive-scope verification
  - https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification
