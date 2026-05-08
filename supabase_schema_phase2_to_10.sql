-- Work2Wish Phase 2-10 database updates
-- Run this once in Supabase SQL Editor after the existing schema.

alter table public.workers add column if not exists gender text;
alter table public.workers add column if not exists experience_level text;
alter table public.workers add column if not exists languages_known text[] default '{}';
alter table public.workers add column if not exists bank_account text;
alter table public.workers add column if not exists upi_id text;
alter table public.workers add column if not exists selfie_url text;
alter table public.workers add column if not exists certificate_url text;
alter table public.workers add column if not exists previous_employer_reference text;
alter table public.workers add column if not exists verification_status text default 'not_submitted';
alter table public.workers add column if not exists verification_notes text;
alter table public.workers add column if not exists verification_submitted_at timestamptz;

alter table public.employers add column if not exists company_size text;
alter table public.employers add column if not exists hr_contact text;
alter table public.employers add column if not exists official_email text;
alter table public.employers add column if not exists company_address text;
alter table public.employers add column if not exists gst_number text;
alter table public.employers add column if not exists aadhaar_number text;
alter table public.employers add column if not exists pan_number text;
alter table public.employers add column if not exists aadhaar_front_url text;
alter table public.employers add column if not exists aadhaar_back_url text;
alter table public.employers add column if not exists pan_image_url text;
alter table public.employers add column if not exists pan_back_url text;
alter table public.employers add column if not exists gst_certificate_url text;
alter table public.employers add column if not exists verification_status text default 'not_submitted';
alter table public.employers add column if not exists verification_notes text;
alter table public.employers add column if not exists verification_submitted_at timestamptz;

alter table public.jobs add column if not exists workers_needed int default 1;
alter table public.jobs add column if not exists skill_needed text;
alter table public.jobs add column if not exists shift_timing text;
alter table public.jobs add column if not exists experience text;
alter table public.jobs add column if not exists contact_number text;
alter table public.jobs add column if not exists accommodation_available boolean default false;
alter table public.jobs add column if not exists food_included boolean default false;
alter table public.jobs add column if not exists urgent_hiring boolean default false;
alter table public.jobs add column if not exists overtime_available boolean default false;
alter table public.jobs add column if not exists transportation_provided boolean default false;

alter table public.messages add column if not exists edited_at timestamptz;
alter table public.messages add column if not exists deleted_for uuid[] default '{}';
alter table public.messages add column if not exists deleted_for_everyone boolean default false;
