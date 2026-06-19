-- Work2Wish app update / maintenance mode
-- Run this once in Supabase SQL Editor.
create table if not exists public.app_settings (
  id integer primary key default 1,
  maintenance_mode boolean not null default false,
  maintenance_title text not null default 'App Update in Progress',
  maintenance_message text not null default 'We are improving Work2Wish. Please try again shortly.',
  maintenance_eta text not null default '30 minutes',
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id, maintenance_mode, maintenance_title, maintenance_message, maintenance_eta)
values (1, false, 'App Update in Progress', 'We are improving Work2Wish. Please try again shortly.', '30 minutes')
on conflict (id) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists "app_settings_read_all" on public.app_settings;
create policy "app_settings_read_all" on public.app_settings
for select using (true);

drop policy if exists "app_settings_admin_update" on public.app_settings;
create policy "app_settings_admin_update" on public.app_settings
for all using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and lower(coalesce(p.role, '')) = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and lower(coalesce(p.role, '')) = 'admin'
  )
);

notify pgrst, 'reload schema';
