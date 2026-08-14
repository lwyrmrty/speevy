-- Per-LP switch for opportunity export downloads.
alter table public.lps
  add column if not exists export_enabled boolean not null default false;
