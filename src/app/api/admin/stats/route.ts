import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAdmin } from '@/lib/session';
import { statusFromEndDate, daysUntil } from '@/lib/dates';
import { ok, err } from '@/lib/api';

export const runtime = 'nodejs';

// GET /api/admin/stats -> dashboard summary
export async function GET() {
  if (!(await getAdmin())) return err('Unauthorized', 401);

  const sb = supabaseAdmin();
  const { data: members, error } = await sb.from('members').select('id, name, mobile, end_date');
  if (error) return err('Server error', 500);

  const today = new Date();
  const all = members ?? [];

  let active = 0, expiring = 0, expired = 0;
  const expiringSoon: {
    id: string; name: string; mobile: string; end_date: string; days_until_end: number;
  }[] = [];

  for (const m of all) {
    const s = statusFromEndDate(m.end_date, today);
    if (s === 'active') active++;
    else if (s === 'expiring') {
      expiring++;
      expiringSoon.push({ ...m, days_until_end: daysUntil(m.end_date, today) });
    } else expired++;
  }
  expiringSoon.sort((a, b) => a.days_until_end - b.days_until_end);

  // Today's attendance: unique members who checked in since local-day start (UTC).
  const startOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const { data: todayRows } = await sb
    .from('attendance')
    .select('member_id')
    .gte('ts', startOfDay.toISOString());

  const uniqueToday = new Set((todayRows ?? []).map((r) => r.member_id));
  const notExpired = active + expiring;
  const attendancePct = notExpired > 0 ? Math.round((uniqueToday.size / notExpired) * 100) : 0;

  return ok({
    counts: { total: all.length, active, expiring, expired },
    today: { present: uniqueToday.size, eligible: notExpired, pct: attendancePct },
    expiringSoon,
  });
}
