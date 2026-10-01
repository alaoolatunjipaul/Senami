/**
 * Time formatting.
 *
 * The interface shows relative timestamps in dense lists and absolute ones in
 * detail views. Both here are pure string formatters with a fixed locale so the
 * demo renders identically on every machine and every test stays deterministic.
 */

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
export const WEEK_MS = 7 * DAY_MS;
export const MONTH_MS = 30 * DAY_MS;

function asDate(value: Date | string): Date {
  return typeof value === "string" ? new Date(value) : value;
}

/**
 * Coarse relative label used on conversation cards: "just now", "5m ago",
 * "6h ago", "3d ago", "2w ago", then the absolute date.
 */
export function formatRelativeTime(value: Date | string, now: Date = new Date()): string {
  const at = asDate(value);
  const diffMs = now.getTime() - at.getTime();

  if (diffMs < MINUTE_MS) return "just now";
  if (diffMs < HOUR_MS) return `${Math.floor(diffMs / MINUTE_MS)}m ago`;
  if (diffMs < DAY_MS) return `${Math.floor(diffMs / HOUR_MS)}h ago`;
  if (diffMs < WEEK_MS) return `${Math.floor(diffMs / DAY_MS)}d ago`;
  if (diffMs < MONTH_MS) return `${Math.floor(diffMs / WEEK_MS)}w ago`;
  return formatDate(at);
}

/** Absolute, e.g. "3 Feb 2026, 14:05". Used in the detail pane. */
export function formatDateTime(value: Date | string): string {
  return asDate(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Absolute date only, e.g. "3 Feb 2026". */
export function formatDate(value: Date | string): string {
  return asDate(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}