/**
 * Returns the current date formatted as YYYY-MM-DD.
 */
export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Returns the current time as an ISO 8601 string.
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Checks whether the given ISO date string is within the last N hours.
 */
export function isWithinHours(isoDate: string | undefined, hours: number): boolean {
  if (!isoDate) return false;
  try {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    return diffMs >= 0 && diffMs <= hours * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

/**
 * Parses various date formats and returns an ISO string, or undefined.
 */
export function parseDate(input: string | undefined | null): string | undefined {
  if (!input) return undefined;
  try {
    const date = new Date(input);
    if (isNaN(date.getTime())) return undefined;
    return date.toISOString();
  } catch {
    return undefined;
  }
}
