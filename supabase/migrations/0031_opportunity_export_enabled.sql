-- Master switch for LP-facing opportunity export.
alter table public.opportunities
  add column if not exists export_enabled boolean not null default false;
