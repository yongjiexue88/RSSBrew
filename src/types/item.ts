export type SourceType =
  | "hacker_news"
  | "reddit"
  | "github_trending"
  | "rss";

export type StandardItem = {
  id: string;
  title: string;
  url: string;
  source: string;
  sourceType: SourceType;
  author?: string;
  publishedAt?: string;
  fetchedAt: string;
  summary?: string;
  content?: string;
  score?: number;
  commentsCount?: number;
  tags: string[];
  relevanceScore: number;
  raw?: unknown;
};

export type SourceConfig = {
  name: string;
  url: string;
  category?: string;
};

export type HackerNewsConfig = {
  limit: number;
};

export type SourcesConfig = {
  reddit: SourceConfig[];
  rss: SourceConfig[];
  githubTrending: SourceConfig[];
  hackerNews: HackerNewsConfig;
};

export type KeywordsConfig = {
  [category: string]: string[];
};

export type HistoryData = {
  urls: Record<string, string>; // url -> ISO date string when first seen
};
