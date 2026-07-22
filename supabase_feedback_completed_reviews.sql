-- Work2Wish completed-work feedback and public rating update
-- Run this in Supabase SQL editor before testing the feedback flow.

create table if not exists public.worker_feedbacks (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(user_id) on delete cascade,
  employer_id uuid not null references public.employers(user_id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  rating int not null check (rating >= 1 and rating <= 5),
  feedback_text text not null,
  created_at timestamptz default now()
);

create table if not exists public.company_feedbacks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.employers(user_id) on delete cascade,
  worker_id uuid not null references public.workers(user_id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  rating int not null check (rating >= 1 and rating <= 5),
  feedback_text text not null,
  created_at timestamptz default now()
);

alter table public.workers
  add column if not exists average_rating numeric default 0;

alter table public.employers
  add column if not exists average_rating numeric default 0;

-- One feedback per completed application per side.
create unique index if not exists worker_feedbacks_one_per_application
  on public.worker_feedbacks(application_id, employer_id);

create unique index if not exists company_feedbacks_one_per_application
  on public.company_feedbacks(application_id, worker_id);

create index if not exists worker_feedbacks_worker_id_created_at_idx
  on public.worker_feedbacks(worker_id, created_at desc);

create index if not exists company_feedbacks_company_id_created_at_idx
  on public.company_feedbacks(company_id, created_at desc);

alter table public.worker_feedbacks enable row level security;
alter table public.company_feedbacks enable row level security;

drop policy if exists "worker_feedbacks_select_all" on public.worker_feedbacks;
create policy "worker_feedbacks_select_all"
  on public.worker_feedbacks for select
  using (true);

drop policy if exists "company_feedbacks_select_all" on public.company_feedbacks;
create policy "company_feedbacks_select_all"
  on public.company_feedbacks for select
  using (true);

drop policy if exists "worker_feedbacks_insert_employers" on public.worker_feedbacks;
create policy "worker_feedbacks_insert_employers"
  on public.worker_feedbacks for insert
  with check (employer_id = auth.uid());

drop policy if exists "company_feedbacks_insert_workers" on public.company_feedbacks;
create policy "company_feedbacks_insert_workers"
  on public.company_feedbacks for insert
  with check (worker_id = auth.uid());


-- Ensure existing databases also get employer_id when worker_feedbacks already exists.
alter table public.worker_feedbacks
  add column if not exists employer_id uuid references public.employers(user_id) on delete cascade;

