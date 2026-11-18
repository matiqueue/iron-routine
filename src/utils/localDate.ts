/**
 * Local-timezone calendar date helpers (YYYY-MM-DD).
 * Avoids `Date#toISOString().slice(0, 10)` which converts midnight local time
 * back to the previous calendar day in UTC+ timezones (e.g. CET/CEST 00:00-01:59).
 */
export function getLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLocalDateKeyOffset(daysOffset: number, from: Date = new Date()): string {
  const copy = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12, 0, 0, 0);
  copy.setDate(copy.getDate() + daysOffset);
  return getLocalDateKey(copy);
}

/**
 * Parses a `YYYY-MM-DD` (or ISO) string into a local-noon Date so formatting
 * via `.toLocaleDateString()` never shifts back by a day across timezones.
 */
export function parseLocalDateKey(dateStr: string): Date {
  const clean = String(dateStr || '').trim().slice(0, 10);
  const parts = clean.split('-').map((n) => parseInt(n, 10));
  if (parts.length === 3 && !parts.some((n) => Number.isNaN(n))) {
    return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
  }
  return new Date(dateStr);
}
