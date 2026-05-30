import type { StandardItem } from '../types/item.js';
import { todayDateString } from '../utils/date.js';

function escapeMarkdownText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\|/g, '\\|');
}

function inferCustomer(item: StandardItem): string {
  const text = `${item.title} ${item.summary ?? ''}`.toLowerCase();

  if (text.includes('shopify') || text.includes('ecommerce')) return 'Ecommerce operators';
  if (text.includes('payroll') || text.includes('contractor')) return 'Ops/finance teams managing contractors';
  if (text.includes('property manager')) return 'Property managers';
  if (text.includes('agency') || text.includes('clients')) return 'Agencies / freelancers';
  if (text.includes('audit') || text.includes('compliance')) return 'Compliance-heavy teams';
  if (text.includes('bookkeeping') || text.includes('invoice')) return 'Finance / accounting teams';

  return item.category ? `Unclear, source category: ${item.category}` : 'Unclear';
}

export function generateMarkdownDigest(
  items: StandardItem[],
  stats: { totalCollected: number; afterDedupe: number; afterFilter: number }
): string {
  const dateStr = todayDateString();
  const lines: string[] = [];

  const topOpportunities = items.filter(
    (i) =>
      (i.scores?.finalScore ?? 0) >= 30 &&
      (i.scores?.buyerIntentScore ?? 0) >= 8 &&
      (i.scores?.workflowContextScore ?? 0) >= 4 &&
      (i.scores?.promoPenalty ?? 0) <= 10 &&
      (i.scores?.junkPenalty ?? 0) <= 5 &&
      i.tags.includes('pain-point')
  );
  
  const topOppIds = new Set(topOpportunities.map((i) => i.id));
  
  const painPoints = items.filter((i) => i.tags.includes('pain-point') && !topOppIds.has(i.id));
  const competitors = items.filter((i) => i.tags.includes('launch') || i.sourceType === 'github_trending');
  const marketing = items.filter((i) => i.tags.includes('marketing'));
  const newTech = items.filter((i) => i.tags.includes('new-tech'));

  // Title
  lines.push(`# 🛰️ Daily Startup Radar - ${dateStr}\n`);

  // 1. Executive Summary
  lines.push('## 1. Executive Summary\n');
  lines.push(`- Total collected: ${stats.totalCollected}`);
  lines.push(`- After dedupe: ${stats.afterDedupe}`);
  lines.push(`- After filtering: ${stats.afterFilter}`);
  lines.push(`- High-Value Opportunities (Score 30+): ${topOpportunities.length}\n`);

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
    sorted.slice(0, 10).forEach((item) => {
      lines.push(formatFn(item));
    });
    lines.push('');
  };

  // 2. Top Buildable Opportunities
  lines.push('## 2. 🏆 Top Buildable Opportunities\n');
  const sortedTop = [...topOpportunities].sort((a, b) => (b.scores?.finalScore ?? 0) - (a.scores?.finalScore ?? 0));
  if (sortedTop.length === 0) {
    lines.push('_No highly qualified intent signals today._\n');
  } else {
    sortedTop.slice(0, 10).forEach((item, index) => {
      const intentLevel = (item.scores?.buyerIntentScore ?? 0) >= 15 ? 'High' : 'Medium';
      const snippet = item.summary ? escapeMarkdownText(item.summary.substring(0, 300).replace(/\n/g, ' ')) : 'No description available';
      
      lines.push(`### ${index + 1}. [${escapeMarkdownText(item.title)}](${item.url})`);
      lines.push(`- **Customer/Niche:** ${escapeMarkdownText(inferCustomer(item))}`);
      lines.push(`- **Context:** ${snippet}...`);
      lines.push(`- **Buyer Intent:** ${intentLevel}`);
      lines.push(`- **Scores:** Final ${item.scores?.finalScore ?? 0} | Intent ${item.scores?.buyerIntentScore ?? 0} | Pain ${item.scores?.painScore ?? 0} | Promo Penalty ${item.scores?.promoPenalty ?? 0}`);
      lines.push(`- **Why it matters:** Found via ${escapeMarkdownText(item.source)}\n`);
    });
  }

  // 3. User Pain Points
  lines.push('## 3. 🔥 Strong Pain Points\n');
  renderList(
    painPoints,
    (a, b) => (b.scores?.painScore ?? 0) - (a.scores?.painScore ?? 0),
    (item) => {
      const snippet = item.summary ? ` | ${item.summary.substring(0, 100).replace(/\n/g, ' ')}...` : '';
      return `- [${escapeMarkdownText(item.title)}](${item.url}) — ${escapeMarkdownText(item.source)} | Pain: ${item.scores?.painScore ?? 0}${snippet}`;
    }
  );

  // 4. Existing Products / Competitors
  lines.push('## 4. 📦 Existing Products & Competitors\n');
  renderList(
    competitors,
    (a, b) => (b.scores?.authorityScore ?? 0) - (a.scores?.authorityScore ?? 0),
    (item) => `- [${escapeMarkdownText(item.title)}](${item.url}) — ${escapeMarkdownText(item.source)} | Authority: ${item.scores?.authorityScore ?? 0}`
  );

  // 5. Marketing & Distribution
  lines.push('## 5. 📈 Distribution & Marketing Lessons\n');
  renderList(
    marketing,
    (a, b) => (b.scores?.marketingScore ?? 0) - (a.scores?.marketingScore ?? 0),
    (item) => `- [${escapeMarkdownText(item.title)}](${item.url}) — ${escapeMarkdownText(item.source)} | Marketing: ${item.scores?.marketingScore ?? 0}`
  );

  // 6. New Technology Trends
  lines.push('## 6. 🚀 Tech Trends Worth Watching\n');
  renderList(
    newTech,
    (a, b) => (b.scores?.trendScore ?? 0) - (a.scores?.trendScore ?? 0),
    (item) => `- [${escapeMarkdownText(item.title)}](${item.url}) — ${escapeMarkdownText(item.source)} | Trend: ${item.scores?.trendScore ?? 0}`
  );

  // 7. Action Items
  lines.push('## 7. ✅ Action Items\n');
  if (topOpportunities.length > 0) {
    lines.push('- Review the top 3 buildable opportunities and draft one landing page angle');
  }
  if (painPoints.length > 0) {
    lines.push('- Research the top raw pain point and check existing competitors');
  }
  lines.push('');

  return lines.join('\n');
}
