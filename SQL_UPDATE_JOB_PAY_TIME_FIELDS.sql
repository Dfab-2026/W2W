-- Work2Wish job posting pay/time fields update
-- Run this once in Supabase SQL editor if your jobs table is already created.

alter table public.jobs add column if not exists hourly_pay numeric default 0;
alter table public.jobs add column if not exists pay_type text default 'daily';
alter table public.jobs add column if not exists duration_hours int default 0;
alter table public.jobs add column if not exists work_duration_type text default 'days';
alter table public.jobs add column if not exists end_date date;
alter table public.jobs add column if not exists start_time text;
alter table public.jobs add column if not exists start_meridiem text;
alter table public.jobs add column if not exists end_time text;
alter table public.jobs add column if not exists end_meridiem text;
alter table public.jobs add column if not exists work_time_range text;
alter table public.jobs add column if not exists attendance_radius_meters int default 20;
