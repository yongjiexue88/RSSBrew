对，这次我们把它定成 **免费 MVP + GitHub Actions 每天自动跑一次** 的完整计划。

核心目标：

> 每天自动抓取 Hacker News、Reddit RSS、GitHub Trending、技术博客 RSS，然后生成一份 Markdown 创业情报日报，提交回 GitHub repo。
> 第一版不需要数据库、不需要服务器、不需要 AI、不需要前端。

GitHub Actions 支持用 `on.schedule` 配置 cron 定时任务，默认按 UTC 运行；官方文档也说明 public repo 的标准 GitHub-hosted runners 免费使用，private repo 则会消耗账号的免费分钟额度。([GitHub Docs][1])

---

# 1. 项目名称

```text
startup-radar
```

中文理解：

```text
个人创业情报雷达系统
```

第一版功能：

```text
每天自动收集技术社区信息
↓
清洗、去重、排序
↓
生成 Markdown 日报
↓
GitHub Actions 每天自动运行
↓
把日报 commit 到 output/ 文件夹
```

---

# 2. MVP 目标

## 这个系统解决什么问题？

你现在的问题不是“没有新闻看”，而是：

```text
新闻太多
社区太散
创业点子藏在评论和吐槽里
每天手动看 HN / Reddit / GitHub Trending 很低效
```

这个系统要帮你做三件事：

```text
1. 自动收集信息
2. 自动筛出可能有价值的内容
3. 每天生成一份可以读的创业情报日报
```

## MVP 必须包含什么？

第一版只做这些：

```text
1. 抓 RSS feed
2. 抓 Reddit subreddit RSS
3. 抓 Hacker News top stories
4. 抓 GitHub Trending
5. 统一数据格式
6. URL 去重
7. 简单关键词打标签
8. 按来源和热度排序
9. 生成 Markdown digest
10. GitHub Actions 每天自动运行一次
11. 自动 commit digest 到 repo
```

## 暂时不做什么？

第一版不要做：

```text
数据库
AI 总结
Web UI
登录系统
复杂搜索
Product Hunt API
Reddit API
付费部署
Telegram 推送
```

这些都放后面。

---

# 3. 技术栈推荐

## 第一版技术栈

| 模块              | 推荐                      |
| --------------- | ----------------------- |
| Language        | TypeScript / Node.js    |
| Storage         | JSON files              |
| Digest          | Markdown                |
| Scheduler       | GitHub Actions          |
| Deployment      | GitHub repo only        |
| Database        | 暂时不用                    |
| AI              | 暂时不用                    |
| Notification    | 暂时不用，后面加 Telegram/Email |
| Package manager | npm 或 pnpm              |

## 为什么这样选？

```text
TypeScript / Node.js：你作为软件工程师上手快
JSON files：第一版不需要数据库
Markdown：最容易读、最容易存 GitHub
GitHub Actions：免费自动跑，不需要服务器
```

---

# 4. 系统架构

第一版架构：

```text
Data Sources
  ├── Hacker News API
  ├── Reddit RSS
  ├── GitHub Trending
  ├── Company Blogs RSS
  └── Tech Blogs RSS

        ↓

Collectors
  ├── hackerNewsCollector.ts
  ├── redditRssCollector.ts
  ├── githubTrendingCollector.ts
  └── rssCollector.ts

        ↓

Normalizer
  把不同来源的数据统一成 StandardItem

        ↓

Processing
  ├── dedupe by URL
  ├── ranking
  ├── keyword tagging
  └── group by source/category

        ↓

Markdown Generator

        ↓

output/YYYY-MM-DD.md

        ↓

GitHub Actions commit back to repo
```

---

# 5. 数据源设计

## 5.1 Hacker News

推荐方式：官方 Firebase API。

MVP 抓：

```text
topstories
beststories
showstories
askstories
```

第一版可以先只抓：

```text
topstories 前 30 条
```

字段：

```text
title
url
by
score
descendants/comments_count
time
```

