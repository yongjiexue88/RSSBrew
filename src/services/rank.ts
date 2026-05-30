import type { StandardItem, KeywordsConfig, ScoreBreakdown } from '../types/item.js';
import { isWithinHours } from '../utils/date.js';
import { logger } from '../utils/logger.js';

function computeBuyerIntentScore(text: string): { score: number; matchReasons: string[] } {
  let score = 0;
  const matchReasons: string[] = [];
  const strongSignals: [RegExp, number][] = [
    [/\bwe use spreadsheets?\b/i, 8],
    [/\bcurrently using\b/i, 5],
    [/\bpaying \$?\d+/i, 8],
    [/\btoo expensive\b/i, 6],
    [/\bmanual(ly)?\b/i, 5],
    [/\btakes hours\b/i, 6],
    [/\blooking for a tool\b/i, 8],
    [/\bany recommendations\b/i, 5],
    [/\bwhat do you use\b/i, 5],
    [/\balternative to\b/i, 5],
    [/\bfor my team\b/i, 6],
    [/\bfor my business\b/i, 6],
    [/\bclients?\b/i, 4],
  ];

  for (const [pattern, points] of strongSignals) {
    if (pattern.test(text)) {
      score += points;
      matchReasons.push(`BuyerIntent: matched ${pattern} (+${points})`);
    }
  }

  return { score: Math.min(score, 30), matchReasons };
}

function computePromoPenalty(text: string, source: string): { penalty: number; matchReasons: string[] } {
  let penalty = 0;
  const matchReasons: string[] = [];
  const promoPatterns = [
    /\bcomplete guide\b/i,
    /\bultimate guide\b/i,
    /\bpros and cons\b/i,
    /\bpricing\b/i,
    /\bmy honest review\b/i,
    /\bwe built\b/i,
    /\bi built\b/i,
    /\bpublic beta\b/i,
    /\blifetime premium\b/i,
    /\bfree trial\b/i,
    /\bdevelopment services\b/i,
  ];

  for (const pattern of promoPatterns) {
    if (pattern.test(text)) {
      penalty += 5;
      matchReasons.push(`PromoPenalty: matched ${pattern} (-5)`);
    }
  }

  if (/^u_/.test(source.toLowerCase()) || source.toLowerCase().includes('/u_')) {
    penalty += 8;
    matchReasons.push(`PromoPenalty: user profile source (-8)`);
  }

  return { penalty: Math.min(penalty, 25), matchReasons };
}

/**
 * Check whether any keyword in the given list matches the text (case-insensitive).
 */
function matchesAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

/**
 * Get the combined text to search (title + summary).
 */
function searchText(item: StandardItem): string {
  return [item.title, item.summary ?? ''].join(' ').toLowerCase();
}

