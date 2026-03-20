# APP

This markdown contains the application plan. 

## Structure

### Entries
- Read entries are removed according to Miniflux cleanup settings
- Opening an entry changes its status to 'read'
- Opening an external link from an entry changes its status to 'read'
- Fetching the original article content is manual
- Starred entries are not removed and kept indefinitely

### EntryList
- Shows entries in reverse chronological order
- Uses the Miniflux `entries_per_page` setting for initial page size and load-more size
- 'Read' entries are visually distinct (greyed out)

### Categories
- Unread: shows globally visible unread entries
- All: shows globally visible read and unread entries
- Starred: shows all starred entries
- Category pages follow the current `Unread` or `All` mode

## Themes, Effects and options

- the app applies themes color
- the app no longer uses a service worker or PWA caching layer

## Settings
- CLEANUP_ARCHIVE_READ_DAYS: 30
- CLEANUP_ARCHIVE_UNREAD_DAYS: 90
- CLEANUP_FREQUENCY_HOURS: 24

## Agents

- When finishing a task, docker compose down and up to restart the app
