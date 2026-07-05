import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

export const ADMIN_COOKIE = 'gm_admin';
export const MEMBER_COOKIE = 'gm_member';

const ADMIN_TTL = 60 * 60 * 12; // 12 hours
const MEMBER_TTL = 60 * 60 * 24 * 180; // 180 days — "persists across visits"

function secret(name: 'ADMIN_JWT_SECRET' | 'MEMBER_JWT_SECRET'): Uint8Array {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} environment variable`);
  return new TextEncoder().encode(value);
}

// ── Admin ──────────────────────────────────────────────────
export interface AdminClaims {
  sub: string; // admin id
  username: string;
  role: 'admin';
}

export async function signAdminToken(claims: Omit<AdminClaims, 'role'>): Promise<string> {
  return new SignJWT({ ...claims, role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_TTL}s`)
    .sign(secret('ADMIN_JWT_SECRET'));
}

export async function verifyAdminToken(token: string): Promise<AdminClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret('ADMIN_JWT_SECRET'));
    if (payload.role !== 'admin') return null;
    return payload as unknown as AdminClaims;
  } catch {
    return null;
  }
}

// ── Member ─────────────────────────────────────────────────
export interface MemberClaims {
  sub: string; // member id
  mobile: string;
  role: 'member';
}

export async function signMemberToken(claims: Omit<MemberClaims, 'role'>): Promise<string> {
  return new SignJWT({ ...claims, role: 'member' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MEMBER_TTL}s`)
    .sign(secret('MEMBER_JWT_SECRET'));
}

export async function verifyMemberToken(token: string): Promise<MemberClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret('MEMBER_JWT_SECRET'));
    if (payload.role !== 'member') return null;
    return payload as unknown as MemberClaims;
  } catch {
    return null;
  }
}

// ── Cookie helpers (server-side) ───────────────────────────
const isProd = process.env.NODE_ENV === 'production';

export function setAdminCookie(token: string) {
  cookies().set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_TTL,
  });
}

export function clearAdminCookie() {
  cookies().set(ADMIN_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}

export function setMemberCookie(token: string) {
  cookies().set(MEMBER_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: MEMBER_TTL,
  });
}

export function clearMemberCookie() {
  cookies().set(MEMBER_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}

// ── Request-level guards (for API routes) ──────────────────
export async function getAdmin(): Promise<AdminClaims | null> {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

export async function getMember(): Promise<MemberClaims | null> {
  const token = cookies().get(MEMBER_COOKIE)?.value;
  if (!token) return null;
  return verifyMemberToken(token);
}
