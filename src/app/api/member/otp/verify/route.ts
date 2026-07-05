import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizeMobile } from '@/lib/mobile';
import { hashOtp, OTP_MAX_ATTEMPTS } from '@/lib/otp';
import { signMemberToken, setMemberCookie } from '@/lib/session';
import { ok, err } from '@/lib/api';

export const runtime = 'nodejs';

// POST /api/member/otp/verify { mobile, code }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const mobile = normalizeMobile(String(body.mobile || ''));
  const code = String(body.code || '').trim();
  if (!mobile || !/^\d{4,8}$/.test(code)) return err('Enter the code sent to your phone');

  const sb = supabaseAdmin();

  const { data: otp } = await sb
    .from('otp_codes')
    .select('*')
    .eq('mobile', mobile)
    .eq('consumed', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!otp) return err('No active code. Request a new one.', 400);
  if (new Date(otp.expires_at).getTime() < Date.now()) {
    await sb.from('otp_codes').update({ consumed: true }).eq('id', otp.id);
    return err('Code expired. Request a new one.', 400);
  }
  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    await sb.from('otp_codes').update({ consumed: true }).eq('id', otp.id);
    return err('Too many attempts. Request a new code.', 429);
  }

  const matches = hashOtp(mobile, code) === otp.code_hash;
  if (!matches) {
    await sb.from('otp_codes').update({ attempts: otp.attempts + 1 }).eq('id', otp.id);
    return err('Incorrect code', 401);
  }

  // Consume the code.
  await sb.from('otp_codes').update({ consumed: true }).eq('id', otp.id);

  const { data: member } = await sb
    .from('members')
    .select('id, name, mobile')
    .eq('mobile', mobile)
    .maybeSingle();
  if (!member) return err('Member not found', 404);

  const token = await signMemberToken({ sub: member.id, mobile: member.mobile });
  setMemberCookie(token);

  // Also return the token so the client can persist it in localStorage as a
  // backup session (in addition to the httpOnly cookie).
  return ok({ token, member });
}
