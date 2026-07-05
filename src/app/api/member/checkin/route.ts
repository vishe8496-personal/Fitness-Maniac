import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getMember, verifyMemberToken } from '@/lib/session';
import { checkGeofence } from '@/lib/geo';
import { statusFromEndDate } from '@/lib/dates';
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

// POST /api/member/checkin { lat, lng }
export async function POST(req: NextRequest) {
  const claims = await requireMember(req);
  if (!claims) return err('Unauthorized', 401);

  const body = await req.json().catch(() => ({}));
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
    return err('Valid GPS coordinates required');

  const sb = supabaseAdmin();

  // Membership must be valid (not expired).
  const { data: member } = await sb
    .from('members')
    .select('id, end_date')
    .eq('id', claims.sub)
    .maybeSingle();
  if (!member) return err('Member not found', 404);
  if (statusFromEndDate(member.end_date) === 'expired')
    return err('Your membership has expired. Please renew.', 403);

  // Re-validate the geofence on the server (never trust the client).
  const { data: gym } = await sb
    .from('gym_config')
    .select('lat, lng, radius_m')
    .eq('id', 1)
    .maybeSingle();
  if (!gym) return err('Gym location not configured', 500);

  const fence = checkGeofence(lat, lng, gym.lat, gym.lng, gym.radius_m);
  if (!fence.withinRadius) {
    return err("You're not at the gym", 403, {
      distanceM: Math.round(fence.distanceM),
      radiusM: gym.radius_m,
    });
  }

  // Prevent duplicate check-ins on the same UTC day.
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const { data: existing } = await sb
    .from('attendance')
    .select('id, ts')
    .eq('member_id', member.id)
    .gte('ts', startOfDay.toISOString())
    .limit(1);

  if (existing && existing.length > 0) {
    return ok({ alreadyCheckedIn: true, entry: existing[0], distanceM: Math.round(fence.distanceM) });
  }

  const { data: entry, error } = await sb
    .from('attendance')
    .insert({ member_id: member.id, source: 'checkin' })
    .select('*')
    .single();
  if (error) return err('Server error', 500);

  return ok({ checkedIn: true, entry, distanceM: Math.round(fence.distanceM) }, { status: 201 });
}
