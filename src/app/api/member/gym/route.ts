import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getMember, verifyMemberToken } from '@/lib/session';
import { ok, err } from '@/lib/api';

export const runtime = 'nodejs';

async function requireMember(req: NextRequest) {
  let claims = await getMember();
  if (!claims) {
    const auth = req.headers.get('authorization');
    const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (bearer) claims = await verifyMemberToken(bearer);
  }
  return claims;
}

// GET /api/member/gym -> gym location + radius (for client-side geofence UX)
export async function GET(req: NextRequest) {
  if (!(await requireMember(req))) return err('Unauthorized', 401);

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('gym_config')
    .select('name, lat, lng, radius_m')
    .eq('id', 1)
    .maybeSingle();

  if (error) return err('Server error', 500);
  if (!data) return err('Gym location not configured', 500);
  return ok({ gym: data });
}
