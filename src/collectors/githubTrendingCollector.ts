import * as cheerio from 'cheerio';
import { StandardItem, SourceConfig } from '../types/item.js';
import { logger } from '../utils/logger.js';
import { nowISO } from '../utils/date.js';

const ITEMS_PER_PAGE = 20;
const FETCH_TIMEOUT_MS = 15_000;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchPage(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function parseTrendingPage(html: string, sourceName: string): StandardItem[] {
  const $ = cheerio.load(html);
  const items: StandardItem[] = [];

  $('article.Box-row').each((_index, element) => {
    if (items.length >= ITEMS_PER_PAGE) return false; // break

    try {
      const el = $(element);

      // Repo name & link
      const repoLink = el.find('h2 a');
      const href = repoLink.attr('href')?.trim();
      if (!href) return; // continue

      const parts = href.replace(/^\//, '').split('/');
      if (parts.length < 2) return;
      const [owner, repo] = parts;

      // Description
      const description = el.find('p.col-9').text().trim() || undefined;

      // Language
      const language = el.find("span[itemprop='programmingLanguage']").text().trim() || undefined;

      // Stars today
      const starsToday = el
        .find('span.d-inline-block.float-sm-right')
        .last()
        .text()
        .trim();
      const starsTodayCount = parseInt(starsToday.replace(/[^0-9]/g, ''), 10) || undefined;

      // Total stars — find the <a> with an SVG containing .octicon-star
      let totalStars: number | undefined;
      el.find('a.Link--muted').each((_i, aEl) => {
        const a = $(aEl);
        if (a.find('svg.octicon-star').length > 0) {
          const text = a.text().trim().replace(/,/g, '');
          totalStars = parseInt(text, 10) || undefined;
          return false; // break
        }
      });

      const tags: string[] = [];
      if (language) tags.push(language);

      const item: StandardItem = {
        id: `gh-${owner}-${repo}`,
        title: `${owner}/${repo}`,
        url: `https://github.com${href}`,
        source: sourceName,
        sourceType: 'github_trending',
        fetchedAt: nowISO(),
        summary: description,
        score: totalStars,
        tags,
        relevanceScore: 0,
        raw: {
          owner,
          repo,
          language,
          totalStars,
          starsTodayCount,
          description,
        },
      };

      items.push(item);
    } catch (error) {
      logger.warn('Failed to parse a GitHub trending row:', error);
    }
  });

  return items;
}

export async function collectGitHubTrending(sources: SourceConfig[]): Promise<StandardItem[]> {
  if (!sources.length) {
    logger.info('No GitHub Trending sources configured, skipping.');
    return [];
  }

  const allItems: StandardItem[] = [];

  for (const source of sources) {
    try {
      logger.info(`Fetching GitHub Trending: ${source.name} (${source.url})`);
      const html = await fetchPage(source.url);
      const items = parseTrendingPage(html, source.name);
      allItems.push(...items);
      logger.info(`Collected ${items.length} repos from GitHub Trending: ${source.name}`);
    } catch (error) {
      logger.warn(`Failed to fetch GitHub Trending for ${source.name}:`, error);
      // Return empty for this page, never crash the pipeline
    }
  }

  logger.info(`Total GitHub Trending items collected: ${allItems.length}`);
  return allItems;
}
