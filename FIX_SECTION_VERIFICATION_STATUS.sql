-- Work2Wish section verification status support
-- Run this if Worker/Employer document/profile/bank cards still show Pending after admin approval.

alter table workers add column if not exists section_statuses jsonb default '{}'::jsonb;
alter table workers add column if not exists verified_sections jsonb default '[]'::jsonb;
alter table workers add column if not exists profile_verified boolean default false;
alter table workers add column if not exists bank_verified boolean default false;
alter table workers add column if not exists documents_verified boolean default false;
alter table workers add column if not exists document_verified boolean default false;
alter table workers add column if not exists verification_verified boolean default false;

alter table employers add column if not exists section_statuses jsonb default '{}'::jsonb;
alter table employers add column if not exists verified_sections jsonb default '[]'::jsonb;
alter table employers add column if not exists profile_verified boolean default false;
alter table employers add column if not exists documents_verified boolean default false;
alter table employers add column if not exists document_verified boolean default false;
alter table employers add column if not exists verification_verified boolean default false;

-- Optional one-time repair for already verified users
update workers
set section_statuses = jsonb_build_object('profile','verified','bank','verified','documents','verified','verification','verified'),
    verified_sections = '["profile","bank","documents"]'::jsonb,
    profile_verified = true, bank_verified = true, documents_verified = true, document_verified = true, verification_verified = true
where verified = true;

update employers
set section_statuses = jsonb_build_object('profile','verified','documents','verified','verification','verified'),
    verified_sections = '["profile","documents"]'::jsonb,
    profile_verified = true, documents_verified = true, document_verified = true, verification_verified = true
where verified = true;
