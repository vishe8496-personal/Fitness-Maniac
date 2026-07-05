// Date + membership status helpers.
// All "calendar day" logic uses the gym's local timezone (IST by default),
// configured as minutes east of UTC via GYM_TZ_OFFSET_MIN.

const TZ_OFFSET_MIN = Number(process.env.GYM_TZ_OFFSET_MIN ?? 330); // IST = UTC+5:30

/**
 * "Now" shifted so its getUTC* parts read as the gym's local calendar
 * date/time. Only use the getUTC* accessors on the result.
 */
export function nowLocal(): Date {
  return new Date(Date.now() + TZ_OFFSET_MIN * 60_000);
}

/** UTC instant at which the gym-local calendar day started (local midnight). */
export function startOfLocalDayUtc(): Date {
  const n = nowLocal();
  return new Date(
    Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()) - TZ_OFFSET_MIN * 60_000
  );
}

/** Format a Date as an ISO date string (YYYY-MM-DD) from its UTC parts. */
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
  today: Date = nowLocal(),
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
export function daysUntil(endDate: string | Date, today: Date = nowLocal()): number {
  const end = typeof endDate === 'string' ? new Date(endDate + 'T00:00:00Z') : endDate;
  const t = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const endDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((endDay.getTime() - t.getTime()) / msPerDay);
}
