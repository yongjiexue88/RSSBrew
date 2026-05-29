import type { StandardItem, KeywordsConfig } from '../types/item.js';
import { isWithinHours } from '../utils/date.js';
import { logger } from '../utils/logger.js';

/**
 * Check whether any keyword in the given list matches the text (case-insensitive).
 */
function matchesAnyKeyword(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

/**
 * Calculate relevanceScore for each item and sort by relevance descending,
 * then by score (e.g. HN upvotes) descending as a tiebreaker.
 */
export function rankItems(items: StandardItem[], keywords: KeywordsConfig): StandardItem[] {
  const painPointKeywords = keywords['painPoint'] ?? [];
  const startupIdeaKeywords = keywords['startupIdea'] ?? [];
  const marketingKeywords = keywords['marketing'] ?? [];

  const ranked = items.map((item) => {
    let relevance = 0;
    const titleLower = item.title.toLowerCase();

    // Source bonuses
    if (item.sourceType === 'reddit') {
      relevance += 3;
    }
    if (item.sourceType === 'github_trending') {
      relevance += 2;
    }

    // Keyword category bonuses (checked against title)
    if (matchesAnyKeyword(item.title, painPointKeywords)) {
      relevance += 5;
    }
    if (matchesAnyKeyword(item.title, startupIdeaKeywords)) {
      relevance += 4;
    }
    if (matchesAnyKeyword(item.title, marketingKeywords)) {
      relevance += 4;
    }

    // HN engagement bonus
    if (item.sourceType === 'hacker_news' && (item.commentsCount ?? 0) > 100) {
      relevance += 3;
    }

    // Title phrase bonuses
    if (titleLower.includes('alternative')) {
      relevance += 5;
    }
    if (titleLower.includes('how do you')) {
      relevance += 4;
    }
    if (titleLower.includes('looking for')) {
      relevance += 4;
    }

    // Recency bonus
    if (isWithinHours(item.publishedAt, 48)) {
      relevance += 2;
    }

    return {
      ...item,
      relevanceScore: relevance,
    };
  });

  // Sort by relevanceScore descending, then by score descending as tiebreaker
  ranked.sort((a, b) => {
    const relevanceDiff = b.relevanceScore - a.relevanceScore;
    if (relevanceDiff !== 0) return relevanceDiff;
    return (b.score ?? 0) - (a.score ?? 0);
  });

  logger.info(
    `Ranked ${ranked.length} items. Top score: ${ranked[0]?.relevanceScore ?? 0}`
  );

  return ranked;
}
