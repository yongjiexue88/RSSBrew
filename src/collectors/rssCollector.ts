import RssParser from 'rss-parser';
import { StandardItem, SourceConfig } from '../types/item.js';
import { logger } from '../utils/logger.js';
import { nowISO, parseDate } from '../utils/date.js';

const ITEMS_PER_FEED = 10;
const FETCH_TIMEOUT_MS = 15_000;
const USER_AGENT = 'startup-radar/0.1 (RSS reader)';

function simpleHash(url: string): string {
  const cleaned = url.replace(/[^a-zA-Z0-9]/g, '');
  return cleaned.slice(-12);
}

/**
 * Fetch RSS XML with timeout, then parse with rss-parser.
 */
async function fetchAndParseFeed(url: string): Promise<RssParser.Output<Record<string, unknown>>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
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

export async function collectRss(sources: SourceConfig[]): Promise<StandardItem[]> {
  if (!sources.length) {
    logger.info('No RSS sources configured, skipping.');
    return [];
  }

  const allItems: StandardItem[] = [];

  for (const source of sources) {
    try {
      logger.info(`Fetching RSS feed: ${source.name} (${source.url})`);
      const feed = await fetchAndParseFeed(source.url);
      const feedItems = (feed.items ?? []).slice(0, ITEMS_PER_FEED);

      for (const entry of feedItems) {
        const itemUrl = entry.link ?? '';
        if (!itemUrl) continue;

        // Handle various RSS field names for content/summary
        const rawSummary =
          entry.contentSnippet ??
          entry.content ??
          (entry as Record<string, unknown>)['summary'] as string | undefined ??
          (entry as Record<string, unknown>)['description'] as string | undefined;

        const summary = rawSummary ? rawSummary.substring(0, 500) : undefined;

        const item: StandardItem = {
          id: `rss-${simpleHash(itemUrl)}`,
          title: entry.title ?? '(untitled)',
          url: itemUrl,
          source: source.name,
          sourceType: 'rss',
          author: entry.creator ?? entry['dc:creator'] as string | undefined,
          publishedAt: parseDate(
            entry.pubDate ?? entry.isoDate
          ),
          fetchedAt: nowISO(),
          summary,
          tags: [],
          relevanceScore: 0,
          raw: {
            title: entry.title,
            link: entry.link,
            pubDate: entry.pubDate,
          },
        };

        allItems.push(item);
      }

      logger.info(`Collected ${feedItems.length} items from RSS: ${source.name}`);
    } catch (error) {
      logger.warn(`Failed to fetch RSS feed for ${source.name}:`, error);
    }
  }

  logger.info(`Total RSS items collected: ${allItems.length}`);
  return allItems;
}
