-- Rename opportunity status "past" to "closed".
-- Drop policies that embed the old enum literal before renaming (Postgres stores
-- the literal in policy definitions; it becomes invalid after rename).

drop policy if exists "interests: lp insert own" on public.interests;
drop policy if exists "interests: lp update own" on public.interests;

do $$
begin
  if exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'opportunity_status'
      and e.enumlabel = 'past'
  ) and not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'opportunity_status'
      and e.enumlabel = 'closed'
  ) then
    alter type public.opportunity_status rename value 'past' to 'closed';
  end if;
end $$;

-- Recreate interest policies (same rules as 0001, with closed instead of past).
create policy "interests: lp insert own"
  on public.interests for insert
  with check (
    lp_id = public.current_lp_id()
    and exists (
      select 1 from public.opportunities o
      where o.id = opportunity_id
        and o.status <> 'closed'
        and o.published_at is not null
        and (
          o.visible_to_all_approved_lps = true
          or exists (
            select 1 from public.opportunity_access oa
            where oa.opportunity_id = o.id
              and oa.lp_id = public.current_lp_id()
              and oa.revoked_at is null
          )
        )
    )
  );

create policy "interests: lp update own"
  on public.interests for update
  using (lp_id = public.current_lp_id())
  with check (
    lp_id = public.current_lp_id()
    and exists (
      select 1 from public.opportunities o
      where o.id = opportunity_id and o.status <> 'closed'
    )
  );
