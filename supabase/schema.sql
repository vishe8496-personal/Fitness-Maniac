-- ============================================================
-- Fitness Maniac — Gym Attendance schema
-- Run this in the Supabase SQL editor (or via `supabase db push`).
-- ============================================================

create extension if not exists "pgcrypto";

-- ── Members ────────────────────────────────────────────────
create table if not exists public.members (
  id            uuid primary key default gen_random_uuid(),
  name          text        not null,
  mobile        text        not null unique,
  start_date    date        not null default current_date,
  end_date      date        not null,
  subscription_months int    not null default 1,
  -- status is derived on read; kept here only as an optional cached value.
  status        text        not null default 'active',
  created_at    timestamptz not null default now()
);

create index if not exists members_end_date_idx on public.members (end_date);
create index if not exists members_mobile_idx on public.members (mobile);

-- ── Attendance ─────────────────────────────────────────────
create table if not exists public.attendance (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.members (id) on delete cascade,
  ts         timestamptz not null default now(),
  source     text not null default 'checkin', -- 'checkin' | 'manual'
  created_at timestamptz not null default now()
);

create index if not exists attendance_member_idx on public.attendance (member_id);
create index if not exists attendance_ts_idx on public.attendance (ts);

-- ── Gym config (single row expected) ───────────────────────
create table if not exists public.gym_config (
  id        int primary key default 1,
  name      text not null default 'Main Gym',
  lat       double precision not null,
  lng       double precision not null,
  radius_m  integer not null default 150,
  updated_at timestamptz not null default now(),
  constraint gym_config_singleton check (id = 1)
);

-- ── Admins ─────────────────────────────────────────────────
create table if not exists public.admins (
  id            uuid primary key default gen_random_uuid(),
  username      text not null unique,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

-- ── OTP codes (short-lived, for member login) ──────────────
create table if not exists public.otp_codes (
  id         uuid primary key default gen_random_uuid(),
  mobile     text not null,
  code_hash  text not null,
  expires_at timestamptz not null,
  attempts   int not null default 0,
  consumed   boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists otp_mobile_idx on public.otp_codes (mobile);

-- ============================================================
-- Row Level Security
-- All access goes through Next.js API routes using the SERVICE ROLE
-- key, which bypasses RLS. We still enable RLS so that the public
-- anon key cannot read/write these tables directly.
-- ============================================================
alter table public.members     enable row level security;
alter table public.attendance  enable row level security;
alter table public.gym_config  enable row level security;
alter table public.admins      enable row level security;
alter table public.otp_codes   enable row level security;

-- gym_config is safe to read publicly (needed for geofence on the client
-- if you ever want to skip the API). Uncomment to allow anon read:
-- create policy "gym_config public read" on public.gym_config for select using (true);

-- ============================================================
-- Seed helpers
-- ============================================================
-- Insert your gym location (replace lat/lng with your gym's coordinates):
insert into public.gym_config (id, name, lat, lng, radius_m)
values (1, 'Main Gym', 19.0760, 72.8777, 150)
on conflict (id) do nothing;

-- Create the first admin. Generate the bcrypt hash with:
--   node scripts/hash-password.mjs "your-password"
-- then run:
--   insert into public.admins (username, password_hash)
--   values ('admin', '<paste-hash-here>');
