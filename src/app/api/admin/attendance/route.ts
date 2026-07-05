import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAdmin } from '@/lib/session';
import { ok, err } from '@/lib/api';

export const runtime = 'nodejs';

// POST /api/admin/attendance  { member_id, ts? }  -> manual add
export async function POST(req: NextRequest) {
  if (!(await getAdmin())) return err('Unauthorized', 401);

  const body = await req.json().catch(() => ({}));
  const memberId = String(body.member_id || '');
  if (!memberId) return err('member_id required');

  const ts = body.ts ? new Date(body.ts) : new Date();
  if (isNaN(ts.getTime())) return err('Invalid timestamp');

  const sb = supabaseAdmin();
  const { data: member } = await sb.from('members').select('id').eq('id', memberId).maybeSingle();
  if (!member) return err('Member not found', 404);

  const { data, error } = await sb
    .from('attendance')
    .insert({ member_id: memberId, ts: ts.toISOString(), source: 'manual' })
    .select('*')
    .single();

  if (error) return err('Server error', 500);
  return ok({ entry: data }, { status: 201 });
}

// DELETE /api/admin/attendance?id=  -> manual remove
export async function DELETE(req: NextRequest) {
  if (!(await getAdmin())) return err('Unauthorized', 401);
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return err('id required');

  const sb = supabaseAdmin();
  const { error } = await sb.from('attendance').delete().eq('id', id);
  if (error) return err('Server error', 500);
  return ok({});
}
