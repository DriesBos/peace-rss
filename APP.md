# APP

This markdown contains the application plan. 

## Structure

### Entries
- Read entries are removed according to Miniflux cleanup settings
- Opening an entry changes its status to 'read'
- Opening an external link from an entry changes its status to 'read'
- Starred entries are not removed and kept indefinitely

### EntryList
- Shows entries in reverse chronological order
- Shows entries in batches of 50 per page. The 'load more' button loads the next 50 entries.
- 'Read' entries are visually distinct (greyed out)

### Categories
- All: shows all entries
- Starred: shows all starred entries
- Categories created by user
- Youtube: shows all youtube feeds

## Settings
- CLEANUP_ARCHIVE_READ_DAYS: 30
- CLEANUP_ARCHIVE_UNREAD_DAYS: 90
- CLEANUP_FREQUENCY_HOURS: 24

## Agents

- When finishing a task, docker compose down and up to restart the app
