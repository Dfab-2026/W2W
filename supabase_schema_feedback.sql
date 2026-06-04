-- Add language preference
alter table public.user_profiles
  add column if not exists language text default 'en';

-- Add feedback tables
create table if not exists public.worker_feedbacks (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(user_id) on delete cascade,
  employer_id uuid not null references public.employers(user_id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  rating int check (rating >= 1 and rating <= 5),
  feedback_text text,
  created_at timestamptz default now()
);

create table if not exists public.employer_feedbacks (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers(user_id) on delete cascade,
  worker_id uuid not null references public.workers(user_id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  rating int check (rating >= 1 and rating <= 5),
  feedback_text text,
  created_at timestamptz default now()
);

-- Add company feedback (visible in company profile)
create table if not exists public.company_feedbacks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.employers(user_id) on delete cascade,
  worker_id uuid not null references public.workers(user_id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  rating int check (rating >= 1 and rating <= 5),
  feedback_text text,
  created_at timestamptz default now()
);

-- Update workers table to include average rating
alter table public.workers
  add column if not exists average_rating numeric default 0;

-- Update employers table to include average rating
alter table public.employers
  add column if not exists average_rating numeric default 0;

-- Add job progress tracking
alter table public.applications
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz;

-- Enable RLS for feedback tables
alter table public.worker_feedbacks enable row level security;
alter table public.employer_feedbacks enable row level security;
alter table public.company_feedbacks enable row level security;

-- Policies for feedback
drop policy if exists "worker_feedbacks_select_all" on public.worker_feedbacks;
create policy "worker_feedbacks_select_all" on public.worker_feedbacks for select using (true);

drop policy if exists "employer_feedbacks_select_all" on public.employer_feedbacks;
create policy "employer_feedbacks_select_all" on public.employer_feedbacks for select using (true);

drop policy if exists "company_feedbacks_select_all" on public.company_feedbacks;
create policy "company_feedbacks_select_all" on public.company_feedbacks for select using (true);

-- Insert policies for feedback (workers can insert company feedback, employers can insert worker feedback)
drop policy if exists "company_feedbacks_insert_workers" on public.company_feedbacks;
create policy "company_feedbacks_insert_workers" on public.company_feedbacks
  for insert with check (worker_id = auth.uid());

drop policy if exists "worker_feedbacks_insert_employers" on public.worker_feedbacks;
create policy "worker_feedbacks_insert_employers" on public.worker_feedbacks
  for insert with check (employer_id = auth.uid());

drop policy if exists "employer_feedbacks_insert_employers" on public.employer_feedbacks;
create policy "employer_feedbacks_insert_employers" on public.employer_feedbacks
  for insert with check (employer_id = auth.uid());