create extension if not exists pgcrypto;
create extension if not exists btree_gist;

do $$
begin
  create type public.app_role as enum ('player', 'admin');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.booking_status as enum ('pending', 'approved', 'rejected', 'cancelled', 'completed');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.payment_method as enum ('gcash', 'bank_transfer');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.verification_status as enum ('awaiting_proof', 'submitted', 'verified', 'rejected');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.skill_level as enum ('beginner', 'novice', 'intermediate', 'advanced', 'all_levels');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.open_play_format as enum ('mens_doubles', 'womens_doubles', 'mixed_doubles');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter type public.skill_level add value if not exists 'novice' after 'beginner';
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.program_status as enum ('draft', 'scheduled', 'open', 'full', 'closed', 'in_progress', 'completed');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.registration_status as enum ('pending', 'approved', 'registered', 'rejected', 'cancelled');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'player',
  username text,
  auth_email text,
  full_name text not null default '',
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (
    username is null or username ~ '^[a-z0-9_]{3,32}$'
  )
);

alter table public.profiles
  add column if not exists username text,
  add column if not exists auth_email text;

do $$
begin
  alter table public.profiles
    add constraint profiles_username_format check (
      username is null or username ~ '^[a-z0-9_]{3,32}$'
    );
exception
  when duplicate_object then null;
end
$$;

create unique index if not exists profiles_username_unique_idx
on public.profiles (lower(username))
where username is not null;

create unique index if not exists profiles_auth_email_unique_idx
on public.profiles (lower(auth_email))
where auth_email is not null;

create table if not exists public.courts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  surface text not null default 'standard',
  zone text,
  price_per_hour numeric(10, 2) not null check (price_per_hour >= 0),
  night_price_per_hour numeric(10, 2) check (night_price_per_hour is null or night_price_per_hour >= 0),
  night_starts_at time not null default '17:00',
  opens_at time not null default '06:00',
  closes_at time not null default '22:00',
  is_enabled boolean not null default true,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint courts_hours_valid check (opens_at <> closes_at)
);

alter table public.courts
  add column if not exists night_price_per_hour numeric(10, 2) check (night_price_per_hour is null or night_price_per_hour >= 0),
  add column if not exists night_starts_at time not null default '17:00',
  add column if not exists image_url text;

create table if not exists public.court_slots (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references public.courts(id) on delete cascade,
  start_time time not null,
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (court_id, start_time)
);

insert into public.courts (
  id,
  name,
  surface,
  zone,
  price_per_hour,
  opens_at,
  closes_at,
  is_enabled,
  image_url
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
    true,
    'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?q=80&w=1200&auto=format&fit=crop'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'Court B',
    'Outdoor hard court',
    'Garden side',
    380,
    '07:00',
    '21:00',
    true,
    'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?q=80&w=1200&auto=format&fit=crop'
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    'Court C',
    'Covered synthetic',
    'Training wing',
    500,
    '08:00',
    '23:00',
    true,
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1200&auto=format&fit=crop'
  )
on conflict (id) do update
set
  name = excluded.name,
  surface = excluded.surface,
  zone = excluded.zone,
  price_per_hour = excluded.price_per_hour,
  opens_at = excluded.opens_at,
  closes_at = excluded.closes_at,
  is_enabled = excluded.is_enabled,
  image_url = coalesce(excluded.image_url, public.courts.image_url);

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

create table if not exists public.blocked_slots (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references public.courts(id) on delete cascade,
  block_date date not null,
  start_time time not null,
  end_time time not null,
  reason text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint blocked_slots_time_valid check (start_time < end_time)
);

