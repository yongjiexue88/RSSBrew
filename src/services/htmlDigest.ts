import type { StandardItem } from '../types/item.js';
import { todayDateString } from '../utils/date.js';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generateHtmlDigest(
  items: StandardItem[],
  stats: { totalCollected: number; afterDedupe: number; afterFilter: number }
): string {
  const dateStr = todayDateString();
  const highValueItems = items.filter((i) => (i.scores?.finalScore ?? 0) >= 30);
  const painPoints = items.filter((i) => i.tags.includes('pain-point'));
  const startupIdeas = items.filter((i) => i.tags.includes('startup-idea'));
  const saas = items.filter((i) => i.tags.includes('saas'));
  const newTech = items.filter((i) => i.tags.includes('new-tech'));
  const devTools = items.filter((i) => i.tags.includes('developer-tool'));
  const marketing = items.filter((i) => i.tags.includes('marketing'));
  const launches = items.filter((i) => i.tags.includes('launch'));

  // Beautiful CSS for the email
  const css = `
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #334155; background-color: #f8fafc; margin: 0; padding: 20px; }
    .container { max-width: 650px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    h1 { color: #0f172a; font-size: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-top: 0; }
    h2 { color: #1e293b; font-size: 20px; margin-top: 30px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; }
    h3 { color: #3b82f6; font-size: 16px; margin-bottom: 5px; }
    a { color: #2563eb; text-decoration: none; font-weight: 500; }
    a:hover { text-decoration: underline; }
    .item { margin-bottom: 20px; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; }
    .item-meta { font-size: 13px; color: #64748b; margin-top: 5px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-right: 5px; margin-bottom: 5px; }
    .badge-source { background: #e2e8f0; color: #475569; }
    .badge-score { background: #dcfce7; color: #166534; }
    .badge-tag { background: #dbeafe; color: #1e40af; }
    .stats-box { background: #f1f5f9; padding: 15px; border-radius: 8px; font-size: 14px; margin-bottom: 30px; }
    .stats-row { display: flex; justify-content: space-between; margin-bottom: 5px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 2px; }
    .reason-list { font-size: 12px; color: #64748b; margin-top: 5px; margin-bottom: 0; padding-left: 20px; }
    .empty { color: #94a3b8; font-style: italic; font-size: 14px; }
    .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; }
  `;

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body>`;
  html += `<div class="container">`;

  // Title
  html += `<h1>🛰️ Daily Startup Radar</h1>`;
  html += `<p style="color: #64748b; font-size: 14px; margin-top: -10px;">Automated Intelligence Report for ${dateStr}</p>`;

  // 1. Executive Summary
  html += `<h2>📊 Executive Summary</h2>`;
  html += `<div class="stats-box">`;
  html += `<div class="stats-row"><span>Items Collected</span> <strong>${stats.totalCollected}</strong></div>`;
  html += `<div class="stats-row"><span>After Dedupe</span> <strong>${stats.afterDedupe}</strong></div>`;
  html += `<div class="stats-row"><span>After Filtering</span> <strong>${stats.afterFilter}</strong></div>`;
  html += `<div class="stats-row"><span>High-Value Opportunities (Score 30+)</span> <strong>${highValueItems.length}</strong></div>`;
  html += `</div>`;

  const renderItemCard = (item: StandardItem, index?: number) => {
    const score = item.scores?.finalScore ?? 0;
    const reasons = item.scores?.reasons?.slice(0, 3) || [];
    let card = `<div class="item">`;
    card += `<h3>${index ? index + '. ' : ''}<a href="${escapeHtml(item.url)}" target="_blank">${escapeHtml(item.title)}</a></h3>`;
    
    card += `<div class="item-meta">`;
    card += `<span class="badge badge-source">${escapeHtml(item.source)}</span>`;
    card += `<span class="badge badge-score">Score: ${score}</span>`;
    item.tags.forEach(tag => {
      card += `<span class="badge badge-tag">${escapeHtml(tag)}</span>`;
    });
    card += `</div>`;

    if (item.summary) {
      const escapedSummary = escapeHtml(item.summary.substring(0, 150));
      card += `<p style="font-size: 13px; color: #475569; margin: 8px 0;">${escapedSummary}...</p>`;
    }

    if (reasons.length > 0) {
      card += `<ul class="reason-list">`;
      reasons.forEach(r => { card += `<li>${escapeHtml(r)}</li>`; });
      card += `</ul>`;
    }
    card += `</div>`;
    return card;
  };

  const renderSection = (title: string, list: StandardItem[], sortFn: (a: StandardItem, b: StandardItem) => number) => {
    html += `<h2>${title}</h2>`;
    if (list.length === 0) {
      html += `<p class="empty">No signals in this category today.</p>`;
      return;
    }
    const sorted = [...list].sort(sortFn);
    sorted.slice(0, 10).forEach((item, idx) => {
      html += renderItemCard(item, idx + 1);
    });
  };

  // 2. Best Opportunities
  renderSection('🏆 Best Opportunities Today', items.slice(0, 10), (a, b) => (b.scores?.finalScore ?? 0) - (a.scores?.finalScore ?? 0));

  // 3. User Pain Points
  renderSection('🔥 User Pain Points', painPoints, (a, b) => (b.scores?.painScore ?? 0) - (a.scores?.painScore ?? 0));

  // 4. SaaS & Startup Ideas
  const saasStartup = Array.from(new Set([...startupIdeas, ...saas]));
  renderSection('💡 SaaS & Startup Ideas', saasStartup, (a, b) => ((b.scores?.startupScore ?? 0) + (b.scores?.saasScore ?? 0)) - ((a.scores?.startupScore ?? 0) + (a.scores?.saasScore ?? 0)));

  // 5. Tech Trends
  renderSection('🚀 New Technology Trends', newTech, (a, b) => (b.scores?.trendScore ?? 0) - (a.scores?.trendScore ?? 0));

  // Footer
  html += `<div class="footer">`;
  html += `<p>Generated automatically by Startup Radar • Powered by GitHub Actions & Resend</p>`;
  html += `</div>`;

  html += `</div></body></html>`;
  return html;
}
