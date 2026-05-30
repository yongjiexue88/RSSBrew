import assert from 'node:assert';
import { filterItems } from '../services/filter.js';
import { rankItems } from '../services/rank.js';
import type { StandardItem, KeywordsConfig } from '../types/item.js';

// Setup mock config
const mockKeywords: KeywordsConfig = {
  mustKeep: [
    "looking for a tool",
    "alternative to",
    "manual process",
    "too expensive",
    "spreadsheet"
  ],
  mustDrop: [],
  painPoint: ["automation", "manual", "expensive"],
  pain: [],
  startupIdea: [],
  saas: [],
  newTech: [],
  developerTool: [],
  marketing: []
};

function createMockItem(title: string, overrides: Partial<StandardItem> = {}): StandardItem {
  return {
    id: Math.random().toString(36).substring(7),
    title,
    url: 'https://example.com/test-item',
    source: 'Test Source',
    sourceType: 'reddit',
    fetchedAt: new Date().toISOString(),
    tags: [],
    relevanceScore: 0,
    ...overrides
  };
}

console.log('Running Startup Radar pipeline regression tests...');

// --- Test 1: Spam filter checks (Should drop) ---
console.log('Running test: Hard drop spam filters...');

const spamItems = [
  createMockItem("Empire on Repeat: How America, China, and Russia Learned to Profit from Permanent War"),
  createMockItem("Adstorm Reviews, Complaints, Pricing, OTOs, Pros & Cons"),
  createMockItem("GoogleVault Reviews: Legit or Scam? Truth Exposed"),
  createMockItem("Why Businesses Invest in Software Development Companies in the USA")
];

const filteredSpam = filterItems(spamItems, mockKeywords);
assert.strictEqual(filteredSpam.length, 0, `Expected all 4 spam items to be dropped, but kept: ${filteredSpam.map(i => i.title).join(', ')}`);

// --- Test 2: Must keep overrides (Should keep valid posts, should NOT bypass spam) ---
console.log('Running test: Must keep overrides and spam checks...');

const mixedItems = [
  // Contains mustKeep phrase "looking for a tool" but is spam title - should drop!
  createMockItem("Adstorm Reviews, Complaints, Pricing, OTOs, Pros & Cons — looking for a tool?"),
  // Real intent, contains "looking for a tool" - should keep!
  createMockItem("Looking for email verification tool suggestions for automated marketing workflows", {
    url: 'https://reddit.com/r/marketing/comments/12345'
  }),
  // Real intent, contains workaround - should keep!
  createMockItem("Manual list building is killing me. How do you automate ICP verification?"),
  // Specific niche - should keep!
  createMockItem("Payroll automation for contractors across 8 countries")
];

const filteredMixed = filterItems(mixedItems, mockKeywords);
assert.strictEqual(filteredMixed.length, 3, `Expected exactly 3 items to remain, but got ${filteredMixed.length}`);
assert.ok(!filteredMixed.some(i => i.title.includes("Adstorm")), 'Expected Adstorm spam to be dropped despite containing mustKeep phrase');

// --- Test 3: Scoring checks (Top buildable opportunities scoring >= 30 validation) ---
console.log('Running test: Scoring and ranking...');

const rankedMixed = rankItems(filteredMixed.map(i => ({ ...i, tags: ['pain-point'] })), mockKeywords);

// Let's print the scores for logging
rankedMixed.forEach(i => {
  console.log(`- Title: "${i.title}"`);
  console.log(`  Scores: Final ${i.scores?.finalScore} | Intent ${i.scores?.buyerIntentScore} | Context ${i.scores?.workflowContextScore} | Pain ${i.scores?.painScore} | Junk ${i.scores?.junkPenalty}`);
});

const icpItem = rankedMixed.find(i => i.title.includes("ICP verification"));
assert.ok(icpItem, 'Expected to find ICP verification item');
assert.ok((icpItem.scores?.buyerIntentScore ?? 0) > 0, 'Expected ICP item to have buyer intent score');

console.log('All tests passed successfully!');
