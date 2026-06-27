# App Behavior

## Marked (Read) Entries

- Articles are marked (set to `read`) when the user marks them.
- Articles are marked (set to `read`) when the user opens them in the reader.
- Opening an external link from the selected entry marks that entry as `read`.
- Marking a full page as read uses Miniflux server-side mark-all endpoints for home and category views.

## Entry Loading

- Home queries use Miniflux's `globally_visible=true` filter so hidden feeds/categories do not leak into global `Unread` and `All`.
- Returning provisioned users receive server-seeded reader data and do not call `/api/bootstrap` on startup.
- The first entries page is hydrated into TanStack Query using the user's `entries_per_page` preference.
- Original article fetching is manual. The reader shows Miniflux entry content by default, and `Fetch source` updates the entry through Miniflux when requested.

## Hidden Global Feeds

- Feeds and categories marked `hide_globally=true` in Miniflux are excluded from the global `Unread` and `All` views.
- Instagram and Twitter/X feeds created through the social feed flow are marked `hide_globally=true`.
- RSS-Bridge is only used for these social feeds (Instagram and Twitter/X).

## Feed Discovery (Non-Social URLs)

- For a standard website URL, the backend first calls Miniflux discovery (`POST /v1/discover`) to ask Miniflux which RSS/Atom feeds it can detect for that page.
- If multiple feeds are discovered, the add modal shows a picker and resubmits the selected feed.
- If discovery returns no results or fails, the backend falls back to creating the feed with the original URL directly.
- For `medium.com` URLs only, the backend now tries an RSS-Bridge `findfeed` fallback before the final direct-URL fallback.
- For `medium.com` URLs, the backend first rewrites page/profile URLs to canonical feed URLs (for example, `https://mres.medium.com/` → `https://mres.medium.com/feed`, `https://medium.com/@name` → `https://medium.com/feed/@name`).

## Protected Categories

- `Instagram` and `Twitter` categories are protected: they cannot be edited or deleted, and feeds cannot be manually moved into them.
- The Add/Edit UI mirrors these rules for protected social categories.
- Clearing a feed's category in the edit modal sends `category_id: null`.

## Layout Variants

- The UI uses `data-layout` attributes to style layouts:
  - `EntryList` uses `data-layout` for category-specific list layouts (`youtube`, `instagram`, `twitter`).
  - `EntryItem` uses `data-layout` for entry-specific rendering/styling.
