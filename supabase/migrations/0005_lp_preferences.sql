alter table public.lps
  add column if not exists sectors_interested jsonb not null default '[]'::jsonb,
  add column if not exists investment_range_min_cents bigint,
  add column if not exists investment_range_max_cents bigint;

update public.lps
set sectors_interested = coalesce((internal_notes::jsonb -> 'sectorsInterested'), '[]'::jsonb)
where internal_notes is not null
  and internal_notes ~ '^\s*\{'
  and internal_notes::jsonb ? 'sectorsInterested';
