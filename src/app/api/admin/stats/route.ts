import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAdmin } from '@/lib/session';
import { statusFromEndDate, daysUntil, nowLocal, startOfLocalDayUtc } from '@/lib/dates';
import { ok, err } from '@/lib/api';

export const runtime = 'nodejs';

// GET /api/admin/stats -> dashboard summary
export async function GET() {
  if (!(await getAdmin())) return err('Unauthorized', 401);

  const sb = supabaseAdmin();
  const { data: members, error } = await sb
    .from('members')
    .select('id, name, mobile, end_date, role');
  if (error) return err('Server error', 500);

  const today = nowLocal();
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

  // Today's attendance: unique members who checked in since gym-local (IST) midnight.
  const startOfDay = startOfLocalDayUtc();
  const { data: todayRows } = await sb
    .from('attendance')
    .select('member_id')
    .gte('ts', startOfDay.toISOString());

  // Attendance % is a members-only metric — coaches don't count toward it.
  const memberIds = new Set(all.filter((m) => m.role !== 'coach').map((m) => m.id));
  const uniqueToday = new Set(
    (todayRows ?? []).map((r) => r.member_id).filter((id) => memberIds.has(id))
  );
  const eligibleMembers = all.filter(
    (m) => m.role !== 'coach' && statusFromEndDate(m.end_date, today) !== 'expired'
  ).length;
  const attendancePct =
    eligibleMembers > 0 ? Math.round((uniqueToday.size / eligibleMembers) * 100) : 0;

  return ok({
    counts: { total: all.length, active, expiring, expired },
    today: { present: uniqueToday.size, eligible: eligibleMembers, pct: attendancePct },
    expiringSoon,
  });
}
