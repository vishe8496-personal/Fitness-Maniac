import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyPassword } from '@/lib/password';
import { signAdminToken, setAdminCookie } from '@/lib/session';
import { ok, err } from '@/lib/api';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const { username, password } = await req.json().catch(() => ({}));
  if (!username || !password) return err('Username and password required');

  const sb = supabaseAdmin();
  const { data: admin, error } = await sb
    .from('admins')
    .select('id, username, password_hash')
    .eq('username', String(username).trim().toLowerCase())
    .maybeSingle();

  if (error) return err('Server error', 500);
  // Constant-ish: always run bcrypt to reduce username enumeration timing.
  const hash = admin?.password_hash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
  const valid = await verifyPassword(String(password), hash);

  if (!admin || !valid) return err('Invalid credentials', 401);

  const token = await signAdminToken({ sub: admin.id, username: admin.username });
  setAdminCookie(token);
  return ok({ admin: { id: admin.id, username: admin.username } });
}
