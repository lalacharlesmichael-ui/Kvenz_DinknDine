-- Run this in the Supabase SQL Editor when booking submits say:
-- "Selected court is not configured in Supabase."
--
-- This assumes supabase/schema.sql has already created the tables, types,
-- triggers, and policies. It safely patches existing projects.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

do $$
begin
  alter type public.payment_method add value if not exists 'cash';
exception
  when duplicate_object then null;
end
$$;

alter table public.bookings
  add column if not exists court_amount numeric(10, 2) not null default 0 check (court_amount >= 0),
  add column if not exists paddle_qty integer not null default 0 check (paddle_qty >= 0),
  add column if not exists paddle_amount numeric(10, 2) not null default 0 check (paddle_amount >= 0),
  add column if not exists ball_qty integer not null default 0 check (ball_qty >= 0),
  add column if not exists ball_amount numeric(10, 2) not null default 0 check (ball_amount >= 0),
  add column if not exists addon_comments text;

update public.bookings
set court_amount = amount
where court_amount = 0
  and paddle_amount = 0
  and ball_amount = 0
  and amount > 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_no_overlapping_active_times'
  ) then
    alter table public.bookings
      add constraint bookings_no_overlapping_active_times
      exclude using gist (
        court_id with =,
        tstzrange(starts_at, ends_at, '[)') with &&
      )
      where (status in ('pending', 'approved'));
  end if;
end
$$;

insert into public.courts (
  id,
  name,
  surface,
  zone,
  price_per_hour,
  opens_at,
  closes_at,
  is_enabled
)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'Court A',
    'Cushioned acrylic',
    'Near entrance',
    420,
    '06:00',
    '22:00',
    true
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'Court B',
    'Outdoor hard court',
    'Garden side',
    380,
    '07:00',
    '21:00',
    true
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    'Court C',
    'Covered synthetic',
    'Training wing',
    500,
    '08:00',
    '23:00',
    true
  )
on conflict (id) do update
set
  name = excluded.name,
  surface = excluded.surface,
  zone = excluded.zone,
  price_per_hour = excluded.price_per_hour,
  opens_at = excluded.opens_at,
  closes_at = excluded.closes_at,
  is_enabled = excluded.is_enabled;

insert into public.court_slots (court_id, start_time)
select court_id::uuid, start_time::time
from (
  values
    ('11111111-1111-4111-8111-111111111111', '06:00'),
    ('11111111-1111-4111-8111-111111111111', '07:00'),
    ('11111111-1111-4111-8111-111111111111', '08:00'),
    ('11111111-1111-4111-8111-111111111111', '10:00'),
    ('11111111-1111-4111-8111-111111111111', '14:00'),
    ('11111111-1111-4111-8111-111111111111', '16:00'),
    ('11111111-1111-4111-8111-111111111111', '18:00'),
    ('11111111-1111-4111-8111-111111111111', '20:00'),
    ('22222222-2222-4222-8222-222222222222', '07:00'),
    ('22222222-2222-4222-8222-222222222222', '09:00'),
    ('22222222-2222-4222-8222-222222222222', '11:00'),
    ('22222222-2222-4222-8222-222222222222', '13:00'),
    ('22222222-2222-4222-8222-222222222222', '15:00'),
    ('22222222-2222-4222-8222-222222222222', '17:00'),
    ('22222222-2222-4222-8222-222222222222', '19:00'),
    ('33333333-3333-4333-8333-333333333333', '08:00'),
    ('33333333-3333-4333-8333-333333333333', '09:00'),
    ('33333333-3333-4333-8333-333333333333', '12:00'),
    ('33333333-3333-4333-8333-333333333333', '14:00'),
    ('33333333-3333-4333-8333-333333333333', '16:00'),
    ('33333333-3333-4333-8333-333333333333', '18:00'),
    ('33333333-3333-4333-8333-333333333333', '21:00')
) as slots(court_id, start_time)
on conflict (court_id, start_time) do nothing;

insert into public.payment_settings (
  id,
  gcash_number,
  bank_name,
  bank_account_name,
  bank_account_number,
  qr_code_path
)
values (
  true,
  '0917 555 0188',
  'BPI',
  'KVENS PLACE DINK & DINE',
  '0082-4411-9920',
  'payment-qr.svg'
)
on conflict (id) do nothing;
