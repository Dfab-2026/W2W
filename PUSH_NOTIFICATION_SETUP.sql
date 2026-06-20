create table if not exists user_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  permission text default 'granted',
  user_agent text,
  enabled boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, endpoint)
);

alter table user_push_subscriptions
add column if not exists user_id uuid,
add column if not exists endpoint text,
add column if not exists p256dh text,
add column if not exists auth text,
add column if not exists permission text default 'granted',
add column if not exists user_agent text,
add column if not exists enabled boolean default true,
add column if not exists created_at timestamptz default now(),
add column if not exists updated_at timestamptz default now();

create index if not exists idx_user_push_subscriptions_user_id on user_push_subscriptions(user_id);
create index if not exists idx_user_push_subscriptions_enabled on user_push_subscriptions(enabled);
