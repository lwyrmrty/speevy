alter table public.opportunities
  add column if not exists origination_fee_cents bigint;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'opportunities_origination_fee_cents_nonnegative'
  ) then
    alter table public.opportunities
      add constraint opportunities_origination_fee_cents_nonnegative
      check (
        origination_fee_cents is null
        or origination_fee_cents >= 0
      );
  end if;
end $$;

notify pgrst, 'reload schema';
