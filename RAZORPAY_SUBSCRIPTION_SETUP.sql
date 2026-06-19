-- Work2Wish Razorpay Subscription Setup
-- Run this once in Supabase SQL Editor before testing live Razorpay payments.

create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('worker','employer')),
  plan_name text not null,
  status text not null default 'active' check (status in ('active','inactive','expired','cancelled')),
  source text default 'razorpay',
  validity_months integer,
  razorpay_customer_id text,
  razorpay_subscription_id text,
  razorpay_order_id text,
  razorpay_payment_id text,
  started_at timestamptz default now(),
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table if exists public.user_subscriptions
  add column if not exists validity_months integer,
  add column if not exists razorpay_order_id text,
  add column if not exists razorpay_payment_id text,
  add column if not exists expires_at timestamptz,
  add column if not exists updated_at timestamptz default now();

create index if not exists idx_user_subscriptions_user_role_status
  on public.user_subscriptions(user_id, role, status);

create index if not exists idx_user_subscriptions_expiry
  on public.user_subscriptions(user_id, role, status, expires_at);

create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  subscription_id uuid references public.user_subscriptions(id) on delete set null,
  role text check (role in ('worker','employer')),
  plan_name text,
  amount integer,
  currency text default 'INR',
  status text,
  razorpay_order_id text unique,
  razorpay_payment_id text unique,
  razorpay_signature text,
  raw_response jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_subscription_payments_user_id
  on public.subscription_payments(user_id);

create index if not exists idx_subscription_payments_order_id
  on public.subscription_payments(razorpay_order_id);

create index if not exists idx_subscription_payments_payment_id
  on public.subscription_payments(razorpay_payment_id);

alter table if exists public.user_profiles
  add column if not exists subscription_plan text default 'Basic',
  add column if not exists subscription_status text default 'active',
  add column if not exists subscription_expiry timestamptz;

alter table public.user_subscriptions enable row level security;
alter table public.subscription_payments enable row level security;

drop policy if exists "Users can read own subscriptions" on public.user_subscriptions;
create policy "Users can read own subscriptions"
  on public.user_subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can read own payments" on public.subscription_payments;
create policy "Users can read own payments"
  on public.subscription_payments for select
  using (auth.uid() = user_id);

notify pgrst, 'reload schema';
