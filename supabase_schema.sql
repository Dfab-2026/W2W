-- =====================================================================
-- Work2Wish Supabase Schema (run once in Supabase SQL Editor)
-- =====================================================================

-- Enable UUID generator
create extension if not exists "pgcrypto";

-- ---------------- user_profiles -----------------------------------------
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  role text not null check (role in ('worker','employer','admin')),
  full_name text,
  phone text,
  photo_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------------- workers -----------------------------------------------
create table if not exists public.workers (
  user_id uuid primary key references public.user_profiles(id) on delete cascade,
  age int,
  skills text[] default '{}',
  experience_years int default 0,
  expected_daily_wage numeric default 0,
  location_text text,
  latitude double precision,
  longitude double precision,
  bio text,
  rating numeric default 0,
  verified boolean default false,
  available boolean default true,
  created_at timestamptz default now()
);

-- ---------------- employers ---------------------------------------------
create table if not exists public.employers (
  user_id uuid primary key references public.user_profiles(id) on delete cascade,
  company_name text,
  company_logo text,
  industry text,
  location_text text,
  latitude double precision,
  longitude double precision,
  description text,
  verified boolean default false,
  created_at timestamptz default now()
);

-- ---------------- jobs --------------------------------------------------
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers(user_id) on delete cascade,
  title text not null,
  category text,
  description text,
  location_text text,
  latitude double precision,
  longitude double precision,
  daily_pay numeric not null default 0,
  duration_days int default 1,
  start_date date,
  status text not null default 'open' check (status in ('open','closed','filled')),
  created_at timestamptz default now()
);
create index if not exists idx_jobs_status on public.jobs(status);
create index if not exists idx_jobs_employer on public.jobs(employer_id);

-- ---------------- applications ------------------------------------------
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  worker_id uuid not null references public.workers(user_id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','rejected','ongoing','completed')),
  message text,
  applied_at timestamptz default now(),
  unique(job_id, worker_id)
);
create index if not exists idx_applications_job on public.applications(job_id);
create index if not exists idx_applications_worker on public.applications(worker_id);

-- ---------------- messages ----------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.user_profiles(id) on delete cascade,
  receiver_id uuid not null references public.user_profiles(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  application_id uuid references public.applications(id) on delete set null,
  content text not null,
  read boolean default false,
  created_at timestamptz default now()
);
create index if not exists idx_messages_pair on public.messages(sender_id, receiver_id, created_at desc);

-- ---------------- notifications -----------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  title text not null,
  body text,
  type text,
  related_id uuid,
  read boolean default false,
  created_at timestamptz default now()
);
create index if not exists idx_notifications_user on public.notifications(user_id, read, created_at desc);

-- ---------------- app_downloads -----------------------------------------
create table if not exists public.app_downloads (
  id uuid primary key default gen_random_uuid(),
  platform text check (platform in ('android','ios','web')),
  ip text,
  user_agent text,
  downloaded_at timestamptz default now()
);

-- ---------------- reports -----------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.user_profiles(id) on delete set null,
  reported_id uuid references public.user_profiles(id) on delete set null,
  reason text,
  details text,
  created_at timestamptz default now()
);

-- =====================================================================
-- Storage bucket for profile photos & company logos
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('w2w-public','w2w-public', true)
on conflict (id) do nothing;

-- =====================================================================
-- Row Level Security – simple policies
-- All write paths happen via the Next.js API using the service role,
-- so we just need readable rows for the authenticated browser session.
-- =====================================================================
alter table public.user_profiles enable row level security;
alter table public.workers       enable row level security;
alter table public.employers     enable row level security;
alter table public.jobs          enable row level security;
alter table public.applications  enable row level security;
alter table public.messages      enable row level security;
alter table public.notifications enable row level security;
alter table public.reports       enable row level security;

-- helper: drop-if-exists then create policies
do $$
begin
  -- user_profiles
  drop policy if exists "profiles_select_self_or_public" on public.user_profiles;
  create policy "profiles_select_self_or_public" on public.user_profiles
    for select using (true);

  -- workers public read
  drop policy if exists "workers_select_all" on public.workers;
  create policy "workers_select_all" on public.workers
    for select using (true);

  -- employers public read
  drop policy if exists "employers_select_all" on public.employers;
  create policy "employers_select_all" on public.employers
    for select using (true);

  -- jobs public read
  drop policy if exists "jobs_select_all" on public.jobs;
  create policy "jobs_select_all" on public.jobs
    for select using (true);

  -- applications: worker sees own, employer sees own jobs
  drop policy if exists "applications_select_own" on public.applications;
  create policy "applications_select_own" on public.applications
    for select using (
      worker_id = auth.uid()
      or job_id in (select id from public.jobs where employer_id = auth.uid())
    );

  -- messages: only participants
  drop policy if exists "messages_select_participants" on public.messages;
  create policy "messages_select_participants" on public.messages
    for select using (sender_id = auth.uid() or receiver_id = auth.uid());
  drop policy if exists "messages_insert_self" on public.messages;
  create policy "messages_insert_self" on public.messages
    for insert with check (sender_id = auth.uid());

  -- notifications: only owner
  drop policy if exists "notifications_select_own" on public.notifications;
  create policy "notifications_select_own" on public.notifications
    for select using (user_id = auth.uid());
  drop policy if exists "notifications_update_own" on public.notifications;
  create policy "notifications_update_own" on public.notifications
    for update using (user_id = auth.uid());

  -- reports: insert by anyone authed
  drop policy if exists "reports_insert_authed" on public.reports;
  create policy "reports_insert_authed" on public.reports
    for insert with check (auth.uid() is not null);
end$$;

-- Enable realtime for messages & notifications
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
