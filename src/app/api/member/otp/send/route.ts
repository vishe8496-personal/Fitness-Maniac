import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizeMobile } from '@/lib/mobile';
import { generateOtp, hashOtp, sendOtp, OTP_TTL_SECONDS } from '@/lib/otp';
import { ok, err } from '@/lib/api';

export const runtime = 'nodejs';

// POST /api/member/otp/send { mobile }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const mobile = normalizeMobile(String(body.mobile || ''));
  if (!mobile) return err('Enter a valid mobile number');

  const sb = supabaseAdmin();

  // Only registered members may log in.
  const { data: member } = await sb
    .from('members')
    .select('id')
    .eq('mobile', mobile)
    .maybeSingle();
  if (!member) return err('This number is not registered. Please contact the gym.', 404);

  // Basic rate limit: max 1 active (unconsumed, unexpired) code per 60s.
  const { data: recent } = await sb
    .from('otp_codes')
    .select('created_at')
    .eq('mobile', mobile)
    .order('created_at', { ascending: false })
    .limit(1);
  if (recent?.[0]) {
    const ageMs = Date.now() - new Date(recent[0].created_at).getTime();
    if (ageMs < 60_000) {
      return err('Please wait a moment before requesting another code', 429);
    }
  }

  const code = generateOtp();
  const codeHash = hashOtp(mobile, code);
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString();

  // Invalidate previous codes for this number, then insert the new one.
  await sb.from('otp_codes').update({ consumed: true }).eq('mobile', mobile).eq('consumed', false);
  const { error: insErr } = await sb
    .from('otp_codes')
    .insert({ mobile, code_hash: codeHash, expires_at: expiresAt });
  if (insErr) return err('Server error', 500);

  const delivery = await sendOtp(mobile, code);
  if (!delivery.ok) {
    // eslint-disable-next-line no-console
    console.error('OTP delivery failed:', delivery.error);
    return err('Could not send the code. Try again later.', 502);
  }

  return ok({ sent: true, mobile });
}
