import { StandardItem, KeywordsConfig } from '../types/item.js';
import { logger } from '../utils/logger.js';

const VAGUE_REDDIT_TITLES = new Set([
  'help',
  'question',
  'advice needed',
  'need help',
  'is this good',
  'what do you think',
]);

export function filterItems(items: StandardItem[], keywords: KeywordsConfig): StandardItem[] {
  const mustDrop = (keywords['mustDrop'] ?? []).map((kw) => kw.toLowerCase());
  const mustKeep = (keywords['mustKeep'] ?? []).map((kw) => kw.toLowerCase());
  const painKeywords = (keywords['pain'] ?? []).map((kw) => kw.toLowerCase());

  let droppedByKeyword = 0;
  let droppedByShortTitle = 0;
  let droppedByVagueTitle = 0;

  const filtered = items.filter((item) => {
    const titleLower = item.title.toLowerCase();

    // Rule 1 & 2: mustDrop / mustKeep
    const matchesMustKeep = mustKeep.some((kw) => titleLower.includes(kw));
    const matchesMustDrop = mustDrop.some((kw) => titleLower.includes(kw));

    if (matchesMustDrop && !matchesMustKeep) {
      droppedByKeyword++;
      return false;
    }

    // Rule 3: short title with no engagement signals
    if (item.title.length < 12 && !item.score && !item.commentsCount) {
      droppedByShortTitle++;
      return false;
    }

    // Rule 4: vague Reddit titles (only for reddit / reddit_search)
    if (item.sourceType === 'reddit' || item.sourceType === 'reddit_search') {
      const trimmedLower = item.title.trim().toLowerCase().replace(/[^\w\s]/g, '');
      if (VAGUE_REDDIT_TITLES.has(trimmedLower)) {
        const matchesPain = painKeywords.some((kw) => titleLower.includes(kw));
        if (!matchesPain) {
          droppedByVagueTitle++;
          return false;
        }
      }
    }

    return true;
  });

  const totalDropped = droppedByKeyword + droppedByShortTitle + droppedByVagueTitle;
  if (totalDropped > 0) {
    logger.info(
      `Filter: dropped ${totalDropped} items — ` +
        `keyword: ${droppedByKeyword}, short title: ${droppedByShortTitle}, vague title: ${droppedByVagueTitle}`
    );
  } else {
    logger.info('Filter: no items dropped');
  }
  logger.info(`Filter: ${filtered.length} items remaining (from ${items.length})`);

  return filtered;
}
