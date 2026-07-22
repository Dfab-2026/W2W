-- Run once in Supabase SQL Editor.
-- This record is intentionally NOT deleted when a Work2Wish account is deleted.
-- It prevents the same verified mobile number (or email fallback) from claiming another trial.

create table if not exists public.trial_claim_history (
  id uuid primary key default gen_random_uuid(),
  identity_key text not null,
  role text not null check (role in ('worker','employer')),
  first_user_id uuid,
  latest_user_id uuid,
  claimed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (identity_key, role)
);

create index if not exists trial_claim_history_identity_idx
  on public.trial_claim_history (identity_key, role);

alter table public.trial_claim_history enable row level security;
-- No client policies are required. The application accesses this table only through
-- the secured server API using the Supabase service-role key.
