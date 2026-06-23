-- opportunity_follows — LP opt-in to deal update notifications.
-- Follow is the source of truth for ongoing opportunity notifications.
-- Interest saves auto-follow via service role; LPs can unfollow independently.

alter type audit_action add value if not exists 'opportunity.followed';
alter type audit_action add value if not exists 'opportunity.unfollowed';

create table public.opportunity_follows (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  lp_id uuid not null references public.lps (id) on delete cascade,
  followed_at timestamptz not null default now(),
  unfollowed_at timestamptz,
  unique (opportunity_id, lp_id)
);

create index opportunity_follows_opportunity_idx
  on public.opportunity_follows (opportunity_id);

create index opportunity_follows_lp_idx
  on public.opportunity_follows (lp_id);

alter table public.opportunity_follows enable row level security;
alter table public.opportunity_follows force row level security;

create policy "opportunity_follows: admin all"
  on public.opportunity_follows for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "opportunity_follows: lp read own"
  on public.opportunity_follows for select
  using (lp_id = public.current_lp_id());

create policy "opportunity_follows: lp insert own"
  on public.opportunity_follows for insert
  with check (
    lp_id = public.current_lp_id()
    and exists (
      select 1
      from public.lps
      where lps.id = opportunity_follows.lp_id
        and lps.profile_id = auth.uid()
        and lps.status = 'approved'
    )
    and exists (
      select 1
      from public.opportunities o
      where o.id = opportunity_id
        and o.status <> 'draft'
        and o.archived_at is null
    )
  );

create policy "opportunity_follows: lp update own"
  on public.opportunity_follows for update
  using (lp_id = public.current_lp_id())
  with check (lp_id = public.current_lp_id());