是否免费：免费。
是否需要 API key：不需要。
MVP 推荐：API。

---

## 5.2 Reddit

推荐方式：subreddit RSS。

例如：

```text
https://www.reddit.com/r/SaaS/.rss
https://www.reddit.com/r/startups/.rss
https://www.reddit.com/r/SideProject/.rss
https://www.reddit.com/r/Entrepreneur/.rss
https://www.reddit.com/r/webdev/.rss
https://www.reddit.com/r/selfhosted/.rss
```

是否免费：个人小规模阅读一般免费。
是否需要 API key：RSS 不需要。
MVP 推荐：RSS，不要一开始用 Reddit API。

注意：Reddit API 商业化、大规模抓取会有政策和费用问题，所以 MVP 阶段尽量用 RSS，频率控制在每天一次。

---

## 5.3 GitHub Trending

GitHub Trending 没有特别稳定的官方 API。MVP 有两个选择：

### 方案 A：解析 GitHub Trending 页面

```text
https://github.com/trending
https://github.com/trending/typescript
https://github.com/trending/python
```

优点：直接。
缺点：HTML 结构可能变。

### 方案 B：使用第三方 RSS

例如一些 GitHub Trending RSS 生成服务。

优点：简单。
缺点：依赖第三方。

MVP 推荐：**先用页面解析**，失败了再换第三方 RSS。

---

## 5.4 普通 RSS / 技术博客

第一版建议配置这些：

```text
OpenAI Blog
Anthropic News
Vercel Blog
Supabase Blog
Stripe Blog
GitHub Blog
Cloudflare Blog
PostHog Blog
Linear Blog
```

如果某些博客 RSS 链接不好找，可以先跳过，不要卡住。

---

## 5.5 Product Hunt

第一版建议：**暂时不接**。

原因：

```text
Product Hunt API 可能需要 token
数据结构更复杂
第一版用 HN + Reddit + GitHub Trending 已经够验证价值
```

Phase 2 或 Phase 3 再加 Product Hunt。

---

# 6. 标准数据模型

所有来源统一成一个 `StandardItem`。

```ts
export type SourceType =
  | "hacker_news"
  | "reddit"
  | "github_trending"
  | "rss";

export type StandardItem = {
  id: string;
  title: string;
  url: string;
  source: string;
  sourceType: SourceType;
  author?: string;
  publishedAt?: string;
  fetchedAt: string;
  summary?: string;
  content?: string;
  score?: number;
  commentsCount?: number;
  tags: string[];
  relevanceScore: number;
  raw?: unknown;
};
```

---

# 7. 第一版项目结构

```text
startup-radar/
  .github/
    workflows/
      daily.yml

  config/
    sources.json
    keywords.json

  data/
    history.json
    raw/
      .gitkeep

  output/
    .gitkeep

  src/
    collectors/
      hackerNewsCollector.ts
      redditRssCollector.ts
      rssCollector.ts
      githubTrendingCollector.ts

    services/
      normalize.ts
      dedupe.ts
      rank.ts
      tagger.ts
      markdownDigest.ts
      historyStore.ts

    types/
      item.ts

    utils/
      date.ts
      logger.ts

    index.ts

  package.json
  tsconfig.json
  README.md
```

## 每个目录负责什么

| 目录                  | 作用                    |
| ------------------- | --------------------- |
| `.github/workflows` | GitHub Actions 自动运行配置 |
| `config`            | 数据源、关键词配置             |
| `data`              | 历史记录、原始数据             |
| `output`            | 每天生成的 Markdown 日报     |
| `src/collectors`    | 各个平台的数据采集             |
| `src/services`      | 去重、排序、打标签、生成 Markdown |
| `src/types`         | TypeScript 类型         |
| `src/utils`         | 日期、日志等工具              |
| `src/index.ts`      | 主入口                   |

---

# 8. 配置文件设计

## `config/sources.json`

