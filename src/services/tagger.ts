import type { StandardItem, KeywordsConfig } from '../types/item.js';
import { logger } from '../utils/logger.js';

// ── Category → tag mapping ──

const CATEGORY_TAG_MAP: Record<string, string> = {
  painPoint: 'pain-point',
  startupIdea: 'startup-idea',
  saas: 'saas',
  newTech: 'new-tech',
  marketing: 'marketing',
  developerTool: 'developer-tool',
};

/** Categories used for filtering only — not converted to tags. */
const SKIP_CATEGORIES = new Set(['mustDrop', 'mustKeep']);

/** Title phrases that indicate a product launch. */
const LAUNCH_TITLE_PHRASES = ['i built', 'launched', 'mvp', 'waitlist'];

/**
 * Tag items using the keywords configuration.
 *
 * For each item the tagger:
 * 1. Checks title + summary against every keyword category (case-insensitive).
 *    Maps matched categories to tag names via CATEGORY_TAG_MAP.
 * 2. Adds special tags based on source / title content:
 *    - 'launch' when the source contains "Show HN" or the title contains
 *       launch-related phrases.
 *    - 'pain-point' when sourceType is 'reddit_search'.
 */
export function tagItems(items: StandardItem[], keywords: KeywordsConfig): StandardItem[] {
  return items.map((item) => {
    const textToSearch = [
      item.title.toLowerCase(),
      item.summary?.toLowerCase() ?? '',
    ].join(' ');

    const newTags = new Set<string>(item.tags);

    // ── Keyword-based tagging ──
    for (const [category, categoryKeywords] of Object.entries(keywords)) {
      if (SKIP_CATEGORIES.has(category)) continue;

      const tagName = CATEGORY_TAG_MAP[category];
      if (!tagName) continue; // Unknown category — skip

      for (const keyword of categoryKeywords) {
        if (textToSearch.includes(keyword.toLowerCase())) {
          newTags.add(tagName);
          break; // One match per category is sufficient
        }
      }
    }

    // ── Special: launch tag ──
    const sourceLower = item.source.toLowerCase();
    const titleLower = item.title.toLowerCase();

    if (sourceLower.includes('show hn')) {
      newTags.add('launch');
    }

    if (LAUNCH_TITLE_PHRASES.some((phrase) => titleLower.includes(phrase))) {
      newTags.add('launch');
    }

    // ── Special: reddit_search → pain-point ──
    if (item.sourceType === 'reddit_search') {
      newTags.add('pain-point');
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
