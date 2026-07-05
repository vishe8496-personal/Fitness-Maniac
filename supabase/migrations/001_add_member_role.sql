-- Migration: add role to members ('member' | 'coach').
-- Coaches use the same phone login but may check in up to 4 times per day.
-- Run this in the Supabase SQL editor for existing databases.

alter table public.members
  add column if not exists role text not null default 'member'
  check (role in ('member', 'coach'));
