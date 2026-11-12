export type Category = {
  id: number;
  user_id: number;
  title: string;
  hide_globally?: boolean;
  feed_count?: number;
  total_unread?: number;
};

/**
 * Tags replace categories. A feed has tags, a post inherits them and can
 * have its own. `auto` tags (video, audio, images, long-form) are set by
 * detection when a post arrives.
 */
export type Tag = {
  id: number;
  title: string;
  slug: string;
  kind: 'manual' | 'auto';
  position: number;
  feed_count: number;
  total_unread: number;
  has_entries: boolean;
};

export type ReaderCounts = {
  unread: number;
  all: number;
  starred: number;
};

export type TagsResponse = {
  tags: Tag[];
  counts: ReaderCounts;
};

export type DiscoveredFeed = {
  url: string;
  title: string;
  type: string;
};

export type Feed = {
  id: number;
  title: string;
  feed_url?: string;
  site_url?: string;
  blocklist_rules?: string;
  rewrite_rules?: string;
  unread_count?: number;
  category?: { id: number; title: string };
  hide_globally?: boolean;
  tag_ids?: number[];
};

export type Entry = {
  id: number;
  title: string;
  url: string;
  content?: string;
  preview?: string;
  thumbnail_url?: string;
  reading_time?: number;
  author?: string;
  feed_id: number;
  feed?: { id: number; title: string };
  feed_title?: string;
  published_at?: string;
  status?: 'read' | 'unread';
  starred?: boolean;
  /** Feed tags + own tags, minus the ones removed from this post. */
  tag_ids?: number[];
};

export type EntriesResponse = {
  total: number;
  entries: Entry[];
};

export type ReaderPreferences = {
  id: number;
  entries_per_page: number;
  keyboard_shortcuts: boolean;
  show_reading_time: boolean;
  entry_swipe: boolean;
};
