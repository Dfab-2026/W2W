-- Work2Wish targeted final fix
-- Run once in Supabase SQL editor, then hard refresh the app.

alter table if exists jobs add column if not exists attendance_latitude double precision;
alter table if exists jobs add column if not exists attendance_longitude double precision;
alter table if exists jobs add column if not exists attendance_radius_meters integer default 20;

alter table if exists workers add column if not exists average_rating double precision default 0;
alter table if exists workers add column if not exists rating_average double precision default 0;
alter table if exists workers add column if not exists rating_count integer default 0;

alter table if exists employers add column if not exists average_rating double precision default 0;
alter table if exists employers add column if not exists rating_average double precision default 0;
alter table if exists employers add column if not exists rating_count integer default 0;

-- Recalculate worker averages from all existing employer feedbacks.
update workers w
set average_rating = coalesce(x.avg_rating, 0),
    rating_average = coalesce(x.avg_rating, 0),
    rating_count = coalesce(x.rating_count, 0)
from (
  select worker_id, round(avg(rating)::numeric, 2)::double precision as avg_rating, count(*)::integer as rating_count
  from worker_feedbacks
  where rating is not null
  group by worker_id
) x
where w.user_id = x.worker_id;

-- Recalculate employer/company averages from all existing worker feedbacks.
update employers e
set average_rating = coalesce(x.avg_rating, 0),
    rating_average = coalesce(x.avg_rating, 0),
    rating_count = coalesce(x.rating_count, 0)
from (
  select company_id, round(avg(rating)::numeric, 2)::double precision as avg_rating, count(*)::integer as rating_count
  from company_feedbacks
  where rating is not null
  group by company_id
) x
where e.user_id = x.company_id;

notify pgrst, 'reload schema';
