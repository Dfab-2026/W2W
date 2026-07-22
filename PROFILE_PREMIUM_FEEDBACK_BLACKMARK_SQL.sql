-- Work2Wish premium profile feedback + black mark support
alter table user_profiles add column if not exists black_mark_count integer default 0;
alter table workers add column if not exists black_mark_count integer default 0;
alter table employers add column if not exists black_mark_count integer default 0;

create table if not exists profile_black_marks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null,
  marked_by uuid not null,
  reason text not null,
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(profile_id, marked_by)
);

create table if not exists worker_feedbacks (
  id uuid primary key default gen_random_uuid(),
  application_id uuid,
  worker_id uuid,
  employer_id uuid,
  rating integer check (rating between 1 and 5),
  feedback_text text,
  created_at timestamptz default now(),
  unique(application_id, employer_id)
);

create table if not exists company_feedbacks (
  id uuid primary key default gen_random_uuid(),
  application_id uuid,
  company_id uuid,
  worker_id uuid,
  rating integer check (rating between 1 and 5),
  feedback_text text,
  created_at timestamptz default now(),
  unique(application_id, worker_id)
);

notify pgrst, 'reload schema';
