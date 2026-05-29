import { StandardItem, HackerNewsConfig } from '../types/item.js';
import { logger } from '../utils/logger.js';
import { nowISO } from '../utils/date.js';

const HN_API_BASE = 'https://hacker-news.firebaseio.com/v0';
const FETCH_TIMEOUT_MS = 10_000;
const BATCH_SIZE = 10;

interface HNItem {
  id: number;
  title?: string;
  url?: string;
  by?: string;
  time?: number;
  score?: number;
  descendants?: number;
  type?: string;
}

const FEED_SOURCE_MAP: Record<string, string> = {
  topstories: 'Hacker News',
  beststories: 'HN Best',
  showstories: 'Show HN',
  askstories: 'Ask HN',
};

const FEED_CATEGORY_MAP: Record<string, string> = {
  topstories: 'hn-top',
  beststories: 'hn-best',
  showstories: 'show-hn',
  askstories: 'ask-hn',
};

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchHNItem(id: number): Promise<HNItem | null> {
  try {
    const response = await fetchWithTimeout(`${HN_API_BASE}/item/${id}.json`, FETCH_TIMEOUT_MS);
    if (!response.ok) {
      logger.warn(`HN item ${id}: HTTP ${response.status}`);
      return null;
    }
    return (await response.json()) as HNItem;
  } catch (error) {
    logger.warn(`HN item ${id} fetch failed:`, error);
    return null;
  }
}

function mapToStandardItem(item: HNItem, feedType: string): StandardItem {
  const hnUrl = `https://news.ycombinator.com/item?id=${item.id}`;
  return {
    id: `hn-${item.id}`,
    title: item.title ?? '(untitled)',
    url: item.url || hnUrl,
    source: FEED_SOURCE_MAP[feedType] ?? 'Hacker News',
    sourceType: 'hacker_news',
    category: FEED_CATEGORY_MAP[feedType],
    author: item.by,
    publishedAt: item.time ? new Date(item.time * 1000).toISOString() : undefined,
    fetchedAt: nowISO(),
    score: item.score,
    commentsCount: item.descendants,
    tags: [],
    relevanceScore: 0,
    raw: item,
  };
}

export async function collectHackerNews(config: HackerNewsConfig): Promise<StandardItem[]> {
  if (config.enabled === false) {
    logger.info('Hacker News collector is disabled, skipping.');
    return [];
  }

  const seenIds = new Set<number>();
  const allItems: StandardItem[] = [];

  for (const feedType of config.feeds) {
    logger.info(`Fetching HN feed: ${feedType} (limit ${config.limitPerFeed})...`);

    let storyIds: number[];
    try {
      const response = await fetchWithTimeout(`${HN_API_BASE}/${feedType}.json`, FETCH_TIMEOUT_MS);
      if (!response.ok) {
        logger.error(`Failed to fetch HN ${feedType}: HTTP ${response.status}`);
        continue;
      }
      storyIds = (await response.json()) as number[];
    } catch (error) {
      logger.error(`Failed to fetch HN ${feedType}:`, error);
      continue;
    }

    // Filter out already-seen IDs, then limit
    const newIds = storyIds.filter((id) => !seenIds.has(id));
    const idsToFetch = newIds.slice(0, config.limitPerFeed);

    // Mark as seen
    for (const id of idsToFetch) {
      seenIds.add(id);
    }

    // Fetch in batches
    for (let i = 0; i < idsToFetch.length; i += BATCH_SIZE) {
      const batch = idsToFetch.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(batch.map((id) => fetchHNItem(id)));

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          allItems.push(mapToStandardItem(result.value, feedType));
        }
      }
    }

    logger.info(`Collected items from HN ${feedType}, running total: ${allItems.length}`);
  }

  logger.info(`Total Hacker News items collected: ${allItems.length} (across ${config.feeds.length} feeds)`);
  return allItems;
}
