import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

import type { SourcesConfig, KeywordsConfig } from './types/item.js';
import { logger } from './utils/logger.js';
import { todayDateString } from './utils/date.js';

// Collectors
import { collectHackerNews } from './collectors/hackerNewsCollector.js';
import { collectRedditRss } from './collectors/redditRssCollector.js';
import { collectRss } from './collectors/rssCollector.js';
import { collectGitHubTrending } from './collectors/githubTrendingCollector.js';

// Services
import { normalizeItems } from './services/normalize.js';
import { dedupeItems } from './services/dedupe.js';
import { tagItems } from './services/tagger.js';
import { rankItems } from './services/rank.js';
import { loadHistory, updateHistory } from './services/historyStore.js';
import { generateMarkdownDigest } from './services/markdownDigest.js';

async function loadJson<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

async function main(): Promise<void> {
  const startTime = Date.now();
  logger.info('=== Startup Radar — Daily Digest ===');
  logger.info(`Date: ${todayDateString()}`);

  // 1. Load configuration
  logger.info('Loading configuration...');
  const configDir = path.join(process.cwd(), 'config');
  const sourcesConfig = await loadJson<SourcesConfig>(path.join(configDir, 'sources.json'));
  const keywordsConfig = await loadJson<KeywordsConfig>(path.join(configDir, 'keywords.json'));

  // 2. Collect data from all sources concurrently
  logger.info('Collecting data from all sources...');
  const [hnItems, redditItems, rssItems, githubItems] = await Promise.all([
    collectHackerNews(sourcesConfig.hackerNews),
    collectRedditRss(sourcesConfig.reddit),
    collectRss(sourcesConfig.rss),
    collectGitHubTrending(sourcesConfig.githubTrending),
  ]);

  const allItems = [...hnItems, ...redditItems, ...rssItems, ...githubItems];
  const totalCollected = allItems.length;
  logger.info(`Total items collected: ${totalCollected}`);
  logger.info(`  Hacker News: ${hnItems.length}`);
  logger.info(`  Reddit: ${redditItems.length}`);
  logger.info(`  RSS: ${rssItems.length}`);
  logger.info(`  GitHub Trending: ${githubItems.length}`);

  // 3. Normalize
  logger.info('Normalizing items...');
  const normalized = normalizeItems(allItems);

  // 4. Load history and dedupe
  logger.info('Loading history and deduplicating...');
  const history = await loadHistory();
  const deduped = dedupeItems(normalized, history);
  const afterDedupe = deduped.length;

  // 5. Tag items
  logger.info('Tagging items...');
  const tagged = tagItems(deduped, keywordsConfig);

  // 6. Rank items
  logger.info('Ranking items...');
  const ranked = rankItems(tagged, keywordsConfig);

  // 7. Save raw data
  logger.info('Saving raw data...');
  const rawDir = path.join(process.cwd(), 'data', 'raw');
  await mkdir(rawDir, { recursive: true });
  const rawPath = path.join(rawDir, `${todayDateString()}.json`);
  await writeFile(rawPath, JSON.stringify(ranked, null, 2) + '\n', 'utf-8');
  logger.info(`Raw data saved to ${rawPath}`);

  // 8. Update history
  logger.info('Updating history...');
  await updateHistory(history, ranked);

  // 9. Generate Markdown digest
  logger.info('Generating Markdown digest...');
  const markdown = generateMarkdownDigest(ranked, { totalCollected, afterDedupe });

  // 10. Save digest
  const outputDir = path.join(process.cwd(), 'output');
  await mkdir(outputDir, { recursive: true });
  const digestPath = path.join(outputDir, `${todayDateString()}.md`);
  await writeFile(digestPath, markdown, 'utf-8');
  logger.info(`Digest saved to ${digestPath}`);

  const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
  logger.info(`=== Done in ${elapsedSeconds}s ===`);
}

main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
