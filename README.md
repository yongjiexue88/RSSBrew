# Startup Radar 🛰️

> Personal startup intelligence radar — automated daily digest from Hacker News, Reddit, GitHub Trending, and tech blogs.

## What It Does

Every day, this system automatically:

1. **Collects** content from multiple sources (HN, Reddit, GitHub Trending, RSS blogs)
2. **Cleans & deduplicates** — removes duplicates and previously seen items
3. **Tags & ranks** — identifies pain points, startup ideas, and marketing signals using keyword matching
4. **Generates a Markdown digest** — a structured daily report saved to `output/YYYY-MM-DD.md`
5. **Auto-commits** via GitHub Actions — no server, no database, completely free

## Quick Start

### Prerequisites

- Node.js 20+
- npm

### Setup

```bash
# Install dependencies
npm install

# Run the daily digest manually
npm run daily

# Type check
npm run typecheck
```

### Output

After running, check the `output/` directory for today's digest:

```
output/2026-05-29.md
```

## Data Sources

| Source | Method | Limit |
|--------|--------|-------|
| Hacker News | Firebase API | Top 30 stories |
| Reddit | Subreddit RSS | 15 per subreddit |
| GitHub Trending | HTML scraping | 20 per language |
| Tech Blogs | RSS/Atom feeds | 10 per feed |

### Configured Subreddits

- r/SaaS, r/startups, r/SideProject, r/Entrepreneur, r/webdev, r/selfhosted

### Configured Blogs

- GitHub Blog, Cloudflare Blog, Stripe Blog, Supabase Blog, Vercel Blog

## GitHub Actions

The workflow runs daily at **8:00 AM Chicago time** (13:00 UTC).

You can also trigger it manually from the Actions tab → "Daily Startup Radar" → "Run workflow".

## Project Structure

```
startup-radar/
  .github/workflows/daily.yml    # GitHub Actions config
  config/
    sources.json                  # Data source URLs
    keywords.json                 # Keyword categories for tagging
  data/
    history.json                  # URL dedup history
    raw/                          # Raw collected data
  output/                         # Generated daily digests
  src/
    collectors/                   # Data collection modules
    services/                     # Processing pipeline
    types/                        # TypeScript types
    utils/                        # Utilities
    index.ts                      # Main entry point
```

## Relevance Scoring

Items are scored based on rules (no AI needed):

- Reddit source: **+3**
- Pain point keywords in title: **+5**
- Startup idea keywords: **+4**
- Marketing keywords: **+4**
- HN post with 100+ comments: **+3**
- GitHub Trending: **+2**
- Contains "alternative": **+5**
- Contains "how do you" / "looking for": **+4**
- Published within 48 hours: **+2**

## Configuration

### Add a Reddit subreddit

Edit `config/sources.json` → `reddit` array:

```json
{
  "name": "Reddit MachineLearning",
  "url": "https://www.reddit.com/r/MachineLearning/.rss",
  "category": "ai"
}
```

### Add an RSS blog

Edit `config/sources.json` → `rss` array:

```json
{
  "name": "My Blog",
  "url": "https://example.com/rss.xml",
  "category": "tech"
}
```

### Add keywords

Edit `config/keywords.json` to add new keyword categories or expand existing ones.

## Cost

**$0** — runs entirely on GitHub Actions (free for public repos).

## License

MIT