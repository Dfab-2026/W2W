-- Work2Wish profile popup feedback + black mark support
-- Run once in Supabase before deploying this update.

alter table if exists public.user_profiles add column if not exists black_mark_count integer default 0;
alter table if exists public.workers add column if not exists black_mark_count integer default 0;
alter table if exists public.employers add column if not exists black_mark_count integer default 0;

create table if not exists public.profile_black_marks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null,
  marked_by uuid not null,
  reason text not null,
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(profile_id, marked_by)
);

create table if not exists public.worker_feedbacks (
  id uuid primary key default gen_random_uuid(),
  application_id uuid,
  worker_id uuid,
  employer_id uuid,
  rating integer check (rating between 1 and 5),
  feedback_text text,
  created_at timestamptz default now()
);

create table if not exists public.company_feedbacks (
  id uuid primary key default gen_random_uuid(),
  application_id uuid,
  company_id uuid,
  worker_id uuid,
  rating integer check (rating between 1 and 5),
  feedback_text text,
  created_at timestamptz default now()
);

create index if not exists idx_profile_black_marks_profile_status on public.profile_black_marks(profile_id, status, created_at desc);
create index if not exists idx_worker_feedbacks_worker_created on public.worker_feedbacks(worker_id, created_at desc);
create index if not exists idx_company_feedbacks_company_created on public.company_feedbacks(company_id, created_at desc);

notify pgrst, 'reload schema';
