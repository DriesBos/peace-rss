# App Behavior

## Marked (Read) Entries

- Articles are marked (set to `read`) when the user marks them.
- Articles are marked (set to `read`) when the user opens them in the reader.
- Opening an external link from the selected entry marks that entry as `read`.
- Marking everything as read applies to the current view: the selected tags, or without tags the whole main list.

## Entry Loading

- Lists are read from our own `reader` tables (see Tags And The Reader Database). Feeds with `hide_globally=true` stay out of `Unread` and `All` until a tag is selected.
- Original article fetching is manual. The reader shows Miniflux entry content by default, and `Fetch source` updates the entry through Miniflux when requested.

## Tags And The Reader Database

- Miniflux only fetches feeds. The app copies feeds and posts into its own Postgres schema `reader` (created and migrated on start, `READER_DATABASE_URL`) and reads lists, counts and search from there.
- Sync runs inside the Next.js server every `READER_SYNC_INTERVAL_SECONDS` (default 60), on refresh (`POST /api/sync`) and after adding feeds. `GET /api/sync` compares mirror and Miniflux counts.
- Read and star changes go to Miniflux first, then to the mirror.
- Tags replace categories in the UI. On first sync every Miniflux category becomes a tag on its feeds.
- Feeds carry tags; a post has its feed's tags plus its own. Tags can be switched on or off per post in the entry panel.
- Auto tags are set per post when it is synced: `Video`, `Audio`, `Images` (3+ images and under 150 words) and `Long-form` (10+ minutes reading time). An auto tag removed by hand stays removed.
- The header bar shows `Unread`, `All`, `Starred` and all tags. Tags are toggles: several can be on at once and the list shows posts that have all of them. The selection lives in the URL as `?tags=slug,slug`.
- Posts older than `READER_RETENTION_DAYS` (default 180) are dropped from the mirror unless starred or tagged by hand.

## Hidden Global Feeds

- Feeds and categories marked `hide_globally=true` in Miniflux are excluded from the global `Unread` and `All` views.
- Instagram and Twitter/X feeds created through the social feed flow are marked `hide_globally=true`.
- RSS-Bridge is only used for these social feeds (Instagram and Twitter/X).

## Feed Discovery (Non-Social URLs)

- For a standard website URL, the backend first calls Miniflux discovery (`POST /v1/discover`) to ask Miniflux which RSS/Atom feeds it can detect for that page.
- In the current add-feed flow, "auto-discover" means this discovery step runs automatically and the first discovered feed URL is used when results are returned.
- If discovery returns no results or fails, the backend falls back to creating the feed with the original URL directly.
- For `medium.com` URLs only, the backend now tries an RSS-Bridge `findfeed` fallback before the final direct-URL fallback.
- For `medium.com` URLs, the backend first rewrites page/profile URLs to canonical feed URLs (for example, `https://mres.medium.com/` → `https://mres.medium.com/feed`, `https://medium.com/@name` → `https://medium.com/feed/@name`).

## Protected Categories

- `Instagram` and `Twitter` categories are protected: they cannot be edited or deleted, and feeds cannot be manually moved into them.
- The Add/Edit UI mirrors these rules for protected social categories.

## Layout Variants

- The UI uses `data-layout` attributes to style layouts:
  - `EntryList` uses `data-layout` for category-specific list layouts (`youtube`, `instagram`, `twitter`).
  - `EntryItem` uses `data-layout` for entry-specific rendering/styling.
