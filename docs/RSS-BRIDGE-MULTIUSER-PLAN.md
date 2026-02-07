# RSS-Bridge Multi-User Plan

## 1. Define scope and policy
- Decide supported sources for v1 (`instagram public profiles`, optional `x public profiles`).
- Decide compliance policy (allowed sources, retention, abuse response, user-facing terms).

## 2. Target architecture
- Keep per-user Miniflux accounts as-is.
- Add a backend social-feed layer between app and RSS-Bridge.
- Keep RSS-Bridge private (internal network, no public exposure).

## 3. Source model and data design
- Introduce a canonical source key (`platform + handle`).
- Store user subscriptions separately from shared source metadata.
- Track source health (`status`, `last_success`, `last_error`, `error_count`).

## 4. Ingestion flow
- User submits social URL/handle.
- Backend normalizes and validates input.
- Backend resolves to canonical source, then subscribes user via Miniflux.
- Avoid storing secret-bearing bridge URLs in user-visible paths.

## 5. Credential and secret strategy
- Keep bridge/session credentials server-side only.
- Encrypt secrets at rest; never log them.
- Define rotation process and expiration alerts for session-based auth.

## 6. Reliability and rate-limit controls
- Add per-source caching and request coalescing.
- Add global and per-user rate limits.
- Implement retry/backoff for 429/5xx and circuit-breaker behavior for unstable sources.

## 7. User experience and errors
- Show clear statuses: `active`, `degraded`, `blocked/private`, `auth expired`.
- Return actionable errors for invalid handle, private account, rate limit, bridge downtime.
- Add admin visibility for incident triage.

## 8. Rollout plan
- Phase 1: internal alpha with public Instagram only.
- Phase 2: add X and operational dashboards.
- Phase 3: optional per-user credentials/private sources.
- Define success metrics (subscription success rate, refresh latency, failure rate, support tickets).
