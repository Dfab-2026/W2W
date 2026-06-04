-- Work2Wish Subscription Feature Gating
-- Run this once in Supabase SQL Editor.

create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('worker','employer')),
  plan_name text not null,
  status text not null default 'active' check (status in ('active','inactive','expired','cancelled')),
  source text default 'ui_manual',
  razorpay_customer_id text,
  razorpay_subscription_id text,
  started_at timestamptz default now(),
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_user_subscriptions_user_role_status
  on public.user_subscriptions(user_id, role, status);

alter table public.user_subscriptions enable row level security;

drop policy if exists "Users can read own subscriptions" on public.user_subscriptions;
create policy "Users can read own subscriptions"
  on public.user_subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own subscriptions" on public.user_subscriptions;
create policy "Users can insert own subscriptions"
  on public.user_subscriptions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own subscriptions" on public.user_subscriptions;
create policy "Users can update own subscriptions"
  on public.user_subscriptions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Optional profile columns for quick reads/badges. Existing tables are not recreated.
alter table if exists public.user_profiles
  add column if not exists subscription_plan text default 'Free',
  add column if not exists subscription_status text default 'active',
  add column if not exists subscription_expiry timestamptz;

-- Default active Free subscription for existing users who do not have one.
insert into public.user_subscriptions (user_id, role, plan_name, status, source)
select id, case when role = 'employer' then 'employer' else 'worker' end, 'Free', 'active', 'migration_default'
from public.user_profiles up
where not exists (
  select 1 from public.user_subscriptions us
  where us.user_id = up.id
    and us.role = case when up.role = 'employer' then 'employer' else 'worker' end
    and us.status = 'active'
);

notify pgrst, 'reload schema';
