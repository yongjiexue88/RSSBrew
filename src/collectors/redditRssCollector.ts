import RssParser from 'rss-parser';
import { StandardItem, SourceConfig } from '../types/item.js';
import { logger } from '../utils/logger.js';
import { nowISO, parseDate } from '../utils/date.js';

const ITEMS_PER_FEED = 15;
const FETCH_TIMEOUT_MS = 15_000;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function simpleHash(url: string): string {
  const cleaned = url.replace(/[^a-zA-Z0-9]/g, '');
  return cleaned.slice(-12);
}

/**
 * Fetch RSS XML with browser-like headers, then parse with rss-parser.
 * Reddit blocks requests without proper User-Agent.
 */
async function fetchAndParseFeed(url: string): Promise<RssParser.Output<Record<string, unknown>>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }

    const xml = await response.text();
    const parser = new RssParser();
    return await parser.parseString(xml);
  } finally {
    clearTimeout(timer);
  }
}

export async function collectRedditRss(sources: SourceConfig[]): Promise<StandardItem[]> {
  if (!sources.length) {
    logger.info('No Reddit sources configured, skipping.');
    return [];
  }

  const allItems: StandardItem[] = [];

  for (const source of sources) {
    try {
      logger.info(`Fetching Reddit RSS: ${source.name} (${source.url})`);
      const feed = await fetchAndParseFeed(source.url);
      const feedItems = (feed.items ?? []).slice(0, ITEMS_PER_FEED);

      for (const entry of feedItems) {
        const itemUrl = entry.link ?? '';
        if (!itemUrl) continue;

        const item: StandardItem = {
          id: `reddit-${simpleHash(itemUrl)}`,
          title: entry.title ?? '(untitled)',
          url: itemUrl,
          source: source.name,
          sourceType: 'reddit',
          author: entry.creator ?? entry['dc:creator'] as string | undefined,
          publishedAt: parseDate(entry.pubDate ?? entry.isoDate),
          fetchedAt: nowISO(),
          summary: entry.contentSnippet ?? entry.content,
          tags: [],
          relevanceScore: 0,
          raw: entry,
        };

        allItems.push(item);
      }

      logger.info(`Collected ${feedItems.length} items from Reddit: ${source.name}`);
    } catch (error) {
      logger.warn(`Failed to fetch Reddit RSS for ${source.name}:`, error);
    }
  }

  logger.info(`Total Reddit items collected: ${allItems.length}`);
  return allItems;
}
