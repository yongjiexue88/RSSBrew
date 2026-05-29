import type { StandardItem, KeywordsConfig } from '../types/item.js';
import { logger } from '../utils/logger.js';

/**
 * Tag items using keywords configuration.
 *
 * For each item, checks title (and summary if exists) against each keyword
 * category. Uses case-insensitive matching. Adds matching category names to
 * item.tags without duplicates.
 */
export function tagItems(items: StandardItem[], keywords: KeywordsConfig): StandardItem[] {
  return items.map((item) => {
    const textToSearch = [
      item.title.toLowerCase(),
      item.summary?.toLowerCase() ?? '',
    ].join(' ');

    const newTags = new Set<string>(item.tags);

    for (const [category, categoryKeywords] of Object.entries(keywords)) {
      for (const keyword of categoryKeywords) {
        if (textToSearch.includes(keyword.toLowerCase())) {
          newTags.add(category);
          break; // One match per category is sufficient
        }
      }
    }

    const addedTags = [...newTags].filter((t) => !item.tags.includes(t));
    if (addedTags.length > 0) {
      logger.debug(`Tagged "${item.title}" with: ${addedTags.join(', ')}`);
    }

    return {
      ...item,
      tags: [...newTags],
    };
  });
}
