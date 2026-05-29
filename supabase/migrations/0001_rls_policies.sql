-- supabase/migrations/0001_rls_policies.sql
--
-- Row Level Security policies for Speevy.
-- Apply AFTER the Drizzle migration that creates the tables.
--
-- Mental model:
--   - Two roles at the app level: 'admin' and 'lp', stored in profiles.role.
--   - auth.uid() returns the current authenticated user's id.
--   - Helper functions read profiles.role for the current user.
--   - LPs see only their own data + opportunities they have access to.
--   - Admins see everything.
--   - Anonymous users see nothing.

-- ============================================================================
-- Helper functions
-- SECURITY DEFINER so they can read profiles regardless of RLS.
-- ============================================================================

create or replace function public.current_profile_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
$$;

create or replace function public.current_lp_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.lps where profile_id = auth.uid()
$$;

revoke all on function public.current_profile_role() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.current_lp_id() from public;
grant execute on function public.current_profile_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.current_lp_id() to authenticated;

-- ============================================================================
-- Enable + force RLS on every table.
-- ============================================================================
alter table public.profiles               enable row level security;
alter table public.lps                    enable row level security;
alter table public.lp_documents           enable row level security;
alter table public.opportunities          enable row level security;
alter table public.opportunity_sections   enable row level security;
alter table public.opportunity_access     enable row level security;
alter table public.opportunity_ndas       enable row level security;
alter table public.interests              enable row level security;
alter table public.audit_log              enable row level security;

alter table public.profiles               force row level security;
alter table public.lps                    force row level security;
alter table public.lp_documents           force row level security;
alter table public.opportunities          force row level security;
alter table public.opportunity_sections   force row level security;
alter table public.opportunity_access     force row level security;
alter table public.opportunity_ndas       force row level security;
alter table public.interests              force row level security;
alter table public.audit_log              force row level security;

-- ============================================================================
-- profiles
-- ============================================================================
create policy "profiles: self read"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles: admin read all"
  on public.profiles for select
  using (public.is_admin());

create policy "profiles: self update non-role"
  on public.profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from public.profiles where id = auth.uid())
  );

create policy "profiles: admin update"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- No insert policy: profiles are created by an auth.users trigger (below).
-- No delete policy: cascade from auth.users only.

-- ============================================================================
-- lps
-- ============================================================================
create policy "lps: self read"
  on public.lps for select
  using (profile_id = auth.uid());

create policy "lps: admin all"
  on public.lps for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "lps: self update"
  on public.lps for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
-- App layer enforces which columns an LP may write to.

-- ============================================================================
-- lp_documents
-- ============================================================================
create policy "lp_documents: self read"
  on public.lp_documents for select
  using (lp_id = public.current_lp_id());

create policy "lp_documents: admin all"
  on public.lp_documents for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================================
-- opportunities
-- LP can SELECT an opportunity row if:
--   1. They are an approved LP, AND
--   2. The opportunity is published, AND
--   3. EITHER visible_to_all_approved_lps
--      OR there is a non-revoked opportunity_access row for them.
--
-- This gates the opportunity row (title, teaser, status).
-- The NDA gate is enforced on opportunity_sections.
-- ============================================================================
create policy "opportunities: admin all"
  on public.opportunities for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "opportunities: lp read accessible"
  on public.opportunities for select
  using (
    exists (
      select 1 from public.lps
      where lps.profile_id = auth.uid()
        and lps.status = 'approved'
    )
    and published_at is not null
    and (
      visible_to_all_approved_lps = true
      or exists (
        select 1 from public.opportunity_access oa
        where oa.opportunity_id = opportunities.id
          and oa.lp_id = public.current_lp_id()
          and oa.revoked_at is null
      )
    )
  );

-- ============================================================================
-- opportunity_sections
-- Parent visibility check + NDA gate.
-- The parent check is duplicated here on purpose: RLS does not transitively
-- cascade across joins.
-- ============================================================================
create policy "opportunity_sections: admin all"
  on public.opportunity_sections for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "opportunity_sections: lp read with nda gate"
  on public.opportunity_sections for select
  using (
    exists (
      select 1
      from public.opportunities o
      where o.id = opportunity_sections.opportunity_id
        and o.published_at is not null
        and exists (
          select 1 from public.lps
          where lps.profile_id = auth.uid() and lps.status = 'approved'
        )
        and (
          o.visible_to_all_approved_lps = true
          or exists (
            select 1 from public.opportunity_access oa
            where oa.opportunity_id = o.id
              and oa.lp_id = public.current_lp_id()
              and oa.revoked_at is null
          )
        )
        and (
          o.nda_required = false
          or exists (
            select 1 from public.opportunity_ndas n
            where n.opportunity_id = o.id
              and n.lp_id = public.current_lp_id()
              and n.status = 'signed'
          )
        )
    )
  );

-- ============================================================================
-- opportunity_access
-- ============================================================================
create policy "opportunity_access: admin all"
  on public.opportunity_access for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "opportunity_access: lp read own"
  on public.opportunity_access for select
  using (lp_id = public.current_lp_id());

-- ============================================================================
-- opportunity_ndas
-- All writes via service role after Dropbox Sign webhook validation.
-- ============================================================================
create policy "opportunity_ndas: admin read"
  on public.opportunity_ndas for select
  using (public.is_admin());

create policy "opportunity_ndas: lp read own"
  on public.opportunity_ndas for select
  using (lp_id = public.current_lp_id());

-- ============================================================================
-- interests
-- LPs can read/insert/update their own; only for non-past, visible opportunities.
-- ============================================================================
create policy "interests: admin all"
  on public.interests for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "interests: lp read own"
  on public.interests for select
  using (lp_id = public.current_lp_id());

create policy "interests: lp insert own"
  on public.interests for insert
  with check (
    lp_id = public.current_lp_id()
    and exists (
      select 1 from public.opportunities o
      where o.id = opportunity_id
        and o.status <> 'past'
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
      where o.id = opportunity_id and o.status <> 'past'
    )
  );

-- No delete: withdrawal is a status change to 'withdrawn'.

-- ============================================================================
-- audit_log
-- Admin read only. All writes via service role. No update/delete ever.
-- ============================================================================
create policy "audit_log: admin read"
  on public.audit_log for select
  using (public.is_admin());

-- ============================================================================
-- Trigger: auto-create a profile row when an auth.users row is inserted.
-- Role defaults to 'lp'. Admin promotion via explicit migration only.
-- ============================================================================
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'lp');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
