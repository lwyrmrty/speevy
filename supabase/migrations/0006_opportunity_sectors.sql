alter table public.opportunities
  add column if not exists opportunity_sectors jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
