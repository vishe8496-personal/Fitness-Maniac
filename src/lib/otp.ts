import { createHmac, randomInt } from 'crypto';

export const OTP_TTL_SECONDS = 5 * 60; // 5 minutes
export const OTP_MAX_ATTEMPTS = 5;

/** Generate a 6-digit numeric OTP. */
export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** Deterministic keyed hash of an OTP so we never store the plaintext code. */
export function hashOtp(mobile: string, code: string): string {
  const secret = process.env.OTP_HASH_SECRET;
  if (!secret) throw new Error('Missing OTP_HASH_SECRET environment variable');
  return createHmac('sha256', secret).update(`${mobile}:${code}`).digest('hex');
}

// ── Delivery providers ─────────────────────────────────────
export type OtpDeliveryResult = { ok: true } | { ok: false; error: string };

async function sendViaMsg91(mobile: string, code: string): Promise<OtpDeliveryResult> {
  const authkey = process.env.MSG91_AUTHKEY;
  const template = process.env.MSG91_DLT_TEMPLATE_ID;
  if (!authkey || !template) return { ok: false, error: 'MSG91 not configured' };

  // MSG91 flow API — sends the OTP variable to the DLT-approved template.
  const res = await fetch('https://control.msg91.com/api/v5/flow/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', authkey },
    body: JSON.stringify({
      template_id: template,
      sender: process.env.MSG91_SENDER_ID,
      recipients: [{ mobiles: mobile.replace('+', ''), otp: code }],
    }),
  });
  if (!res.ok) {
    return { ok: false, error: `MSG91 error ${res.status}: ${await res.text()}` };
  }
  return { ok: true };
}

async function sendViaTwilio(mobile: string, code: string): Promise<OtpDeliveryResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) return { ok: false, error: 'Twilio not configured' };

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      To: mobile,
      From: from,
      Body: `Your gym check-in code is ${code}. It expires in 5 minutes.`,
    }),
  });
  if (!res.ok) {
    return { ok: false, error: `Twilio error ${res.status}: ${await res.text()}` };
  }
  return { ok: true };
}

/** Send an OTP using the configured provider. In `mock` mode it just logs. */
export async function sendOtp(mobile: string, code: string): Promise<OtpDeliveryResult> {
  const provider = (process.env.OTP_PROVIDER || 'mock').toLowerCase();
  switch (provider) {
    case 'msg91':
      return sendViaMsg91(mobile, code);
    case 'twilio':
      return sendViaTwilio(mobile, code);
    case 'mock':
    default:
      // eslint-disable-next-line no-console
      console.log(`\n📱 [MOCK OTP] ${mobile} -> ${code}  (expires in 5 min)\n`);
      return { ok: true };
  }
}
