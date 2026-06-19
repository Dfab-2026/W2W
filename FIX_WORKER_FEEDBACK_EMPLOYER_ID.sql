-- FIX: worker_feedbacks missing employer_id column
-- Run this once in Supabase SQL Editor, then refresh/reload your app.

alter table public.worker_feedbacks
  add column if not exists employer_id uuid references public.employers(user_id) on delete cascade;

-- Keep one feedback per employer for each completed application.
create unique index if not exists worker_feedbacks_one_per_application
  on public.worker_feedbacks(application_id, employer_id);

create index if not exists worker_feedbacks_employer_id_idx
  on public.worker_feedbacks(employer_id);

create index if not exists worker_feedbacks_worker_id_created_at_idx
  on public.worker_feedbacks(worker_id, created_at desc);

-- RLS policies for employer-to-worker feedback.
alter table public.worker_feedbacks enable row level security;

drop policy if exists "worker_feedbacks_select_all" on public.worker_feedbacks;
create policy "worker_feedbacks_select_all"
  on public.worker_feedbacks for select
  using (true);

drop policy if exists "worker_feedbacks_insert_employers" on public.worker_feedbacks;
create policy "worker_feedbacks_insert_employers"
  on public.worker_feedbacks for insert
  with check (employer_id = auth.uid());

-- Refresh Supabase/PostgREST schema cache.
notify pgrst, 'reload schema';
