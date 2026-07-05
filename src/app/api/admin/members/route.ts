import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAdmin } from '@/lib/session';
import { addMonthsClamped, toISODate, statusFromEndDate } from '@/lib/dates';
import { normalizeMobile } from '@/lib/mobile';
import { ok, err } from '@/lib/api';

export const runtime = 'nodejs';

// GET /api/admin/members?q=&status=
export async function GET(req: NextRequest) {
  if (!(await getAdmin())) return err('Unauthorized', 401);

  const q = req.nextUrl.searchParams.get('q')?.trim() || '';
  const statusFilter = req.nextUrl.searchParams.get('status') || '';

  const sb = supabaseAdmin();
  let query = sb.from('members').select('*').order('created_at', { ascending: false });
  if (q) query = query.or(`name.ilike.%${q}%,mobile.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) return err('Server error', 500);

  const today = new Date();
  let members = (data ?? []).map((m) => ({
    ...m,
    status: statusFromEndDate(m.end_date, today),
  }));
  if (statusFilter) members = members.filter((m) => m.status === statusFilter);

  return ok({ members });
}

// POST /api/admin/members  { name, mobile, subscription_months }
export async function POST(req: NextRequest) {
  if (!(await getAdmin())) return err('Unauthorized', 401);

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  const months = Number(body.subscription_months);
  const mobile = normalizeMobile(String(body.mobile || ''));

  if (!name) return err('Name is required');
  if (!mobile) return err('Valid mobile number is required');
  if (!Number.isInteger(months) || months < 1 || months > 60)
    return err('Subscription months must be between 1 and 60');

  const start = new Date();
  const startDate = toISODate(start);
  const endDate = toISODate(addMonthsClamped(start, months));

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('members')
    .insert({
      name,
      mobile,
      start_date: startDate,
      end_date: endDate,
      subscription_months: months,
      status: statusFromEndDate(endDate, start),
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') return err('A member with this mobile already exists', 409);
    return err('Server error', 500);
  }

  return ok({ member: { ...data, status: statusFromEndDate(data.end_date) } }, { status: 201 });
}
