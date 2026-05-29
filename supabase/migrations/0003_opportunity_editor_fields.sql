do $$
begin
  if exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'opportunity_status'
      and e.enumlabel = 'upcoming'
  ) and not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'opportunity_status'
      and e.enumlabel = 'draft'
  ) then
    alter type public.opportunity_status rename value 'upcoming' to 'draft';
  end if;
end $$;

alter table public.opportunities
  alter column status set default 'draft',
  add column if not exists stage text,
  add column if not exists carry_percentage_basis_points integer,
  add column if not exists management_fee_basis_points integer,
  add column if not exists thumbnail_storage_key text,
  add column if not exists logo_storage_key text,
  add column if not exists watermark_enabled boolean not null default false,
  add column if not exists password_protected boolean not null default false,
  add column if not exists password_hash text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'opportunities_carry_percentage_basis_points_range'
  ) then
    alter table public.opportunities
      add constraint opportunities_carry_percentage_basis_points_range
      check (
        carry_percentage_basis_points is null
        or (carry_percentage_basis_points >= 0 and carry_percentage_basis_points <= 10000)
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'opportunities_management_fee_basis_points_range'
  ) then
    alter table public.opportunities
      add constraint opportunities_management_fee_basis_points_range
      check (
        management_fee_basis_points is null
        or (management_fee_basis_points >= 0 and management_fee_basis_points <= 10000)
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'opportunities_password_hash_required_when_protected'
  ) then
    alter table public.opportunities
      add constraint opportunities_password_hash_required_when_protected
      check (
        password_protected = false
        or password_hash is not null
      );
  end if;
end $$;
