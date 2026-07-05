import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAdmin } from '@/lib/session';
import { ok, err } from '@/lib/api';

export const runtime = 'nodejs';

const TZ_OFFSET_MIN = Number(process.env.GYM_TZ_OFFSET_MIN ?? 330); // IST
const DAY_MS = 86_400_000;
const MAX_RANGE_DAYS = 190;

const isDateStr = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/**
 * GET /api/admin/visits?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Daily visit counts (gym-local days) for the dashboard chart.
 * Defaults to the last 14 days.
 */
export async function GET(req: NextRequest) {
  if (!(await getAdmin())) return err('Unauthorized', 401);

  const sp = req.nextUrl.searchParams;
  const nowShifted = new Date(Date.now() + TZ_OFFSET_MIN * 60_000);
  const todayStr = nowShifted.toISOString().slice(0, 10);
  const defaultFrom = new Date(nowShifted.getTime() - 13 * DAY_MS).toISOString().slice(0, 10);

  const from = sp.get('from') || defaultFrom;
  const to = sp.get('to') || todayStr;
  if (!isDateStr(from) || !isDateStr(to)) return err('Invalid date format');
  if (from > to) return err('"From" date must not be after "to" date');

  const rangeDays = Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS) + 1;
  if (rangeDays > MAX_RANGE_DAYS) return err(`Date range too large (max ${MAX_RANGE_DAYS} days)`);

  // UTC instants covering [from 00:00 local, to+1day 00:00 local)
  const startUtc = new Date(Date.parse(from + 'T00:00:00Z') - TZ_OFFSET_MIN * 60_000);
  const endUtc = new Date(startUtc.getTime() + rangeDays * DAY_MS);

  const sb = supabaseAdmin();
  const [{ data: rows, error: aErr }, { data: mems, error: mErr }] = await Promise.all([
    sb
      .from('attendance')
      .select('member_id, ts')
      .gte('ts', startUtc.toISOString())
      .lt('ts', endUtc.toISOString())
      .limit(10000),
    sb.from('members').select('id, role'),
  ]);
  if (aErr || mErr) return err('Server error', 500);

  const roleById = new Map((mems ?? []).map((m) => [m.id, m.role as string]));

  // Bucket by gym-local calendar day.
  const buckets = new Map<string, { memberIds: Set<string>; coachVisits: number }>();
  for (let i = 0; i < rangeDays; i++) {
    const d = new Date(Date.parse(from + 'T00:00:00Z') + i * DAY_MS).toISOString().slice(0, 10);
    buckets.set(d, { memberIds: new Set(), coachVisits: 0 });
  }

  const uniqueMembers = new Set<string>();
  let memberVisits = 0;
  for (const row of rows ?? []) {
    const localDay = new Date(new Date(row.ts).getTime() + TZ_OFFSET_MIN * 60_000)
      .toISOString()
      .slice(0, 10);
    const bucket = buckets.get(localDay);
    if (!bucket) continue;
    if (roleById.get(row.member_id) === 'coach') {
      bucket.coachVisits++;
    } else {
      bucket.memberIds.add(row.member_id);
      uniqueMembers.add(row.member_id);
      memberVisits++;
    }
  }

  const days = [...buckets.entries()].map(([date, b]) => ({
    date,
    members: b.memberIds.size,
    coaches: b.coachVisits,
  }));

  return ok({
    from,
    to,
    days,
    totals: { uniqueMembers: uniqueMembers.size, memberVisits },
  });
}
