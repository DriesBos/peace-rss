export type Category = {
  id: number;
  user_id: number;
  title: string;
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
};

export type Entry = {
  id: number;
  title: string;
  url: string;
  content?: string;
  reading_time?: number;
  author?: string;
  feed_id: number;
  feed?: { id: number; title: string };
  feed_title?: string;
  published_at?: string;
  status?: 'read' | 'unread';
  starred?: boolean;
};

export type EntriesResponse = {
  total: number;
  entries: Entry[];
};

export type FeedCountersResponse = {
  reads?: Record<string, number>;
  unreads?: Record<string, number>;
};
