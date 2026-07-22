-- =====================================================================
-- Work2Wish — Slice 3 schema delta (run in Supabase SQL Editor)
-- =====================================================================

-- 1) login_id column (unique 6-digit alpha-numeric / numeric)
alter table public.user_profiles
  add column if not exists login_id text unique;

create index if not exists idx_user_profiles_login_id on public.user_profiles(login_id);

-- 2) otp_codes — stores 6-digit codes for signup verification
create table if not exists public.otp_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code text not null,                  -- 6-digit string
  payload jsonb,                       -- pending signup info (role, full_name, password_hash placeholder, etc.)
  attempts int default 0,
  expires_at timestamptz not null,
  consumed boolean default false,
  created_at timestamptz default now()
);
create index if not exists idx_otp_email on public.otp_codes(email, consumed, expires_at);

-- otp_codes is server-only; lock it down via RLS:
alter table public.otp_codes enable row level security;
-- (no policies → only service role can access, which is what we want)