create table if not exists public.payment_settings (
  id boolean primary key default true,
  gcash_number text not null default '',
  bank_name text not null default '',
  bank_account_name text not null default '',
  bank_account_number text not null default '',
  qr_code_path text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  constraint payment_settings_singleton check (id)
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references public.courts(id),
  player_id uuid not null references public.profiles(id) on delete cascade,
  booking_date date not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  hours numeric(4, 2) not null check (hours > 0),
  amount numeric(10, 2) not null check (amount >= 0),
  status public.booking_status not null default 'pending',
  payment_method public.payment_method not null,
  payment_amount numeric(10, 2) not null check (payment_amount >= 0),
  payment_reference text,
  receipt_path text,
  payment_date timestamptz,
  payment_status public.verification_status not null default 'awaiting_proof',
  court_amount numeric(10, 2) not null default 0 check (court_amount >= 0),
  paddle_qty integer not null default 0 check (paddle_qty >= 0),
  paddle_amount numeric(10, 2) not null default 0 check (paddle_amount >= 0),
  ball_qty integer not null default 0 check (ball_qty >= 0),
  ball_amount numeric(10, 2) not null default 0 check (ball_amount >= 0),
  addon_comments text,
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  rejection_reason text,
  hold_expires_at timestamptz not null default (now() + interval '30 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_time_valid check (starts_at < ends_at)
);

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

create table if not exists public.open_play_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  court_id uuid not null references public.courts(id),
  session_date date not null,
  starts_at time not null,
  ends_at time not null,
  skill_level public.skill_level not null default 'all_levels',
  skill_levels public.skill_level[] not null default array['all_levels'::public.skill_level],
  formats public.open_play_format[] not null default array['mixed_doubles'::public.open_play_format],
  max_players integer not null check (max_players > 0),
  fee numeric(10, 2) not null default 0 check (fee >= 0),
  status public.program_status not null default 'scheduled',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint open_play_time_valid check (starts_at < ends_at)
);

alter table public.open_play_sessions
  add column if not exists skill_levels public.skill_level[] not null default array['all_levels'::public.skill_level],
  add column if not exists formats public.open_play_format[] not null default array['mixed_doubles'::public.open_play_format];

update public.open_play_sessions
set skill_levels = array[skill_level]
where cardinality(skill_levels) = 0;

create table if not exists public.open_play_session_courts (
  session_id uuid not null references public.open_play_sessions(id) on delete cascade,
  court_id uuid not null references public.courts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (session_id, court_id)
);

create table if not exists public.open_play_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.open_play_sessions(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  skill_level public.skill_level not null default 'beginner',
  status public.registration_status not null default 'pending',
  payment_method public.payment_method,
  payment_amount numeric(10, 2) not null default 0 check (payment_amount >= 0),
  payment_reference text,
  receipt_path text,
  payment_status public.verification_status not null default 'awaiting_proof',
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, player_id)
);

