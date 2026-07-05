import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizeMobile } from '@/lib/mobile';
import { signMemberToken, setMemberCookie } from '@/lib/session';
import { ok, err } from '@/lib/api';

export const runtime = 'nodejs';

// Light in-process rate limiter keyed by IP. On serverless this is
// per-instance, so treat it as a damper against casual enumeration,
// not a hard guarantee.
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60_000; // 10 minutes
const MAX_ATTEMPTS = 15;

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > MAX_ATTEMPTS;
}

/**
 * POST /api/member/login
 * Phone-number login with a confirm step. The GPS geofence (server-validated
 * on check-in) is the real gate; the number is an identifier, not a secret.
 *
 * Step 1: { mobile }                  -> { needsConfirm: true, firstName }
 * Step 2: { mobile, confirmed: true } -> sets session cookie, returns token
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const mobile = normalizeMobile(String(body.mobile || ''));
  if (!mobile) return err('Enter a valid mobile number');

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  if (isRateLimited(ip)) return err('Too many attempts. Try again in a few minutes.', 429);

  const sb = supabaseAdmin();
  const { data: member, error } = await sb
    .from('members')
    .select('id, name, mobile')
    .eq('mobile', mobile)
    .maybeSingle();

  if (error) return err('Server error', 500);
  if (!member) return err('This number is not registered. Please contact the gym.', 404);

  // Step 1: confirmation preview — reveal only the first name.
  if (!body.confirmed) {
    return ok({ needsConfirm: true, firstName: member.name.split(' ')[0] });
  }

  // Step 2: confirmed — issue the long-lived session.
  const token = await signMemberToken({ sub: member.id, mobile: member.mobile });
  setMemberCookie(token);
  return ok({ token, member: { id: member.id, name: member.name, mobile: member.mobile } });
}
