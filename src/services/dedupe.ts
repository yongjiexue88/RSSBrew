import type { StandardItem, HistoryData } from '../types/item.js';
import { logger } from '../utils/logger.js';

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, '') // Remove [brackets]
    .replace(/\([^)]*\)/g, '')   // Remove (parentheses)
    .replace(/[^a-z0-9\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')        // Normalize spaces
    .trim();
}

/**
 * Deduplicate items:
 * - By URL within the current batch (keep first occurrence)
 * - By normalized Title within the current batch
 * - Against history URLs (remove items whose URL is already in history)
 */
export function dedupeItems(items: StandardItem[], history: HistoryData): StandardItem[] {
  const before = items.length;
  const seenUrls = new Set<string>();
  const seenTitleKeys = new Set<string>();
  const historyUrls = new Set(Object.keys(history.urls));

  const deduped = items.filter((item) => {
    // Check against history
    if (historyUrls.has(item.url)) {
      logger.debug('Dropping item already in history', { url: item.url });
      return false;
    }

    // Check URL within current batch
    if (seenUrls.has(item.url)) {
      logger.debug('Dropping duplicate URL item in batch', { url: item.url });
      return false;
    }

    // Check Title within current batch
    const titleKey = normalizeTitle(item.title);
    if (titleKey && seenTitleKeys.has(titleKey)) {
      logger.debug('Dropping duplicate Title item in batch', { title: item.title });
      return false;
    }

    seenUrls.add(item.url);
    if (titleKey) seenTitleKeys.add(titleKey);
    return true;
  });

  const after = deduped.length;
  if (before !== after) {
    logger.info(`Deduped items: ${before} → ${after} (removed ${before - after})`);
  }

  return deduped;
}
