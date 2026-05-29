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

function mapToStandardItem(item: HNItem): StandardItem {
  const hnUrl = `https://news.ycombinator.com/item?id=${item.id}`;
  return {
    id: `hn-${item.id}`,
    title: item.title ?? '(untitled)',
    url: item.url || hnUrl,
    source: 'Hacker News',
    sourceType: 'hacker_news',
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
  const limit = config.limit ?? 30;
  logger.info(`Fetching top ${limit} Hacker News stories...`);

  let topIds: number[];
  try {
    const response = await fetchWithTimeout(`${HN_API_BASE}/topstories.json`, FETCH_TIMEOUT_MS);
    if (!response.ok) {
      logger.error(`Failed to fetch HN top stories: HTTP ${response.status}`);
      return [];
    }
    topIds = (await response.json()) as number[];
  } catch (error) {
    logger.error('Failed to fetch HN top stories:', error);
    return [];
  }

  const idsToFetch = topIds.slice(0, limit);
  const items: StandardItem[] = [];

  // Fetch in batches to be polite
  for (let i = 0; i < idsToFetch.length; i += BATCH_SIZE) {
    const batch = idsToFetch.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map((id) => fetchHNItem(id)));

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        items.push(mapToStandardItem(result.value));
      }
    }
  }

  logger.info(`Collected ${items.length} Hacker News stories`);
  return items;
}
