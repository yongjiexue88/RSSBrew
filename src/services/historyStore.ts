import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { StandardItem, HistoryData } from '../types/item.js';
import { nowISO } from '../utils/date.js';
import { logger } from '../utils/logger.js';

const HISTORY_PATH = path.join(process.cwd(), 'data', 'history.json');
const MAX_AGE_DAYS = 30;

/**
 * Load history from data/history.json.
 * Returns { urls: {} } if the file doesn't exist.
 */
export async function loadHistory(): Promise<HistoryData> {
  try {
    const raw = await readFile(HISTORY_PATH, 'utf-8');
    const data = JSON.parse(raw) as HistoryData;
    logger.info(`Loaded history with ${Object.keys(data.urls).length} URLs`);
    return data;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      logger.info('No history file found, starting fresh');
      return { urls: {} };
    }
    logger.error('Failed to load history', err);
    return { urls: {} };
  }
}

/**
 * Prune history entries older than MAX_AGE_DAYS.
 */
function pruneHistory(history: HistoryData): HistoryData {
  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const pruned: Record<string, string> = {};
  let removedCount = 0;

  for (const [url, dateStr] of Object.entries(history.urls)) {
    const entryDate = new Date(dateStr).getTime();
    if (entryDate >= cutoff) {
      pruned[url] = dateStr;
    } else {
      removedCount++;
    }
  }

  if (removedCount > 0) {
    logger.info(`Pruned ${removedCount} history entries older than ${MAX_AGE_DAYS} days`);
  }

  return { urls: pruned };
}

/**
 * Add new item URLs to history with the current date, prune old entries,
 * and save back to data/history.json.
 */
export async function updateHistory(
  history: HistoryData,
  newItems: StandardItem[]
): Promise<void> {
  const now = nowISO();

  for (const item of newItems) {
    if (!history.urls[item.url]) {
      history.urls[item.url] = now;
    }
  }

  // Prune old entries
  const pruned = pruneHistory(history);

  // Ensure the data directory exists
  const dir = path.dirname(HISTORY_PATH);
  await mkdir(dir, { recursive: true });

  await writeFile(HISTORY_PATH, JSON.stringify(pruned, null, 2) + '\n', 'utf-8');
  logger.info(
    `Updated history: added ${newItems.length} items, total ${Object.keys(pruned.urls).length} URLs`
  );
}
