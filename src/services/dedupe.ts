import type { StandardItem, HistoryData } from '../types/item.js';
import { logger } from '../utils/logger.js';

/**
 * Deduplicate items:
 * - By URL within the current batch (keep first occurrence)
 * - Against history URLs (remove items whose URL is already in history)
 */
export function dedupeItems(items: StandardItem[], history: HistoryData): StandardItem[] {
  const before = items.length;
  const seenUrls = new Set<string>();
  const historyUrls = new Set(Object.keys(history.urls));

  const deduped = items.filter((item) => {
    // Check against history
    if (historyUrls.has(item.url)) {
      logger.debug('Dropping item already in history', { url: item.url });
      return false;
    }

    // Check within current batch
    if (seenUrls.has(item.url)) {
      logger.debug('Dropping duplicate item in batch', { url: item.url });
      return false;
    }

    seenUrls.add(item.url);
    return true;
  });

  const after = deduped.length;
  if (before !== after) {
    logger.info(`Deduped items: ${before} → ${after} (removed ${before - after})`);
  }

  return deduped;
}
