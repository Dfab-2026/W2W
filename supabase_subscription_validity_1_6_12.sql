-- Work2Wish Subscription Validity Update
-- Run this in Supabase SQL Editor once.

alter table if exists public.user_subscriptions
  add column if not exists validity_months integer,
  add column if not exists expires_at timestamptz;

alter table if exists public.user_profiles
  add column if not exists subscription_plan text default 'Basic',
  add column if not exists subscription_status text default 'active',
  add column if not exists subscription_expiry timestamptz;

create index if not exists idx_user_subscriptions_expiry
  on public.user_subscriptions(user_id, role, status, expires_at);

-- Normalize existing active subscriptions with proper validity when expiry is missing.
update public.user_subscriptions
set
  validity_months = case
    when role = 'worker' and plan_name = 'Basic' then 1
    when role = 'worker' and plan_name = 'Growth' then 6
    when role = 'worker' and plan_name = 'Premium' then 12
    when role = 'employer' and plan_name = 'Starter' then 1
    when role = 'employer' and plan_name = 'Business' then 6
    when role = 'employer' and plan_name = 'Enterprise' then 12
    else coalesce(validity_months, 1)
  end,
  expires_at = coalesce(
    expires_at,
    started_at + (
      case
        when role = 'worker' and plan_name = 'Basic' then interval '1 month'
        when role = 'worker' and plan_name = 'Growth' then interval '6 months'
        when role = 'worker' and plan_name = 'Premium' then interval '12 months'
        when role = 'employer' and plan_name = 'Starter' then interval '1 month'
        when role = 'employer' and plan_name = 'Business' then interval '6 months'
        when role = 'employer' and plan_name = 'Enterprise' then interval '12 months'
        else interval '1 month'
      end
    )
  ),
  updated_at = now()
where status = 'active';

-- Mark already expired subscriptions as expired.
update public.user_subscriptions
set status = 'expired', updated_at = now()
where status = 'active'
  and expires_at is not null
  and expires_at <= now();

notify pgrst, 'reload schema';
