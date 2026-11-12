# App Behavior

## Marked (Read) Entries

- Articles are marked (set to `read`) when the user marks them.
- Articles are marked (set to `read`) when the user opens them in the reader.
- Opening an external link from the selected entry marks that entry as `read`.
- Marking a full page as read uses Miniflux server-side mark-all endpoints for home and category views.

## Entry Loading

- Home queries use Miniflux's `globally_visible=true` filter so hidden feeds/categories do not leak into global `Unread` and `All`.
- Original article fetching is manual. The reader shows Miniflux entry content by default, and `Fetch source` updates the entry through Miniflux when requested.

## Hidden Global Feeds

- Feeds and categories marked `hide_globally=true` in Miniflux are excluded from the global `Unread` and `All` views.

## Feed Discovery

- For a standard website URL, the backend first calls Miniflux discovery (`POST /v1/discover`) to ask Miniflux which RSS/Atom feeds it can detect for that page.
- In the current add-feed flow, "auto-discover" means this discovery step runs automatically and the first discovered feed URL is used when results are returned.
- If discovery returns no results or fails, the backend falls back to creating the feed with the original URL directly.
- For `medium.com` URLs, the backend first rewrites page/profile URLs to canonical feed URLs (for example, `https://mres.medium.com/` → `https://mres.medium.com/feed`, `https://medium.com/@name` → `https://medium.com/feed/@name`).

## Protected Categories

- Legacy: `Instagram` and `Twitter` categories (from the removed social feeds feature) are still protected: they cannot be edited or deleted, and feeds cannot be manually moved into them. This protection is scheduled for removal.
- The Add/Edit UI mirrors these rules.

## Layout Variants

- The UI uses `data-layout` attributes to style layouts:
  - `EntryList` uses `data-layout` for category-specific list layouts (`youtube`).
  - `EntryItem` uses `data-layout` for entry-specific rendering/styling.
