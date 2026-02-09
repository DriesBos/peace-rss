# App Behavior

## Marked (Read) Entries

- Articles are marked (set to `read`) when the user marks them.
- Articles are also marked (set to `read`) when the user stays on an entry for more than 5 seconds.

## YouTube Feeds

- When adding a YouTube RSS feed (`/feeds/videos.xml`), the backend auto-assigns it to the `YouTube` category (creating it if needed).
- YouTube feeds are marked `hide_globally=true` in Miniflux so they do not appear in the global “All” view; they only appear inside the `YouTube` category.

## Instagram / Twitter Feeds

- Instagram and Twitter/X feeds are created via the app’s social feed flow and are auto-assigned to `Instagram` / `Twitter` categories (created if needed).
- Instagram/Twitter feeds are marked `hide_globally=true` so they do not appear in the global “All” view.
- RSS-Bridge is only used for these social feeds (Instagram and Twitter/X).

## Feed Discovery (Non-Social URLs)

- For a standard website URL, the backend first calls Miniflux discovery (`POST /v1/discover`) to ask Miniflux which RSS/Atom feeds it can detect for that page.
- In the current add-feed flow, "auto-discover" means this discovery step runs automatically and the first discovered feed URL is used when results are returned.
- If discovery returns no results or fails, the backend falls back to creating the feed with the original URL directly.
- For `medium.com` URLs only, the backend now tries an RSS-Bridge `findfeed` fallback before the final direct-URL fallback.

## Protected Categories

- `YouTube`, `Instagram`, and `Twitter` categories are protected: they cannot be edited or deleted, and feeds cannot be manually moved into them.
- The Add/Edit UI mirrors these rules: dedicated add forms exist, and protected feeds can only edit name + URL (no category assignment).

## Layout Variants

- The UI uses `data-layout` attributes to style layouts:
  - `EntryList` uses `data-layout` for category-specific list layouts (`youtube`, `instagram`, `twitter`).
  - `EntryItem` uses `data-layout` for entry-specific rendering/styling.
