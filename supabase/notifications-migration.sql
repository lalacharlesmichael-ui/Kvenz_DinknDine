-- ========================================================
-- Notifications Persistence Migration for Supabase SQL Editor
-- ========================================================

-- 1. Create table if not exists
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- 2. Index for recipient lookup and reverse chronological ordering
create index if not exists notifications_recipient_created_idx 
on public.notifications (recipient_id, created_at desc);

-- 3. Enable Row Level Security
alter table public.notifications enable row level security;

-- 4. Row Level Security Policies
-- Ensures each player ONLY sees notifications specifically addressed to them (recipient_id = auth.uid())
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
on public.notifications for select
to authenticated
using (recipient_id = auth.uid());

-- Ensures users can mark their own notifications as read
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
on public.notifications for update
to authenticated
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

-- Allows players to create notifications for themselves and managers to send notifications to any player
drop policy if exists notifications_manager_insert on public.notifications;
drop policy if exists notifications_insert_own_or_manager on public.notifications;
create policy notifications_insert_own_or_manager
on public.notifications for insert
to authenticated
with check (recipient_id = auth.uid() or public.is_manager());
