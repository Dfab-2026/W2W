create table if not exists application_payments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid,
  employer_id uuid,
  worker_id uuid,
  amount integer,
  currency text default 'INR',
  status text default 'created',
  razorpay_order_id text unique,
  razorpay_payment_id text unique,
  raw_response jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table application_payments
add column if not exists application_id uuid,
add column if not exists employer_id uuid,
add column if not exists worker_id uuid,
add column if not exists amount integer,
add column if not exists currency text default 'INR',
add column if not exists status text default 'created',
add column if not exists razorpay_order_id text,
add column if not exists razorpay_payment_id text,
add column if not exists raw_response jsonb,
add column if not exists created_at timestamptz default now(),
add column if not exists updated_at timestamptz default now();

create unique index if not exists application_payments_razorpay_order_id_uidx
on application_payments (razorpay_order_id)
where razorpay_order_id is not null;

create unique index if not exists application_payments_razorpay_payment_id_uidx
on application_payments (razorpay_payment_id)
where razorpay_payment_id is not null;