alter table public.open_play_participants
  add column if not exists skill_level public.skill_level not null default 'beginner',
  add column if not exists payment_method public.payment_method,
  add column if not exists payment_amount numeric(10, 2) not null default 0 check (payment_amount >= 0),
  add column if not exists payment_reference text,
  add column if not exists receipt_path text,
  add column if not exists payment_status public.verification_status not null default 'awaiting_proof',
  add column if not exists verified_by uuid references public.profiles(id),
  add column if not exists verified_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.open_play_matches (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.open_play_sessions(id) on delete cascade,
  round text not null check (round in ('elimination', 'semifinals', 'finals')),
  match_order integer not null default 1 check (match_order > 0),
  skill_level public.skill_level not null default 'beginner',
  player_one_id uuid references public.profiles(id),
  player_two_id uuid references public.profiles(id),
  player_one_label text not null,
  player_two_label text not null,
  player_one_score integer,
  player_two_score integer,
  winner_id uuid references public.profiles(id),
  winner_label text,
  next_match_id uuid references public.open_play_matches(id),
  bracket_position text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tournament_date date not null,
  registration_deadline timestamptz not null,
  category text not null check (category in ('singles', 'doubles')),
  division text not null check (division in ('beginner', 'intermediate', 'advanced', 'open')),
  registration_fee numeric(10, 2) not null default 0 check (registration_fee >= 0),
  participant_limit integer not null check (participant_limit > 0),
  status public.program_status not null default 'open',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tournament_participants (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  partner_name text,
  status public.registration_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (tournament_id, player_id)
);

create table if not exists public.tournament_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  court_id uuid references public.courts(id),
  scheduled_at timestamptz,
  player_one_label text not null,
  player_two_label text not null,
  player_one_score integer,
  player_two_score integer,
  winner_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  image_path text,
  starts_at timestamptz not null,
  location text not null,
  registration_deadline timestamptz not null,
  participation_fee numeric(10, 2) not null default 0 check (participation_fee >= 0),
  max_attendees integer not null check (max_attendees > 0),
  status public.program_status not null default 'open',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  status public.registration_status not null default 'registered',
  created_at timestamptz not null default now(),
  unique (event_id, player_id)
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  is_published boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists bookings_player_date_idx on public.bookings (player_id, booking_date desc);
create index if not exists bookings_court_time_idx on public.bookings (court_id, starts_at, ends_at);
create index if not exists bookings_status_idx on public.bookings (status, payment_status);
create index if not exists open_play_session_date_idx on public.open_play_sessions (session_date);
create index if not exists open_play_session_courts_court_idx on public.open_play_session_courts (court_id);
create index if not exists open_play_participants_session_idx on public.open_play_participants (session_id, status, payment_status);
create index if not exists open_play_matches_session_round_idx on public.open_play_matches (session_id, round, match_order);
create index if not exists tournaments_date_idx on public.tournaments (tournament_date);
create index if not exists events_starts_at_idx on public.events (starts_at);
create index if not exists notifications_recipient_created_idx on public.notifications (recipient_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists courts_set_updated_at on public.courts;
create trigger courts_set_updated_at
before update on public.courts
for each row execute function public.set_updated_at();

drop trigger if exists bookings_set_updated_at on public.bookings;
create trigger bookings_set_updated_at
before update on public.bookings
for each row execute function public.set_updated_at();

drop trigger if exists open_play_sessions_set_updated_at on public.open_play_sessions;
create trigger open_play_sessions_set_updated_at
before update on public.open_play_sessions
for each row execute function public.set_updated_at();

drop trigger if exists open_play_participants_set_updated_at on public.open_play_participants;
create trigger open_play_participants_set_updated_at
before update on public.open_play_participants
for each row execute function public.set_updated_at();

drop trigger if exists open_play_matches_set_updated_at on public.open_play_matches;
create trigger open_play_matches_set_updated_at
before update on public.open_play_matches
for each row execute function public.set_updated_at();

drop trigger if exists tournaments_set_updated_at on public.tournaments;
create trigger tournaments_set_updated_at
before update on public.tournaments
for each row execute function public.set_updated_at();

drop trigger if exists tournament_matches_set_updated_at on public.tournament_matches;
create trigger tournament_matches_set_updated_at
before update on public.tournament_matches
for each row execute function public.set_updated_at();

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, auth_email, full_name, role)
  values (
    new.id,
    nullif(lower(regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', ''), '[^a-z0-9_]', '', 'g')), ''),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'player'::public.app_role
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.current_profile_role()
returns public.app_role
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_manager()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(public.current_profile_role() = 'admin', false)
$$;

create or replace function public.prevent_unauthorized_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role is distinct from new.role and not public.is_manager() then
    raise exception 'Only managers can change profile roles';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_role_guard on public.profiles;
create trigger profiles_role_guard
before update on public.profiles
for each row execute function public.prevent_unauthorized_role_change();

create or replace function public.expire_unpaid_booking_holds()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_rows integer;
begin
  update public.bookings
  set
    status = 'cancelled',
    rejection_reason = coalesce(
      rejection_reason,
      'Payment proof was not uploaded before the hold expired.'
    )
  where
    status = 'pending'
    and payment_status = 'awaiting_proof'
    and hold_expires_at < now();

  get diagnostics affected_rows = row_count;
  return affected_rows;
end;
$$;

create or replace function public.enforce_booking_availability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  court_record public.courts%rowtype;
begin
  select *
  into court_record
  from public.courts
  where id = new.court_id
  for update;

  if court_record.id is null or not court_record.is_enabled then
    raise exception 'Court is not available';
  end if;

  if (new.starts_at at time zone 'Asia/Manila')::time < court_record.opens_at or (new.ends_at at time zone 'Asia/Manila')::time > court_record.closes_at then
    raise exception 'Booking is outside operating hours';
  end if;

  if exists (
    select 1
    from public.blocked_slots
    where blocked_slots.court_id = new.court_id
      and blocked_slots.block_date = new.booking_date
      and (new.starts_at at time zone 'Asia/Manila')::time < blocked_slots.end_time
      and blocked_slots.start_time < (new.ends_at at time zone 'Asia/Manila')::time
  ) then

    raise exception 'Court is blocked during this time';
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_availability_check on public.bookings;
create trigger bookings_availability_check
before insert or update of court_id, booking_date, starts_at, ends_at, status
on public.bookings
for each row
when (new.status in ('pending', 'approved'))
execute function public.enforce_booking_availability();

create or replace function public.enforce_open_play_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  max_count integer;
  current_count integer;
begin
  select max_players
  into max_count
  from public.open_play_sessions
  where id = new.session_id and status = 'scheduled'
  for update;

  if max_count is null then
    raise exception 'Open-play session is not available';
  end if;

  select count(*)
  into current_count
  from public.open_play_participants
  where session_id = new.session_id and status in ('approved', 'registered');

  if current_count >= max_count then
    raise exception 'Open-play session is full';
  end if;

  return new;
end;
$$;

drop trigger if exists open_play_capacity_check on public.open_play_participants;
create trigger open_play_capacity_check
before insert on public.open_play_participants
for each row execute function public.enforce_open_play_capacity();

create or replace function public.enforce_event_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  max_count integer;
  current_count integer;
begin
  select max_attendees
  into max_count
  from public.events
  where id = new.event_id and status = 'open'
  for update;

  if max_count is null then
    raise exception 'Event is not open for registration';
  end if;

  select count(*)
  into current_count
  from public.event_registrations
  where event_id = new.event_id and status = 'registered';

  if current_count >= max_count then
    raise exception 'Event is full';
  end if;

  return new;
end;
$$;

drop trigger if exists event_capacity_check on public.event_registrations;
create trigger event_capacity_check
before insert on public.event_registrations
for each row execute function public.enforce_event_capacity();

create or replace function public.enforce_tournament_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  max_count integer;
  current_count integer;
begin
  select participant_limit
  into max_count
  from public.tournaments
  where id = new.tournament_id
    and status = 'open'
    and registration_deadline >= now()
  for update;

  if max_count is null then
    raise exception 'Tournament is not open for registration';
  end if;

  select count(*)
  into current_count
  from public.tournament_participants
  where tournament_id = new.tournament_id
    and status in ('pending', 'approved', 'registered');

  if current_count >= max_count then
    raise exception 'Tournament registration is full';
  end if;

  return new;
end;
$$;

drop trigger if exists tournament_capacity_check on public.tournament_participants;
create trigger tournament_capacity_check
before insert on public.tournament_participants
for each row execute function public.enforce_tournament_capacity();

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

alter table public.profiles enable row level security;
alter table public.courts enable row level security;
alter table public.court_slots enable row level security;
alter table public.blocked_slots enable row level security;
alter table public.payment_settings enable row level security;
alter table public.bookings enable row level security;
alter table public.open_play_sessions enable row level security;
alter table public.open_play_session_courts enable row level security;
alter table public.open_play_participants enable row level security;
alter table public.open_play_matches enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_participants enable row level security;
alter table public.tournament_matches enable row level security;
alter table public.events enable row level security;
alter table public.event_registrations enable row level security;
alter table public.announcements enable row level security;
alter table public.notifications enable row level security;

drop policy if exists profiles_select_own_or_manager on public.profiles;
create policy profiles_select_own_or_manager
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_manager());

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self
on public.profiles for insert
to authenticated
with check (id = auth.uid() and role = 'player');

drop policy if exists profiles_update_own_or_manager on public.profiles;
create policy profiles_update_own_or_manager
on public.profiles for update
to authenticated
using (id = auth.uid() or public.is_manager())
with check (id = auth.uid() or public.is_manager());

drop policy if exists profiles_manager_all on public.profiles;
create policy profiles_manager_all
on public.profiles for all
to authenticated
using (public.is_manager())
with check (public.is_manager());

drop policy if exists courts_select_enabled_or_manager on public.courts;
create policy courts_select_enabled_or_manager
on public.courts for select
to authenticated
using (is_enabled or public.is_manager());

drop policy if exists courts_manager_all on public.courts;
create policy courts_manager_all
on public.courts for all
to authenticated
using (public.is_manager())
with check (public.is_manager());

drop policy if exists court_slots_select_available_or_manager on public.court_slots;
create policy court_slots_select_available_or_manager
on public.court_slots for select
to authenticated
using (
  is_enabled
  and exists (
    select 1
    from public.courts
    where courts.id = court_slots.court_id
      and (courts.is_enabled or public.is_manager())
  )
);

drop policy if exists court_slots_manager_all on public.court_slots;
create policy court_slots_manager_all
on public.court_slots for all
to authenticated
using (public.is_manager())
with check (public.is_manager());

drop policy if exists blocked_slots_select_authenticated on public.blocked_slots;
create policy blocked_slots_select_authenticated
on public.blocked_slots for select
to authenticated
using (true);

drop policy if exists blocked_slots_manager_all on public.blocked_slots;
create policy blocked_slots_manager_all
on public.blocked_slots for all
to authenticated
using (public.is_manager())
with check (public.is_manager());

drop policy if exists payment_settings_select_authenticated on public.payment_settings;
create policy payment_settings_select_authenticated
on public.payment_settings for select
to authenticated
using (true);

drop policy if exists payment_settings_manager_all on public.payment_settings;
create policy payment_settings_manager_all
on public.payment_settings for all
to authenticated
using (public.is_manager())
with check (public.is_manager());

drop policy if exists bookings_select_own_or_manager on public.bookings;
create policy bookings_select_own_or_manager
on public.bookings for select
to authenticated
using (player_id = auth.uid() or public.is_manager());

drop policy if exists bookings_insert_own_pending on public.bookings;
create policy bookings_insert_own_pending
on public.bookings for insert
to authenticated
with check (
  player_id = auth.uid()
  and status = 'pending'
  and payment_status in ('awaiting_proof', 'submitted')
);

drop policy if exists bookings_player_update_pending on public.bookings;
create policy bookings_player_update_pending
on public.bookings for update
to authenticated
using (player_id = auth.uid() and status = 'pending')
with check (
  player_id = auth.uid()
  and status in ('pending', 'cancelled')
);

drop policy if exists bookings_manager_all on public.bookings;
create policy bookings_manager_all
on public.bookings for all
to authenticated
using (public.is_manager())
with check (public.is_manager());

drop policy if exists open_play_sessions_select_open_or_manager on public.open_play_sessions;
create policy open_play_sessions_select_open_or_manager
on public.open_play_sessions for select
to authenticated
using (status in ('scheduled', 'open', 'full') or public.is_manager());

drop policy if exists open_play_sessions_manager_all on public.open_play_sessions;
create policy open_play_sessions_manager_all
on public.open_play_sessions for all
to authenticated
using (public.is_manager())
with check (public.is_manager());

drop policy if exists open_play_session_courts_select_visible_or_manager on public.open_play_session_courts;
create policy open_play_session_courts_select_visible_or_manager
on public.open_play_session_courts for select
to authenticated
using (
  public.is_manager()
  or exists (
    select 1
    from public.open_play_sessions
    where open_play_sessions.id = open_play_session_courts.session_id
      and open_play_sessions.status in ('scheduled', 'open', 'full', 'in_progress', 'completed')
  )
);

drop policy if exists open_play_session_courts_manager_all on public.open_play_session_courts;
create policy open_play_session_courts_manager_all
on public.open_play_session_courts for all
to authenticated
using (public.is_manager())
with check (public.is_manager());

drop policy if exists open_play_participants_select_own_or_manager on public.open_play_participants;
create policy open_play_participants_select_own_or_manager
on public.open_play_participants for select
to authenticated
using (player_id = auth.uid() or public.is_manager());

drop policy if exists open_play_participants_insert_own on public.open_play_participants;
create policy open_play_participants_insert_own
on public.open_play_participants for insert
to authenticated
with check (
  player_id = auth.uid()
  and status = 'pending'
  and payment_status in ('awaiting_proof', 'submitted')
);

drop policy if exists open_play_participants_update_own_pending on public.open_play_participants;
create policy open_play_participants_update_own_pending
on public.open_play_participants for update
to authenticated
using (player_id = auth.uid() and status = 'pending')
with check (player_id = auth.uid() and status in ('pending', 'cancelled'));

drop policy if exists open_play_participants_delete_own_or_manager on public.open_play_participants;
create policy open_play_participants_delete_own_or_manager
on public.open_play_participants for delete
to authenticated
using (player_id = auth.uid() or public.is_manager());

drop policy if exists open_play_participants_manager_all on public.open_play_participants;
create policy open_play_participants_manager_all
on public.open_play_participants for all
to authenticated
using (public.is_manager())
with check (public.is_manager());

drop policy if exists open_play_matches_select_authenticated on public.open_play_matches;
create policy open_play_matches_select_authenticated
on public.open_play_matches for select
to authenticated
using (
  public.is_manager()
  or exists (
    select 1
    from public.open_play_sessions
    where open_play_sessions.id = open_play_matches.session_id
      and open_play_sessions.status in ('scheduled', 'open', 'full', 'in_progress', 'completed')
  )
);

drop policy if exists open_play_matches_manager_all on public.open_play_matches;
create policy open_play_matches_manager_all
on public.open_play_matches for all
to authenticated
using (public.is_manager())
with check (public.is_manager());

drop policy if exists tournaments_select_open_or_manager on public.tournaments;
create policy tournaments_select_open_or_manager
on public.tournaments for select
to authenticated
using (status in ('open', 'in_progress', 'completed') or public.is_manager());

drop policy if exists tournaments_manager_all on public.tournaments;
create policy tournaments_manager_all
on public.tournaments for all
to authenticated
using (public.is_manager())
with check (public.is_manager());

drop policy if exists tournament_participants_select_own_or_manager on public.tournament_participants;
create policy tournament_participants_select_own_or_manager
on public.tournament_participants for select
to authenticated
using (player_id = auth.uid() or public.is_manager());

drop policy if exists tournament_participants_insert_own on public.tournament_participants;
create policy tournament_participants_insert_own
on public.tournament_participants for insert
to authenticated
with check (player_id = auth.uid() and status = 'pending');

drop policy if exists tournament_participants_manager_all on public.tournament_participants;
create policy tournament_participants_manager_all
on public.tournament_participants for all
to authenticated
using (public.is_manager())
with check (public.is_manager());

drop policy if exists tournament_matches_select_registered_or_manager on public.tournament_matches;
create policy tournament_matches_select_registered_or_manager
on public.tournament_matches for select
to authenticated
using (
  public.is_manager()
  or exists (
    select 1
    from public.tournaments
    where tournaments.id = tournament_matches.tournament_id
      and tournaments.status in ('open', 'in_progress', 'completed')
  )
);

drop policy if exists tournament_matches_manager_all on public.tournament_matches;
create policy tournament_matches_manager_all
on public.tournament_matches for all
to authenticated
using (public.is_manager())
with check (public.is_manager());

drop policy if exists events_select_open_or_manager on public.events;
create policy events_select_open_or_manager
on public.events for select
to authenticated
using (status = 'open' or public.is_manager());

drop policy if exists events_manager_all on public.events;
create policy events_manager_all
on public.events for all
to authenticated
using (public.is_manager())
with check (public.is_manager());

drop policy if exists event_registrations_select_own_or_manager on public.event_registrations;
create policy event_registrations_select_own_or_manager
on public.event_registrations for select
to authenticated
using (player_id = auth.uid() or public.is_manager());

drop policy if exists event_registrations_insert_own on public.event_registrations;
create policy event_registrations_insert_own
on public.event_registrations for insert
to authenticated
with check (player_id = auth.uid());

drop policy if exists event_registrations_delete_own_or_manager on public.event_registrations;
create policy event_registrations_delete_own_or_manager
on public.event_registrations for delete
to authenticated
using (player_id = auth.uid() or public.is_manager());

drop policy if exists announcements_select_published on public.announcements;
create policy announcements_select_published
on public.announcements for select
to authenticated
using (is_published or public.is_manager());

drop policy if exists announcements_manager_all on public.announcements;
create policy announcements_manager_all
on public.announcements for all
to authenticated
using (public.is_manager())
with check (public.is_manager());

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
on public.notifications for select
to authenticated
using (recipient_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
on public.notifications for update
to authenticated
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

drop policy if exists notifications_manager_insert on public.notifications;
drop policy if exists notifications_insert_own_or_manager on public.notifications;
create policy notifications_insert_own_or_manager
on public.notifications for insert
to authenticated
with check (recipient_id = auth.uid() or public.is_manager());
