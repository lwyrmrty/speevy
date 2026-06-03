-- supabase/migrations/0010_opportunity_access_verifications.sql
--
-- Email verification codes for the password-protected opportunity gate.
-- After a visitor passes the opportunity password check we email them a
-- 6-digit code; they must enter it before access is granted. On success a
-- ~30-day signed cookie lets that email skip the code step on return.
--
-- Same isolation model as opportunity_access_passwords: RLS enabled + forced,
-- an admin-only policy, and NO LP/anon policy. LP and anon sessions can never
-- read or write this table; all reads/writes happen via the service-role
-- client inside the public gate Server Actions (which Zod-validate input
-- first). Codes are stored HASHED (HMAC-SHA256), with a short TTL, single use,
-- and an attempt limit enforced in the Server Action. Only the email (the
-- identity we already collect at the gate) is stored here -- the visitor's
-- name is never persisted in this table.

create table if not exists public.opportunity_access_verifications (
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (opportunity_id, email)
);

alter table public.opportunity_access_verifications enable row level security;
alter table public.opportunity_access_verifications force row level security;

-- Admins only. No LP/anon policy by design: LP and anon sessions can never read
-- or write this table. The service-role client bypasses RLS for the gate flow.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'opportunity_access_verifications'
      and policyname = 'opportunity_access_verifications: admin all'
  ) then
    create policy "opportunity_access_verifications: admin all"
      on public.opportunity_access_verifications for all
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;
