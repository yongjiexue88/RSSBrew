// ── Source types ──

export type SourceType =
  | "hacker_news"
  | "reddit"
  | "reddit_search"
  | "github_trending"
  | "rss";

// ── Multi-dimensional scoring ──

export type ScoreBreakdown = {
  buyerIntentScore: number;
  specificityScore: number;
  promoPenalty: number;
  junkPenalty: number;
  painScore: number;
  startupScore: number;
  saasScore: number;
  trendScore: number;
  devtoolScore: number;
  marketingScore: number;
  authorityScore: number;
  recencyScore: number;
  finalScore: number;
  reasons: string[];
};

// ── Standard item ──

export type StandardItem = {
  id: string;
  title: string;
  url: string;
  source: string;
  sourceType: SourceType;
  category?: string;
  author?: string;
  publishedAt?: string;
  fetchedAt: string;
  summary?: string;
  content?: string;
  score?: number;
  commentsCount?: number;
  tags: string[];
  relevanceScore: number;
  scores?: ScoreBreakdown;
  raw?: unknown;
};

// ── Config types ──

export type SourceConfig = {
  name: string;
  url: string;
  category?: string;
};

export type HackerNewsConfig = {
  enabled?: boolean;
  limitPerFeed: number;
  feeds: string[];
};

export type SourcesConfig = {
  hackerNews: HackerNewsConfig;
  reddit: SourceConfig[];
  redditSearch: SourceConfig[];
  githubTrending: SourceConfig[];
  rss: SourceConfig[];
};

export type KeywordsConfig = {
  [category: string]: string[];
};

export type HistoryData = {
  urls: Record<string, string>; // url -> ISO date string when first seen
};
