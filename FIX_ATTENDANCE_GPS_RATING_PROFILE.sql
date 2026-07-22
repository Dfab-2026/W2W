-- Work2Wish targeted fix: attendance GPS columns + manual attendance + feedback/rating columns
-- Run this once in Supabase SQL editor, then refresh/reload the app.

alter table if exists jobs add column if not exists attendance_latitude double precision;
alter table if exists jobs add column if not exists attendance_longitude double precision;
alter table if exists jobs add column if not exists attendance_radius_meters integer default 20;

alter table if exists attendance_records add column if not exists attendance_date date;
alter table if exists attendance_records add column if not exists date date;
alter table if exists attendance_records add column if not exists employer_id uuid;
alter table if exists attendance_records add column if not exists worker_id uuid;
alter table if exists attendance_records add column if not exists job_id uuid;
alter table if exists attendance_records add column if not exists status text default 'present';
alter table if exists attendance_records add column if not exists marked_by uuid;
alter table if exists attendance_records add column if not exists marked_at timestamptz default now();

update attendance_records set attendance_date = coalesce(attendance_date, date, created_at::date, now()::date) where attendance_date is null;
update attendance_records set date = coalesce(date, attendance_date, created_at::date, now()::date) where date is null;

create unique index if not exists attendance_records_application_date_uidx on attendance_records(application_id, attendance_date);

alter table if exists worker_feedbacks add column if not exists employer_id uuid;
alter table if exists worker_feedbacks add column if not exists worker_id uuid;
alter table if exists worker_feedbacks add column if not exists application_id uuid;
alter table if exists worker_feedbacks add column if not exists rating integer;
alter table if exists worker_feedbacks add column if not exists feedback_text text;
alter table if exists worker_feedbacks add column if not exists created_at timestamptz default now();

alter table if exists workers add column if not exists average_rating double precision default 0;
alter table if exists workers add column if not exists rating_average double precision default 0;
alter table if exists workers add column if not exists rating_count integer default 0;

notify pgrst, 'reload schema';
