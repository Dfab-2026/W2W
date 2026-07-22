-- Work2Wish profile view feedback history + black mark support
-- Safe to run multiple times in Supabase SQL editor.

create table if not exists profile_black_marks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references user_profiles(id) on delete cascade,
  marked_by uuid references user_profiles(id) on delete set null,
  reason text not null,
  status text not null default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(profile_id, marked_by)
);

alter table user_profiles add column if not exists black_mark_count integer default 0;
alter table workers add column if not exists black_mark_count integer default 0;
alter table employers add column if not exists black_mark_count integer default 0;

create index if not exists idx_profile_black_marks_profile_id on profile_black_marks(profile_id);
create index if not exists idx_profile_black_marks_marked_by on profile_black_marks(marked_by);

create or replace function refresh_profile_black_mark_count(p_profile_id uuid)
returns integer
language plpgsql
as $$
declare
  v_count integer;
  v_role text;
begin
  select count(*) into v_count
  from profile_black_marks
  where profile_id = p_profile_id and status = 'active';

  update user_profiles
  set black_mark_count = v_count,
      updated_at = now()
  where id = p_profile_id
  returning role into v_role;

  if v_role = 'worker' then
    update workers set black_mark_count = v_count where user_id = p_profile_id;
  elsif v_role = 'employer' then
    update employers set black_mark_count = v_count where user_id = p_profile_id;
  end if;

  return v_count;
end;
$$;