```json
{
  "reddit": [
    {
      "name": "Reddit SaaS",
      "url": "https://www.reddit.com/r/SaaS/.rss",
      "category": "startup"
    },
    {
      "name": "Reddit Startups",
      "url": "https://www.reddit.com/r/startups/.rss",
      "category": "startup"
    },
    {
      "name": "Reddit SideProject",
      "url": "https://www.reddit.com/r/SideProject/.rss",
      "category": "startup"
    },
    {
      "name": "Reddit Entrepreneur",
      "url": "https://www.reddit.com/r/Entrepreneur/.rss",
      "category": "startup"
    },
    {
      "name": "Reddit WebDev",
      "url": "https://www.reddit.com/r/webdev/.rss",
      "category": "developer"
    },
    {
      "name": "Reddit SelfHosted",
      "url": "https://www.reddit.com/r/selfhosted/.rss",
      "category": "developer"
    }
  ],
  "rss": [
    {
      "name": "GitHub Blog",
      "url": "https://github.blog/feed/",
      "category": "developer"
    },
    {
      "name": "Cloudflare Blog",
      "url": "https://blog.cloudflare.com/rss/",
      "category": "infrastructure"
    },
    {
      "name": "Stripe Blog",
      "url": "https://stripe.com/blog/feed.rss",
      "category": "saas"
    },
    {
      "name": "Supabase Blog",
      "url": "https://supabase.com/rss.xml",
      "category": "developer-tool"
    },
    {
      "name": "Vercel Blog",
      "url": "https://vercel.com/blog/rss.xml",
      "category": "developer-tool"
    }
  ],
  "githubTrending": [
    {
      "name": "GitHub Trending TypeScript",
      "url": "https://github.com/trending/typescript"
    },
    {
      "name": "GitHub Trending Python",
      "url": "https://github.com/trending/python"
    },
    {
      "name": "GitHub Trending Overall",
      "url": "https://github.com/trending"
    }
  ],
  "hackerNews": {
    "limit": 30
  }
}
```

---

## `config/keywords.json`

```json
{
  "painPoint": [
    "pain",
    "problem",
    "struggle",
    "frustrated",
    "hate",
    "annoying",
    "manual",
    "expensive",
    "broken",
    "slow",
    "hard to",
    "looking for",
    "alternative",
    "how do you",
    "any tool",
    "recommend"
  ],
  "startupIdea": [
    "tool",
    "automation",
    "workflow",
    "saas",
    "mvp",
    "side project",
    "productized",
    "template",
    "dashboard",
    "agent",
    "ai assistant"
  ],
  "marketing": [
    "launch",
    "growth",
    "seo",
    "cold email",
    "landing page",
    "pricing",
    "positioning",
    "waitlist",
    "conversion",
    "distribution"
  ],
  "developerTool": [
    "api",
    "sdk",
    "database",
    "cli",
    "framework",
    "library",
    "open source",
    "github",
    "devtool",
    "observability"
  ]
}
```

---

# 9. Daily Digest 模板

最终生成：

```text
output/2026-05-29.md
```

内容：

```markdown
# Daily Startup Radar - 2026-05-29

## 1. Executive Summary

Today’s digest collected items from Hacker News, Reddit, GitHub Trending, and selected RSS feeds.

- Total items collected: 126
- After dedupe: 89
- High relevance items: 24
- Potential pain points: 8
- Potential startup ideas: 6

## 2. Top Trends

### Trend 1: AI developer tools are moving toward workflow automation

Sources:
- [Item title](url) — Hacker News
- [Item title](url) — GitHub Trending

Why it matters:
Short explanation.

## 3. User Pain Points

### 1. Pain point title

Source:
- [Reddit post title](url)

Signal:
- People are asking for alternatives
- Existing tools are expensive
- Workflow is still manual

Possible product:
A small SaaS that solves X for Y.

## 4. Startup Ideas

### 1. Idea name

Target user:
Solo founders / SaaS teams / developers

Problem:
What pain it solves.

MVP:
What can be built in 1-2 weeks.

Marketing channel:
Reddit / HN / Product Hunt / SEO.

## 5. Hacker News Watch

Top HN posts:
- [title](url) — score / comments

## 6. Reddit Watch

Interesting Reddit posts:
- [title](url) — subreddit

## 7. GitHub Trending Watch

Trending repos:
- [repo](url) — description

## 8. RSS / Company Blog Watch

Notable updates:
- [title](url) — source

## 9. Action Items

- Research one pain point from Reddit.
- Check if there are existing SaaS competitors.
- Write one landing page angle for the best idea.

## 10. Save for Later

- [title](url)
- [title](url)
```