function computeScores(item: StandardItem, keywords: KeywordsConfig): ScoreBreakdown {
  const text = searchText(item);
  const titleLower = item.title.toLowerCase();
  const reasons: string[] = [];

  // ── V3 Scores ──
  const { score: buyerIntentScore, matchReasons: buyerReasons } = computeBuyerIntentScore(text);
  reasons.push(...buyerReasons);

  let specificityScore = 0;
  const SPECIFICITY_PATTERNS: [RegExp, number][] = [
    [/\bshopify\b/i, 3],
    [/\becommerce\b/i, 3],
    [/\bbookkeeping\b/i, 4],
    [/\bproperty managers?\b/i, 4],
    [/\bcontractors?\b/i, 4],
    [/\bpayroll\b/i, 4],
    [/\bcompliance\b/i, 4],
    [/\baudit\b/i, 4],
    [/\breal estate\b/i, 3],
    [/\bagency\b/i, 3],
    [/\bclients?\b/i, 2],
    [/\bteam\b/i, 2],
    [/\bworkflow\b/i, 2],
  ];
  for (const [pattern, points] of SPECIFICITY_PATTERNS) {
    if (pattern.test(text)) {
      specificityScore += points;
      reasons.push(`Specificity: matched ${pattern} (+${points})`);
    }
  }

  const { penalty: promoPenalty, matchReasons: promoReasons } = computePromoPenalty(text, item.source);
  reasons.push(...promoReasons);

  let junkPenalty = 0;

  // ── Pain Score ──
  let painScore = 0;
  const painPhrases: [string, number][] = [
    ['looking for a tool', 8],
    ['alternative to', 8],
    ['what do you use for', 7],
    ['how do you automate', 7],
    ['too expensive', 6],
    ['manual process', 5],
    ['spreadsheet', 5],
    ['struggling', 4],
    ['frustrated', 4],
    ['recommend', 3],
  ];
  for (const [phrase, score] of painPhrases) {
    if (text.includes(phrase)) {
      painScore += score;
      reasons.push(`Pain: matched "${phrase}" (+${score})`);
    }
  }
  if (painScore === 0 && matchesAny(text, keywords['painPoint'] ?? [])) {
    painScore += 3;
    reasons.push('Pain: matched painPoint keyword (+3)');
  }
  if (item.sourceType === 'reddit_search') {
    painScore += 3;
    reasons.push('Pain: Reddit search source (+3)');
  }

  // ── Startup Score ──
  let startupScore = 0;
  if (painScore >= 8) {
    startupScore += 5;
    reasons.push('Startup: high pain score (+5)');
  }
  if (/\b(tool|automation|workflow)\b/i.test(titleLower)) {
    startupScore += 4;
    reasons.push('Startup: title contains tool/automation/workflow (+4)');
  }
  if (/\b(dashboard|integration|template|plugin)\b/i.test(titleLower)) {
    startupScore += 3;
    reasons.push('Startup: title contains dashboard/integration/template/plugin (+3)');
  }
  if (item.sourceType === 'reddit' || item.sourceType === 'reddit_search') {
    startupScore += 2;
    reasons.push('Startup: Reddit source (+2)');
  }
  if (item.source.includes('Show HN')) {
    startupScore += 2;
    reasons.push('Startup: Show HN (+2)');
  }
  if (matchesAny(text, keywords['startupIdea'] ?? [])) {
    startupScore += 2;
    reasons.push('Startup: matched startupIdea keyword (+2)');
  }

  // ── SaaS Score ──
  let saasScore = 0;
  const cat = item.category ?? '';
  if (cat === 'business-pain' || cat === 'ecommerce-saas') {
    saasScore += 5;
    reasons.push(`SaaS: category "${cat}" (+5)`);
  }
  if (cat === 'marketing' || cat === 'product') {
    saasScore += 4;
    reasons.push(`SaaS: category "${cat}" (+4)`);
  }
  if (/\b(customer|invoice|billing|dashboard)\b/i.test(titleLower)) {
    saasScore += 4;
    reasons.push('SaaS: title contains customer/invoice/billing/dashboard (+4)');
  }
  if (/\b(crm|reporting)\b/i.test(titleLower)) {
    saasScore += 3;
    reasons.push('SaaS: title contains crm/reporting (+3)');
  }
  if (matchesAny(text, keywords['saas'] ?? [])) {
    saasScore += 2;
    reasons.push('SaaS: matched saas keyword (+2)');
  }

  // ── Trend Score ──
  let trendScore = 0;
  if (/\b(ai agent|agent)\b/i.test(titleLower)) {
    trendScore += 6;
    reasons.push('Trend: title contains agent (+6)');
  }
  if (/\bmcp\b/i.test(titleLower)) {
    trendScore += 6;
    reasons.push('Trend: title contains MCP (+6)');
  }
  if (/\b(rag|local llm|voice ai|browser automation)\b/i.test(titleLower)) {
    trendScore += 5;
    reasons.push('Trend: title contains rag/local llm/voice ai/browser automation (+5)');
  }
  if (/\b(vector database|workflow automation)\b/i.test(titleLower)) {
    trendScore += 4;
    reasons.push('Trend: title contains vector database/workflow automation (+4)');
  }
  if (item.sourceType === 'github_trending') {
    trendScore += 3;
    reasons.push('Trend: GitHub Trending source (+3)');
  }
  if (item.sourceType === 'hacker_news') {
    trendScore += 3;
    reasons.push('Trend: Hacker News source (+3)');
  }
  if (matchesAny(text, keywords['newTech'] ?? [])) {
    trendScore += 2;
    reasons.push('Trend: matched newTech keyword (+2)');
  }

  // ── DevTool Score ──
  let devtoolScore = 0;
  if (matchesAny(text, keywords['developerTool'] ?? [])) {
    devtoolScore += 4;
    reasons.push('DevTool: matched developerTool keyword (+4)');
  }
  if (cat.includes('developer')) {
    devtoolScore += 3;
    reasons.push(`DevTool: category "${cat}" (+3)`);
  }
  if (item.sourceType === 'github_trending') {
    devtoolScore += 2;
    reasons.push('DevTool: GitHub Trending source (+2)');
  }

  // ── Marketing Score ──
  let marketingScore = 0;
  if (/\b(distribution|growth)\b/i.test(titleLower)) {
    marketingScore += 5;
    reasons.push('Marketing: title contains distribution/growth (+5)');
  }
  if (/\b(seo|pricing|landing page|cold email)\b/i.test(titleLower)) {
    marketingScore += 4;
    reasons.push('Marketing: title contains seo/pricing/landing page/cold email (+4)');
  }
  if (cat === 'marketing' || cat === 'distribution') {
    marketingScore += 3;
    reasons.push(`Marketing: category "${cat}" (+3)`);
  }
  if (matchesAny(text, keywords['marketing'] ?? [])) {
    marketingScore += 2;
    reasons.push('Marketing: matched marketing keyword (+2)');
  }

  // ── Authority Score ──
  let authorityScore = 0;
  if (item.sourceType === 'github_trending') {
    authorityScore = Math.min(10, Math.log10((item.score ?? 0) + 1) * 2);
  } else {
    authorityScore = Math.min(10, Math.log10((item.score ?? 0) + 1) * 3);
  }
  authorityScore += Math.min(5, Math.log10((item.commentsCount ?? 0) + 1) * 2);
  if (authorityScore > 0.5) {
    reasons.push(`Authority: score ${item.score ?? 0}, comments ${item.commentsCount ?? 0} (+${authorityScore.toFixed(1)})`);
  }

  // ── Recency Score ──
  let recencyScore: number;
  if (isWithinHours(item.publishedAt, 24)) {
    recencyScore = 5;
    reasons.push('Recency: published within 24h (+5)');
  } else if (isWithinHours(item.publishedAt, 48)) {
    recencyScore = 3;
    reasons.push('Recency: published within 48h (+3)');
  } else if (isWithinHours(item.publishedAt, 168)) {
    recencyScore = 1;
    reasons.push('Recency: published within 7d (+1)');
  } else {
    recencyScore = -5;
  }

  // ── Final Score (weighted) V3 ──
  const finalScore =
    buyerIntentScore * 2.2 +
    painScore * 1.4 +
    specificityScore * 1.3 +
    saasScore * 1.1 +
    authorityScore * 0.7 +
    recencyScore * 0.5 -
    promoPenalty * 1.8 -
    junkPenalty * 3.0;

  return {
    buyerIntentScore,
    specificityScore,
    promoPenalty,
    junkPenalty,
    painScore,
    startupScore,
    saasScore,
    trendScore,
    devtoolScore,
    marketingScore,
    authorityScore: Math.round(authorityScore * 10) / 10,
    recencyScore,
    finalScore: Math.round(finalScore * 10) / 10,
    reasons,
  };
}

/**
 * Rank items using multi-dimensional scoring.
 * Sets item.scores and item.relevanceScore, then sorts by finalScore descending.
 */
export function rankItems(items: StandardItem[], keywords: KeywordsConfig): StandardItem[] {
  const ranked = items.map((item) => {
    const scores = computeScores(item, keywords);
    return {
      ...item,
      scores,
      relevanceScore: Math.round(scores.finalScore),
    };
  });

  ranked.sort((a, b) => {
    const diff = (b.scores?.finalScore ?? 0) - (a.scores?.finalScore ?? 0);
    if (diff !== 0) return diff;
    return (b.score ?? 0) - (a.score ?? 0);
  });

  const topScore = ranked[0]?.scores?.finalScore ?? 0;
  const highValue = ranked.filter((i) => (i.scores?.finalScore ?? 0) >= 30).length;
  logger.info(`Ranked ${ranked.length} items. Top finalScore: ${topScore.toFixed(1)}, high-value (>=30): ${highValue}`);

  return ranked;
}
