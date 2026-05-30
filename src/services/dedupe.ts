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

function titleFingerprint(title: string): string {
  return normalizeTitle(title)
    .split(' ')
    .filter((w) => w.length > 3)
    .sort()
    .join(' ');
}

/**
 * Deduplicate items:
 * - By URL within the current batch (keep first occurrence)
 * - By normalized Title within the current batch (exact and fuzzy)
 * - Against history URLs (remove items whose URL is already in history)
 */
export function dedupeItems(items: StandardItem[], history: HistoryData): StandardItem[] {
  const before = items.length;
  const seenUrls = new Set<string>();
  const seenTitleKeys = new Set<string>();
  const seenFuzzyKeys = new Set<string>();
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
    const exactKey = normalizeTitle(item.title);
    const fuzzyKey = titleFingerprint(item.title);

    if (exactKey && seenTitleKeys.has(exactKey)) {
      logger.debug('Dropping duplicate exact Title item in batch', { title: item.title });
      return false;
    }
    if (fuzzyKey && seenFuzzyKeys.has(fuzzyKey)) {
      logger.debug('Dropping duplicate fuzzy Title item in batch', { title: item.title });
      return false;
    }

    seenUrls.add(item.url);
    if (exactKey) seenTitleKeys.add(exactKey);
    if (fuzzyKey) seenFuzzyKeys.add(fuzzyKey);
    return true;
  });

  const after = deduped.length;
  if (before !== after) {
    logger.info(`Deduped items: ${before} → ${after} (removed ${before - after})`);
  }

  return deduped;
}
