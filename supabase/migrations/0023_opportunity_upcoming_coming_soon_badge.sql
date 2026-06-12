-- Rename "Coming Soon" status to "Upcoming" and add optional badge flag for LP cards.
do $$
begin
  if exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'opportunity_status'
      and e.enumlabel = 'coming_soon'
  ) and not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'opportunity_status'
      and e.enumlabel = 'upcoming'
  ) then
    alter type public.opportunity_status rename value 'coming_soon' to 'upcoming';
  end if;
end $$;

alter table public.opportunities
  add column if not exists coming_soon boolean not null default false;

-- Badge only applies to upcoming opportunities.
update public.opportunities
set coming_soon = false
where status <> 'upcoming';