---

# 10. GitHub Actions 自动运行方案

## 推荐运行时间

你在 America/Chicago。GitHub Actions cron 默认使用 UTC。官方文档说明 `on.schedule` 使用 cron，并且 scheduled workflows 默认运行在 UTC。([GitHub Docs][1])

如果你想 **每天早上 8 点 Chicago 时间附近** 看日报：

```text
Chicago CDT = UTC-5
8:00 AM Chicago = 13:00 UTC
```

所以可以设置：

```yaml
cron: "0 13 * * *"
```

注意：Chicago 有夏令时，冬天 CST 是 UTC-6，所以冬天会变成早上 7 点。第一版不用纠结这个，日报早一点/晚一点都没事。

---

## `.github/workflows/daily.yml`

```yaml
name: Daily Startup Radar

on:
  schedule:
    # Runs every day at 13:00 UTC.
    # Around 8 AM America/Chicago during daylight saving time.
    - cron: "0 13 * * *"

  workflow_dispatch:

permissions:
  contents: write

jobs:
  build-digest:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Generate daily digest
        run: npm run daily

      - name: Commit generated digest
        run: |
          git config user.name "startup-radar-bot"
          git config user.email "startup-radar-bot@users.noreply.github.com"

          git add output data

          if git diff --cached --quiet; then
            echo "No changes to commit"
          else
            git commit -m "chore: generate daily startup radar"
            git push
          fi
```

## 为什么加 `workflow_dispatch`

这个可以让你在 GitHub UI 里手动点一次运行，方便测试。

---

# 11. package.json scripts

```json
{
  "name": "startup-radar",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts",
    "daily": "tsx src/index.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "cheerio": "^1.0.0",
    "rss-parser": "^3.13.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

---

# 12. 核心处理流程

`src/index.ts` 负责：

```text
1. 读取 config/sources.json
2. 并发抓取 HN / Reddit RSS / 普通 RSS / GitHub Trending
3. 统一成 StandardItem[]
4. 读取 data/history.json
5. 去重
6. 打标签
7. 计算 relevanceScore
8. 排序
9. 保存 raw data
10. 更新 history.json
11. 生成 output/YYYY-MM-DD.md
```

伪代码：

```ts
async function main() {
  const config = await loadConfig();

  const hnItems = await collectHackerNews(config.hackerNews);
  const redditItems = await collectRedditRss(config.reddit);
  const rssItems = await collectRss(config.rss);
  const githubItems = await collectGitHubTrending(config.githubTrending);

  const allItems = [
    ...hnItems,
    ...redditItems,
    ...rssItems,
    ...githubItems,
  ];

  const history = await loadHistory();

  const deduped = dedupeItems(allItems, history);
  const tagged = tagItems(deduped);
  const ranked = rankItems(tagged);

  await saveRawItems(ranked);
  await updateHistory(history, ranked);

  const markdown = generateMarkdownDigest(ranked);
  await saveDigest(markdown);
}
```

---

# 13. Ranking 规则

第一版不用 AI，先用规则。

## relevanceScore 计算

```text
base = 0

