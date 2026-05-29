import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

import type { SourcesConfig, KeywordsConfig } from './types/item.js';
import { logger } from './utils/logger.js';
import { todayDateString } from './utils/date.js';

// Collectors
import { collectHackerNews } from './collectors/hackerNewsCollector.js';
import { collectRedditRss } from './collectors/redditRssCollector.js';
import { collectRedditSearch } from './collectors/redditSearchCollector.js';
import { collectRss } from './collectors/rssCollector.js';
import { collectGitHubTrending } from './collectors/githubTrendingCollector.js';

// Services
import { normalizeItems } from './services/normalize.js';
import { filterItems } from './services/filter.js';
import { tagItems } from './services/tagger.js';
import { rankItems } from './services/rank.js';
import { generateMarkdownDigest } from './services/markdownDigest.js';

async function loadJson<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

async function main(): Promise<void> {
  const startTime = Date.now();
  logger.info('=== Startup Radar v2 — Daily Digest ===');
  logger.info(`Date: ${todayDateString()}`);

  // 1. Load configuration
  logger.info('Loading configuration...');
  const configDir = path.join(process.cwd(), 'config');
  const sourcesConfig = await loadJson<SourcesConfig>(path.join(configDir, 'sources.json'));
  const keywordsConfig = await loadJson<KeywordsConfig>(path.join(configDir, 'keywords.json'));

  // 2. Collect data from all sources concurrently
  logger.info('Collecting data from all sources...');
  const [hnItems, redditItems, redditSearchItems, rssItems, githubItems] = await Promise.all([
    collectHackerNews(sourcesConfig.hackerNews),
    collectRedditRss(sourcesConfig.reddit),
    collectRedditSearch(sourcesConfig.redditSearch),
    collectRss(sourcesConfig.rss),
    collectGitHubTrending(sourcesConfig.githubTrending),
  ]);

  const allItems = [
    ...hnItems,
    ...redditItems,
    ...redditSearchItems,
    ...rssItems,
    ...githubItems,
  ];
  const totalCollected = allItems.length;
  logger.info(`Total items collected: ${totalCollected}`);
  logger.info(`  Hacker News: ${hnItems.length}`);
  logger.info(`  Reddit subs: ${redditItems.length}`);
  logger.info(`  Reddit search: ${redditSearchItems.length}`);
  logger.info(`  RSS: ${rssItems.length}`);
  logger.info(`  GitHub Trending: ${githubItems.length}`);

  // 3. Normalize
  logger.info('Normalizing items...');
  const normalized = normalizeItems(allItems);

  // 4. Dedupe
  logger.info('Skipping history deduplication (snapshot mode)...');
  const deduped = normalized;
  const afterDedupe = deduped.length;

  // 5. Hard filter (remove junk)
  logger.info('Filtering junk items...');
  const filtered = filterItems(deduped, keywordsConfig);
  const afterFilter = filtered.length;

  // 6. Tag items
  logger.info('Tagging items...');
  const tagged = tagItems(filtered, keywordsConfig);

  // 7. Rank items with multi-score system
  logger.info('Ranking items with multi-score system...');
  const ranked = rankItems(tagged, keywordsConfig);

  // 8. Save raw data
  logger.info('Saving raw data...');
  const rawDir = path.join(process.cwd(), 'data', 'raw');
  await mkdir(rawDir, { recursive: true });
  const rawPath = path.join(rawDir, `${todayDateString()}.json`);
  await writeFile(rawPath, JSON.stringify(ranked, null, 2) + '\n', 'utf-8');
  logger.info(`Raw data saved to ${rawPath}`);

  // 9. Update history
  // History tracking disabled to allow daily snapshots of top items

  // 10. Generate Markdown digest
  logger.info('Generating Markdown digest...');
  const markdown = generateMarkdownDigest(ranked, { totalCollected, afterDedupe, afterFilter });

  // 11. Save digest
  const outputDir = path.join(process.cwd(), 'output');
  await mkdir(outputDir, { recursive: true });
  const digestPath = path.join(outputDir, `${todayDateString()}.md`);
  await writeFile(digestPath, markdown, 'utf-8');
  logger.info(`Digest saved to ${digestPath}`);

  // 12. Print summary
  const topItem = ranked[0];
  if (topItem?.scores) {
    logger.info(`Top item: "${topItem.title}" (finalScore: ${topItem.scores.finalScore.toFixed(1)})`);
  }

  const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
  logger.info(`=== Done in ${elapsedSeconds}s ===`);
}

main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
