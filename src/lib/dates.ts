// Date + membership status helpers.

/** Format a Date as an ISO date string (YYYY-MM-DD) in UTC. */
export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Number of days in a given month (month is 0-indexed). */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * Add `months` calendar months to `start`, keeping the same day-of-month.
 * If the target month is shorter, clamp to its last valid day.
 * e.g. Jan 31 + 1 month => Feb 28 (or 29 in a leap year).
 */
export function addMonthsClamped(start: Date, months: number): Date {
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth();
  const day = start.getUTCDate();

  const targetMonthIndex = month + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;

  const clampedDay = Math.min(day, daysInMonth(targetYear, targetMonth));
  return new Date(Date.UTC(targetYear, targetMonth, clampedDay));
}

export type MemberStatus = 'active' | 'expiring' | 'expired';

/**
 * Derive membership status from an end date.
 * - expired : end_date is before today
 * - expiring: end_date is today .. today + `expiringWindowDays`
 * - active  : end_date is further out
 */
export function statusFromEndDate(
  endDate: string | Date,
  today: Date = new Date(),
  expiringWindowDays = 7
): MemberStatus {
  const end = typeof endDate === 'string' ? new Date(endDate + 'T00:00:00Z') : endDate;
  const t = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const endDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));

  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((endDay.getTime() - t.getTime()) / msPerDay);

  if (diffDays < 0) return 'expired';
  if (diffDays <= expiringWindowDays) return 'expiring';
  return 'active';
}

/** Whole days until end date (negative if already expired). */
export function daysUntil(endDate: string | Date, today: Date = new Date()): number {
  const end = typeof endDate === 'string' ? new Date(endDate + 'T00:00:00Z') : endDate;
  const t = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const endDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((endDay.getTime() - t.getTime()) / msPerDay);
}