如果来自 Reddit: +3
如果 title 命中 painPoint keyword: +5
如果 title 命中 startupIdea keyword: +4
如果 title 命中 marketing keyword: +4
如果来自 HN 且 commentsCount > 100: +3
如果来自 GitHub Trending: +2
如果 title 包含 "alternative": +5
如果 title 包含 "how do you": +4
如果 title 包含 "looking for": +4
如果 item 最近 48 小时内发布: +2
```

## 为什么 Reddit 权重大？

因为你目标是找创业点子。
Reddit 更容易出现：

```text
I hate X
How do you solve Y
Looking for a tool that does Z
Any alternative to expensive product A
```

这些是非常好的创业信号。

---

# 14. MVP TODO List

## Day 1：项目初始化 + 数据抓取

```text
1. 创建 GitHub repo: startup-radar
2. 初始化 Node.js + TypeScript
3. 安装 rss-parser / cheerio / tsx
4. 创建 sources.json
5. 定义 StandardItem type
6. 实现 rssCollector.ts
7. 实现 redditRssCollector.ts
8. 实现 hackerNewsCollector.ts
9. 实现 githubTrendingCollector.ts
10. 本地运行，确认可以抓到数据
```

验收标准：

```text
npm run daily 能打印所有来源抓到的 item 数量
```

---

## Day 2：清洗 + 排序 + Markdown

```text
1. 实现 normalize.ts
2. 实现 dedupe.ts
3. 实现 tagger.ts
4. 实现 rank.ts
5. 实现 markdownDigest.ts
6. 生成 output/YYYY-MM-DD.md
7. 添加 data/history.json
8. 避免重复收录旧链接
```

验收标准：

```text
output/今天日期.md 成功生成
内容按 Hacker News / Reddit / GitHub Trending / RSS 分组
```

---

## Day 3：GitHub Actions 自动运行

```text
1. 添加 .github/workflows/daily.yml
2. 添加 workflow_dispatch
3. 设置 permissions: contents: write
4. push 到 GitHub
5. 手动运行一次 workflow
6. 确认 output/日期.md 被 commit 回 repo
7. 确认第二天可以自动生成
8. 调整 cron 时间
```

验收标准：

```text
GitHub Actions 成功运行
日报被自动 commit 到 output/
```

---

# 15. 成本评估

## 完全免费版本

```text
GitHub public repo
GitHub Actions daily run
No database
No AI
No server
No paid API
Markdown output
```

成本：

```text
$0
```

## private repo 是否免费？

如果你用 public repo，GitHub 官方说明标准 hosted runners 免费。([GitHub Docs][2])

如果你用 private repo，则会消耗账号的免费 minutes/storage quota，超出后才收费；GitHub 文档说明 private repositories 使用 GitHub-hosted runners 会根据账号 plan 获得免费额度，超出部分计费。([GitHub Docs][3])

你的任务每天跑一次，通常只要几分钟，所以 private repo 也大概率够用。但如果你不想想这些，直接 public repo 最省心。

---

# 16. 风险和坑

## 1. GitHub Actions schedule 不一定精确到分钟

Scheduled workflows 是定时触发，但实际运行时间可能有延迟。你的场景只是日报，所以没关系。

## 2. GitHub Trending HTML 可能变

页面结构一变，解析器可能坏。

解决方案：

```text
解析失败时不要让整个任务失败
只跳过 GitHub Trending
日志里记录 warning
```

## 3. Reddit RSS 可能偶尔失败

解决方案：

```text
加 User-Agent
单个 source 失败不影响其他 source
每天只抓一次，别高频请求
```

## 4. RSS 格式不统一

不同 RSS feed 字段可能不同：

```text
pubDate
isoDate
content
contentSnippet
summary
```

解决方案：

```text
normalize 层统一处理
缺字段就 fallback
```

## 5. 噪音太多

第一版不要抓太多。

建议一开始限制：

```text
HN: 30
每个 subreddit: 15
每个 RSS feed: 10
GitHub Trending: 20
```

每天总量控制在 100-150 条以内。

## 6. 没有 AI 时，创业点子提取不准

没关系。第一版目标不是完美分析，是验证：

```text
这些信息源每天有没有价值
你愿不愿意看生成的 digest
```

---

# 17. 后续升级路线

## Phase 1：免费 MVP

```text
本地 + GitHub Actions
JSON storage
Markdown digest
无 AI
```

## Phase 2：自动推送

加：

```text
Telegram Bot
Email
Discord webhook
```

每天 GitHub Actions 生成后，顺便发一条：

```text
Daily Startup Radar is ready:
https://github.com/yourname/startup-radar/blob/main/output/2026-05-29.md
```

## Phase 3：AI 总结

加 OpenAI / Claude / Gemini API。

功能：

```text
自动总结 Top trends
提取 pain points
生成 startup ideas
分析 marketing angles
给每个 idea 评分
```

## Phase 4：SQLite + Web UI

加：

```text
SQLite
Next.js
搜索
收藏
标签
趋势图
```

## Phase 5：产品化

变成 SaaS：

```text
用户自定义 sources
每日邮件
AI idea scoring
市场机会 tracking
竞品监控
```

---

# 18. 之后可以直接用的 AI Digest Prompt

这个先放着，Phase 3 再用。

```text
You are my startup research analyst.

