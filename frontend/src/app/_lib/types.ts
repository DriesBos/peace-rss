export type Category = {
  id: number;
  user_id: number;
  title: string;
};

export type Feed = {
  id: number;
  title: string;
  feed_url?: string;
  unread_count?: number;
  category?: { id: number; title: string };
};

export type Entry = {
  id: number;
  title: string;
  url: string;
  content?: string;
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
