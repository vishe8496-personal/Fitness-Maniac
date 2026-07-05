import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAdmin } from '@/lib/session';
import { statusFromEndDate, daysUntil } from '@/lib/dates';
import { ok, err } from '@/lib/api';

export const runtime = 'nodejs';

// GET /api/admin/members/:id  -> member + attendance history
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await getAdmin())) return err('Unauthorized', 401);

  const sb = supabaseAdmin();
  const { data: member, error } = await sb
    .from('members')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (error) return err('Server error', 500);
  if (!member) return err('Member not found', 404);

  const { data: attendance, error: aErr } = await sb
    .from('attendance')
    .select('*')
    .eq('member_id', params.id)
    .order('ts', { ascending: false })
    .limit(500);

  if (aErr) return err('Server error', 500);

  return ok({
    member: {
      ...member,
      status: statusFromEndDate(member.end_date),
      days_until_end: daysUntil(member.end_date),
    },
    attendance: attendance ?? [],
  });
}

// DELETE /api/admin/members/:id  -> remove member
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await getAdmin())) return err('Unauthorized', 401);
  const sb = supabaseAdmin();
  const { error } = await sb.from('members').delete().eq('id', params.id);
  if (error) return err('Server error', 500);
  return ok({});
}
