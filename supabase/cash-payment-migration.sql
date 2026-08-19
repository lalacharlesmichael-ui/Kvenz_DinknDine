-- Run this in the Supabase SQL Editor for existing projects.
-- New projects are already covered by supabase/schema.sql.

do $$
begin
  alter type public.payment_method add value if not exists 'cash';
exception
  when duplicate_object then null;
end
$$;
