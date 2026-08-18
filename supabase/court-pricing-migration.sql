-- ========================================================
-- Migration: Flexible Time-of-Day Court Pricing (Day vs Night Rates)
-- Run this in your Supabase SQL Editor
-- ========================================================

-- 1. Add night_price_per_hour and night_starts_at columns to public.courts
alter table public.courts
  add column if not exists night_price_per_hour numeric(10, 2) check (night_price_per_hour is null or night_price_per_hour >= 0),
  add column if not exists night_starts_at time not null default '17:00';

-- 2. Optional: Set example night rates for existing courts (e.g. 5:00 PM - 12:00 AM)
update public.courts
set night_price_per_hour = price_per_hour + 80,
    night_starts_at = '17:00'
where night_price_per_hour is null;
