import type { StandardItem } from '../types/item.js';
import { todayDateString } from '../utils/date.js';

function escapeMarkdown(text: string): string {
  return text.replace(/\[/g, '\\[').replace(/\]/g, '\\]');
}

export function generateMarkdownDigest(
  items: StandardItem[],
  stats: { totalCollected: number; afterDedupe: number; afterFilter: number }
): string {
  const dateStr = todayDateString();
  const lines: string[] = [];

  const painPoints = items.filter((i) => i.tags.includes('pain-point'));
  const startupIdeas = items.filter((i) => i.tags.includes('startup-idea'));
  const saas = items.filter((i) => i.tags.includes('saas'));
  const newTech = items.filter((i) => i.tags.includes('new-tech'));
  const devTools = items.filter((i) => i.tags.includes('developer-tool'));
  const marketing = items.filter((i) => i.tags.includes('marketing'));
  const launches = items.filter((i) => i.tags.includes('launch'));
  
  const highValueItems = items.filter((i) => (i.scores?.finalScore ?? 0) >= 30);

  // Title
  lines.push(`# 🛰️ Daily Startup Radar - ${dateStr}\n`);

  // 1. Executive Summary
  lines.push('## 1. Executive Summary\n');
  lines.push(`- Total collected: ${stats.totalCollected}`);
  lines.push(`- After dedupe: ${stats.afterDedupe}`);
  lines.push(`- After filtering: ${stats.afterFilter}`);
  lines.push(`- High-value items (finalScore >= 30): ${highValueItems.length}`);
  lines.push(`- Pain point signals: ${painPoints.length}`);
  lines.push(`- Startup idea signals: ${startupIdeas.length}`);
  lines.push(`- SaaS opportunity signals: ${saas.length}`);
  lines.push(`- New tech trends: ${newTech.length}\n`);

  // 2. Best Opportunities Today
  lines.push('## 2. 🏆 Best Opportunities Today\n');
  const top10 = items.slice(0, 10);
  if (top10.length === 0) {
    lines.push('_No items in this category._\n');
  } else {
    top10.forEach((item, index) => {
      const score = item.scores?.finalScore ?? 0;
      const reasons = item.scores?.reasons?.slice(0, 3).join(' | ') ?? 'No reason provided';
      const tags = item.tags.length > 0 ? item.tags.join(', ') : 'none';
      lines.push(`### ${index + 1}. [${escapeMarkdown(item.title)}](${item.url})`);
      lines.push(`- **Source**: ${item.source} | **Score**: ${score}`);
      lines.push(`- **Tags**: ${tags}`);
      lines.push(`- **Why**: ${reasons}\n`);
    });
  }

  // Helper for generating lists
  const renderList = (
    list: StandardItem[], 
    sortFn: (a: StandardItem, b: StandardItem) => number, 
    formatFn: (i: StandardItem) => string
  ) => {
    if (list.length === 0) {
      lines.push('_No items in this category._\n');
      return;
    }
    const sorted = [...list].sort(sortFn);
    sorted.forEach((item) => {
      lines.push(formatFn(item));
    });
    lines.push('');
  };

  // 3. User Pain Points
  lines.push('## 3. 🔥 User Pain Points\n');
  renderList(
    painPoints,
    (a, b) => (b.scores?.painScore ?? 0) - (a.scores?.painScore ?? 0),
    (item) => {
      const snippet = item.summary ? ` | ${item.summary.substring(0, 100).replace(/\n/g, ' ')}...` : '';
      return `- [${escapeMarkdown(item.title)}](${item.url}) — ${item.source} | Pain: ${item.scores?.painScore ?? 0}${snippet}`;
    }
  );

  // 4. SaaS & Startup Ideas
  lines.push('## 4. 💡 SaaS & Startup Ideas\n');
  const saasStartup = Array.from(new Set([...startupIdeas, ...saas]));
  renderList(
    saasStartup,
    (a, b) => ((b.scores?.startupScore ?? 0) + (b.scores?.saasScore ?? 0)) - ((a.scores?.startupScore ?? 0) + (a.scores?.saasScore ?? 0)),
    (item) => `- [${escapeMarkdown(item.title)}](${item.url}) — ${item.source} | Startup: ${item.scores?.startupScore ?? 0} | SaaS: ${item.scores?.saasScore ?? 0}`
  );

  // 5. New Technology Trends
  lines.push('## 5. 🚀 New Technology Trends\n');
  renderList(
    newTech,
    (a, b) => (b.scores?.trendScore ?? 0) - (a.scores?.trendScore ?? 0),
    (item) => `- [${escapeMarkdown(item.title)}](${item.url}) — ${item.source} | Trend: ${item.scores?.trendScore ?? 0}`
  );

  // 6. Developer Tool Opportunities
  lines.push('## 6. 🛠️ Developer Tool Opportunities\n');
  renderList(
    devTools,
    (a, b) => (b.scores?.devtoolScore ?? 0) - (a.scores?.devtoolScore ?? 0),
    (item) => `- [${escapeMarkdown(item.title)}](${item.url}) — ${item.source} | DevTool: ${item.scores?.devtoolScore ?? 0}`
  );

  // 7. Marketing & Distribution
  lines.push('## 7. 📈 Marketing & Distribution\n');
  renderList(
    marketing,
    (a, b) => (b.scores?.marketingScore ?? 0) - (a.scores?.marketingScore ?? 0),
    (item) => `- [${escapeMarkdown(item.title)}](${item.url}) — ${item.source} | Marketing: ${item.scores?.marketingScore ?? 0}`
  );

  // 8. New Products & Launches
  lines.push('## 8. 🚢 New Products & Launches\n');
  renderList(
    launches,
    (a, b) => (b.scores?.finalScore ?? 0) - (a.scores?.finalScore ?? 0),
    (item) => `- [${escapeMarkdown(item.title)}](${item.url}) — ${item.source}`
  );

  // 9. GitHub Trending Watch
  lines.push('## 9. 📊 GitHub Trending Watch\n');
  const ghItems = items.filter((i) => i.sourceType === 'github_trending');
  renderList(
    ghItems,
    (a, b) => (b.score ?? 0) - (a.score ?? 0),
    (item) => `- [${escapeMarkdown(item.title)}](${item.url}) — ${item.summary ?? ''} | ⭐ ${item.score ?? 0}`
  );

  // 10. Raw Source Highlights
  lines.push('## 10. 📰 Raw Source Highlights\n');
  
  lines.push('#### Hacker News');
  const hnItems = items.filter((i) => i.sourceType === 'hacker_news').sort((a, b) => (b.scores?.authorityScore ?? 0) - (a.scores?.authorityScore ?? 0)).slice(0, 15);
  if (hnItems.length === 0) lines.push('_No items._');
  hnItems.forEach((i) => lines.push(`- [${escapeMarkdown(i.title)}](${i.url}) — ⬆ ${i.score ?? 0} / 💬 ${i.commentsCount ?? 0}`));
  lines.push('');

  lines.push('#### Reddit');
  const redditItems = items.filter((i) => i.sourceType === 'reddit' || i.sourceType === 'reddit_search').slice(0, 15);
  if (redditItems.length === 0) lines.push('_No items._');
  redditItems.forEach((i) => lines.push(`- [${escapeMarkdown(i.title)}](${i.url}) — ${i.source}`));
  lines.push('');

  lines.push('#### RSS / Blogs');
  const rssItems = items.filter((i) => i.sourceType === 'rss').slice(0, 10);
  if (rssItems.length === 0) lines.push('_No items._');
  rssItems.forEach((i) => lines.push(`- [${escapeMarkdown(i.title)}](${i.url}) — ${i.source}`));
  lines.push('');

  // 11. Action Items
  lines.push('## 11. ✅ Action Items\n');
  if (painPoints.length > 0) {
    lines.push('- Research the top pain point from Reddit and check existing competitors');
  }
  if (launches.length > 0) {
    lines.push('- Analyze the best Show HN/launch for marketing angles');
  }
  lines.push('- Review the top 3 opportunities and draft one landing page angle\n');

  return lines.join('\n');
}
