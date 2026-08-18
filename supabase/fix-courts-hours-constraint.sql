-- Migration Script: Fix courts_hours_valid constraint
-- Run this in your Supabase SQL Editor if court creation or updates fail with constraint error.

-- 1. Drop old restrictive constraint
alter table public.courts drop constraint if exists courts_hours_valid;

-- 2. Add flexible non-equal hours constraint
alter table public.courts add constraint courts_hours_valid check (opens_at <> closes_at);
