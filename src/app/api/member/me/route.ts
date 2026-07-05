import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getMember, verifyMemberToken } from '@/lib/session';
import { statusFromEndDate, daysUntil } from '@/lib/dates';
import { ok, err } from '@/lib/api';

export const runtime = 'nodejs';

/**
 * GET /api/member/me
 * Resolves the current member from the httpOnly cookie, OR from a
 * `Authorization: Bearer <token>` header (localStorage backup session).
 */
export async function GET(req: NextRequest) {
  let claims = await getMember();
  if (!claims) {
    const auth = req.headers.get('authorization');
    const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (bearer) claims = await verifyMemberToken(bearer);
  }
  if (!claims) return err('Unauthorized', 401);

  const sb = supabaseAdmin();
  const { data: member, error } = await sb
    .from('members')
    .select('id, name, mobile, start_date, end_date')
    .eq('id', claims.sub)
    .maybeSingle();

  if (error) return err('Server error', 500);
  if (!member) return err('Member not found', 404);

  return ok({
    member: {
      ...member,
      status: statusFromEndDate(member.end_date),
      days_until_end: daysUntil(member.end_date),
    },
  });
}
