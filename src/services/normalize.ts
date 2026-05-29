import type { StandardItem } from '../types/item.js';
import { nowISO } from '../utils/date.js';
import { logger } from '../utils/logger.js';

/**
 * Normalize an array of StandardItems to ensure consistent fields.
 *
 * - Trims title and url
 * - Defaults empty tags array
 * - Defaults relevanceScore to 0
 * - Defaults fetchedAt to nowISO() if missing
 * - Removes items with empty title or url
 * - Ensures url starts with http:// or https://
 */
export function normalizeItems(items: StandardItem[]): StandardItem[] {
  const before = items.length;

  const normalized = items
    .map((item) => ({
      ...item,
      title: item.title?.trim() ?? '',
      url: item.url?.trim() ?? '',
      tags: Array.isArray(item.tags) ? item.tags : [],
      relevanceScore: item.relevanceScore ?? 0,
      fetchedAt: item.fetchedAt || nowISO(),
    }))
    .filter((item) => {
      if (!item.title) {
        logger.debug('Dropping item with empty title', { id: item.id });
        return false;
      }
      if (!item.url) {
        logger.debug('Dropping item with empty url', { id: item.id });
        return false;
      }
      if (!item.url.startsWith('http://') && !item.url.startsWith('https://')) {
        logger.debug('Dropping item with invalid url scheme', { id: item.id, url: item.url });
        return false;
      }
      return true;
    });

  const after = normalized.length;
  if (before !== after) {
    logger.info(`Normalized items: ${before} → ${after} (removed ${before - after})`);
  }

  return normalized;
}
