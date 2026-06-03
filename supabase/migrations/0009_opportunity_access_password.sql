-- supabase/migrations/0009_opportunity_access_password.sql
--
-- Switch opportunity gating passwords from a one-way SHA-256 hash to retrievable
-- plaintext, stored in a dedicated, LP-inaccessible table.
--
-- Why a separate table: an approved LP can SELECT the `opportunities` row
-- (title/teaser) per RLS, and Postgres RLS is row-level, not column-level. A
-- plaintext password column on `opportunities` could therefore be read directly
-- via PostgREST by any LP/anon session. Keeping the password in its own table
-- with RLS enabled and NO LP/anon select policy guarantees it is only reachable
-- by the service-role client (admin editor load + public gate verification) and
-- admin-only Server Actions.
--
-- NOTE: existing SHA-256 hashes are one-way and cannot be recovered. They are
-- intentionally NOT migrated. Any currently password-protected opportunity will
-- have no gate password until an admin re-enters one; until then the gate
-- (which compares against a missing row) safely denies all unlock attempts.

create table if not exists public.opportunity_access_passwords (
  opportunity_id uuid primary key references public.opportunities (id) on delete cascade,
  password text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.opportunity_access_passwords enable row level security;
alter table public.opportunity_access_passwords force row level security;

-- Admins only. No LP/anon policy by design: LP and anon sessions can never read
-- or write this table. The service-role client bypasses RLS for the gate check.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'opportunity_access_passwords'
      and policyname = 'opportunity_access_passwords: admin all'
  ) then
    create policy "opportunity_access_passwords: admin all"
      on public.opportunity_access_passwords for all
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- Drop the old hash column and its CHECK constraint. The "password required when
-- protected" invariant is now enforced in the admin save Server Action.
alter table public.opportunities
  drop constraint if exists opportunities_password_hash_required_when_protected;

alter table public.opportunities
  drop column if exists password_hash;
