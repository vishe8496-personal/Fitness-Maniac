import { clearMemberCookie } from '@/lib/session';
import { ok } from '@/lib/api';

export const runtime = 'nodejs';

export async function POST() {
  clearMemberCookie();
  return ok({});
}
