import type { StandardItem } from '../types/item.js';
import { todayDateString } from '../utils/date.js';

/**
 * Generate the daily digest as a Markdown string.
 */
export function generateMarkdownDigest(
  items: StandardItem[],
  stats: { totalCollected: number; afterDedupe: number }
): string {
  const date = todayDateString();
  const sections: string[] = [];

  // Gather source names
  const sourceNames = [...new Set(items.map((i) => i.source))];
  const sourcesStr = sourceNames.length > 0 ? sourceNames.join(', ') : 'none';

  // Pre-compute groups
  const highRelevance = items.filter((i) => i.relevanceScore >= 8);
  const painPoints = items.filter((i) => i.tags.includes('painPoint'));
  const startupIdeas = items.filter((i) => i.tags.includes('startupIdea'));

  const hnItems = items.filter((i) => i.sourceType === 'hacker_news');
  const redditItems = items.filter((i) => i.sourceType === 'reddit');
  const githubItems = items.filter((i) => i.sourceType === 'github_trending');
  const rssItems = items.filter((i) => i.sourceType === 'rss');

  // --- Title ---
  sections.push(`# Daily Startup Radar - ${date}`);

  // --- 1. Executive Summary ---
  sections.push(`## 1. Executive Summary

Today's digest collected items from ${sourcesStr}.

- Total items collected: ${stats.totalCollected}
- After dedupe: ${stats.afterDedupe}
- High relevance items (score >= 8): ${highRelevance.length}
- Items tagged as pain points: ${painPoints.length}
- Items tagged as startup ideas: ${startupIdeas.length}`);

  // --- 2. Top Items by Relevance ---
  const topItems = [...items]
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 10);

  sections.push(`## 2. Top Items by Relevance

${topItems.length === 0 ? '_No items._' : topItems.map((item, idx) => {
    const tags = item.tags.length > 0 ? ` | Tags: ${item.tags.join(', ')}` : '';
    return `${idx + 1}. **[${escapeMarkdown(item.title)}](${item.url})** — ${item.source} | Relevance: ${item.relevanceScore}${item.score != null ? ` | ⬆ ${item.score}` : ''}${tags}`;
  }).join('\n')}`);

  // --- 3. Hacker News Watch ---
  const hnSorted = [...hnItems].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  sections.push(`## 3. Hacker News Watch

${hnSorted.length === 0 ? '_No Hacker News items._' : hnSorted.map((item) =>
    `- [${escapeMarkdown(item.title)}](${item.url}) — ⬆ ${item.score ?? 0} / 💬 ${item.commentsCount ?? 0}`
  ).join('\n')}`);

  // --- 4. Reddit Watch ---
  sections.push(`## 4. Reddit Watch

${redditItems.length === 0 ? '_No Reddit items._' : redditItems.map((item) =>
    `- [${escapeMarkdown(item.title)}](${item.url}) — ${item.source}`
  ).join('\n')}`);

  // --- 5. GitHub Trending Watch ---
  sections.push(`## 5. GitHub Trending Watch

${githubItems.length === 0 ? '_No GitHub Trending items._' : githubItems.map((item) => {
    const desc = item.summary ? ` — ${item.summary}` : '';
    return `- [${escapeMarkdown(item.title)}](${item.url})${desc}`;
  }).join('\n')}`);

  // --- 6. RSS / Company Blog Watch ---
  sections.push(`## 6. RSS / Company Blog Watch

${rssItems.length === 0 ? '_No RSS items._' : rssItems.map((item) =>
    `- [${escapeMarkdown(item.title)}](${item.url}) — ${item.source}`
  ).join('\n')}`);

  // --- 7. Pain Point Signals ---
  sections.push(`## 7. Pain Point Signals

${painPoints.length === 0 ? '_No pain point signals detected._' : painPoints.map((item) =>
    `- [${escapeMarkdown(item.title)}](${item.url}) — ${item.source} | Relevance: ${item.relevanceScore}`
  ).join('\n')}`);

  // --- 8. Startup Idea Signals ---
  sections.push(`## 8. Startup Idea Signals

${startupIdeas.length === 0 ? '_No startup idea signals detected._' : startupIdeas.map((item) =>
    `- [${escapeMarkdown(item.title)}](${item.url}) — ${item.source} | Relevance: ${item.relevanceScore}`
  ).join('\n')}`);

  // --- 9. All Items ---
  const allItemsSection = buildAllItemsSection(items, hnItems, redditItems, githubItems, rssItems);
  sections.push(allItemsSection);

  return sections.join('\n\n') + '\n';
}

/**
 * Build the "All Items" section grouped by source type.
 */
function buildAllItemsSection(
  _allItems: StandardItem[],
  hnItems: StandardItem[],
  redditItems: StandardItem[],
  githubItems: StandardItem[],
  rssItems: StandardItem[]
): string {
  const groups: { label: string; items: StandardItem[] }[] = [
    { label: 'Hacker News', items: hnItems },
    { label: 'Reddit', items: redditItems },
    { label: 'GitHub Trending', items: githubItems },
    { label: 'RSS / Blogs', items: rssItems },
  ];

  const subSections = groups
    .filter((g) => g.items.length > 0)
    .map((g) => {
      const itemList = g.items
        .map(
          (item) =>
            `- [${escapeMarkdown(item.title)}](${item.url}) — ${item.source} | Relevance: ${item.relevanceScore}`
        )
        .join('\n');
      return `### ${g.label}\n\n${itemList}`;
    });

  return `## 9. All Items\n\n${subSections.length === 0 ? '_No items._' : subSections.join('\n\n')}`;
}

/**
 * Escape markdown special characters in link text to prevent broken links.
 */
function escapeMarkdown(text: string): string {
  return text.replace(/\[/g, '\\[').replace(/\]/g, '\\]');
}
