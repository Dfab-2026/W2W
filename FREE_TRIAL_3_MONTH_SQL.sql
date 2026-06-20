-- Optional Supabase support for 3-month trial tracking from signup date
create table if not exists user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  user_email text,
  role text,
  plan_name text default 'Free Pro Trial',
  access_type text default 'free_trial',
  status text default 'active',
  is_trial_active boolean default true,
  trial_started_at timestamptz default now(),
  trial_ends_at timestamptz default (now() + interval '3 months'),
  paid_started_at timestamptz,
  paid_ends_at timestamptz,
  razorpay_payment_id text,
  razorpay_order_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, role)
);

alter table user_subscriptions
add column if not exists user_id uuid,
add column if not exists user_email text,
add column if not exists role text,
add column if not exists plan_name text default 'Free Pro Trial',
add column if not exists access_type text default 'free_trial',
add column if not exists status text default 'active',
add column if not exists is_trial_active boolean default true,
add column if not exists trial_started_at timestamptz default now(),
add column if not exists trial_ends_at timestamptz default (now() + interval '3 months'),
add column if not exists paid_started_at timestamptz,
add column if not exists paid_ends_at timestamptz,
add column if not exists razorpay_payment_id text,
add column if not exists razorpay_order_id text,
add column if not exists created_at timestamptz default now(),
add column if not exists updated_at timestamptz default now();

create or replace function activate_free_pro_trial_from_signup(
  p_user_id uuid,
  p_user_email text,
  p_role text,
  p_signup_date timestamptz default now()
)
returns void
language plpgsql
as $$
begin
  insert into user_subscriptions (
    user_id,
    user_email,
    role,
    plan_name,
    access_type,
    status,
    is_trial_active,
    trial_started_at,
    trial_ends_at,
    created_at,
    updated_at
  )
  values (
    p_user_id,
    p_user_email,
    p_role,
    'Free Pro Trial',
    'free_trial',
    case when (p_signup_date + interval '3 months') >= now() then 'active' else 'expired' end,
    (p_signup_date + interval '3 months') >= now(),
    p_signup_date,
    p_signup_date + interval '3 months',
    now(),
    now()
  )
  on conflict (user_id, role)
  do update set
    user_email = excluded.user_email,
    trial_started_at = excluded.trial_started_at,
    trial_ends_at = excluded.trial_ends_at,
    is_trial_active = excluded.is_trial_active,
    status = excluded.status,
    updated_at = now();
end;
$$;

create or replace function expire_finished_trials()
returns void
language plpgsql
as $$
begin
  update user_subscriptions
  set
    is_trial_active = false,
    status = 'expired',
    access_type = 'subscription_required',
    updated_at = now()
  where is_trial_active = true
    and trial_ends_at < now();
end;
$$;
