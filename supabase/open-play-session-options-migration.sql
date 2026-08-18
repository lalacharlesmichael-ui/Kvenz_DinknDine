do $$
begin
  create type public.open_play_format as enum (
    'mens_doubles',
    'womens_doubles',
    'mixed_doubles'
  );
exception
  when duplicate_object then null;
end
$$;

alter table public.open_play_sessions
  add column if not exists skill_levels public.skill_level[] not null default array['all_levels'::public.skill_level],
  add column if not exists formats public.open_play_format[] not null default array['mixed_doubles'::public.open_play_format];

update public.open_play_sessions
set skill_levels = array[skill_level]
where cardinality(skill_levels) = 0;