I collected today’s items from Hacker News, Reddit, GitHub Trending, Product Hunt, and RSS feeds.

My goal is not to summarize news. My goal is to find:
1. Real user pain points
2. Startup ideas
3. SaaS opportunities
4. Developer tool opportunities
5. Marketing angles
6. Competitor signals
7. Small MVP ideas that can be validated within 1-2 weeks

Here are the collected items:

{{ITEMS_JSON}}

Please generate a Daily Startup Radar report.

Output format:

# Daily Startup Radar - {{DATE}}

## 1. Executive Summary
Summarize the most important patterns today in 5-8 bullet points.

## 2. Top Trends
For each trend:
- Trend
- Evidence from items
- Why it matters
- Who cares
- Possible opportunity

## 3. User Pain Points
For each pain point:
- Pain point
- Source item
- Target user
- Existing workaround
- Why current solutions are not enough
- Willingness to pay: Low / Medium / High
- Possible MVP

## 4. Startup Ideas
For each idea:
- Idea name
- Target user
- Problem
- MVP scope
- Competitors
- Differentiation
- Marketing channel
- Difficulty score 1-5
- Business potential score 1-5

## 5. GitHub Trending Watch
Analyze which repositories indicate useful technical trends or possible SaaS infrastructure opportunities.

## 6. Marketing Angles
Extract landing page angles, positioning ideas, SEO keywords, community marketing ideas, and Product Hunt/HN launch angles.

## 7. Action Items
Give me 3 concrete actions I can do today.

Rules:
- Do not be generic.
- Cite specific items by title and URL.
- Prefer opportunities for solo founders and small teams.
- Prefer SaaS, AI automation, developer tools, B2B workflow tools, and self-hosted tools.
- Avoid huge enterprise ideas that require a large team.
```

---

# 19. 最终推荐执行版本

你现在就做这个：

```text
TypeScript / Node.js
+ RSS Parser
+ Hacker News API
+ Reddit RSS
+ GitHub Trending parser
+ JSON history
+ Markdown digest
+ GitHub Actions daily cron
+ Auto commit output
```

第一版成功标准：

```text
每天 GitHub 自动生成一份 output/YYYY-MM-DD.md
你打开后 5 分钟内能看到：
- 今天值得关注的技术趋势
- Reddit 用户痛点
- GitHub 热门开源项目
- 可能的创业点子
```

这就是最干净、最便宜、最容易落地的路线。

[1]: https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions?utm_source=chatgpt.com "Workflow syntax for GitHub Actions"
[2]: https://docs.github.com/en/actions/reference/runners/github-hosted-runners?utm_source=chatgpt.com "GitHub-hosted runners reference"
[3]: https://docs.github.com/en/actions/concepts/billing-and-usage?utm_source=chatgpt.com "Billing and usage - GitHub Actions"
