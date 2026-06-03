-- supabase/migrations/0011_gate_rate_limits.sql
--
-- Abuse throttling for the public, unauthenticated opportunity password gate.
-- The gate Server Actions (requestOpportunityAccess / verifyOpportunityAccess)
-- are reachable by anyone holding a shared link, which opens two abuse vectors:
--   (a) brute-forcing the admin-chosen gate password, and
--   (b) email bombing — once the password is known the visitor-supplied email
--       receives a Harpoon-branded code on every request.
--
-- We throttle both with simple windowed counters. Each abuse dimension maps to
-- a coarse bucket key (e.g. password attempts per IP+slug, code issuances per
-- email and per IP). No PII beyond those coarse identifiers is stored.
--
-- Same isolation model as opportunity_access_passwords / _verifications: RLS
-- enabled + forced, an admin-only policy, and NO LP/anon policy. LP and anon
-- sessions can never read or write this table; all reads/writes happen via the
-- service-role client inside the gate Server Actions. Increments go through the
-- atomic increment_gate_rate_limit() function below so concurrent serverless
-- invocations count safely. `expires_at` defines the rolling window, so stale
-- rows are naturally ignored on the next increment and no cleanup job is needed.

create table if not exists public.gate_rate_limits (
  bucket_key text primary key,
  window_start timestamptz not null default now(),
  count integer not null default 0,
  expires_at timestamptz not null
);

alter table public.gate_rate_limits enable row level security;
alter table public.gate_rate_limits force row level security;

-- Admins only. No LP/anon policy by design: LP and anon sessions can never read
-- or write this table. The service-role client bypasses RLS for the gate flow.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gate_rate_limits'
      and policyname = 'gate_rate_limits: admin all'
  ) then
    create policy "gate_rate_limits: admin all"
      on public.gate_rate_limits for all
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- Atomic windowed increment. On the first hit in a window we insert count = 1;
-- subsequent hits within the same window increment by 1; once the window has
-- elapsed (expires_at <= now()) the row resets to a fresh window. The whole
-- upsert is a single statement, so concurrent serverless invocations increment
-- the same bucket safely. Returns the new count within the current window.
create or replace function public.increment_gate_rate_limit(
  p_bucket_key text,
  p_window_seconds integer
)
returns integer
language plpgsql
volatile
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.gate_rate_limits as g (bucket_key, window_start, count, expires_at)
  values (
    p_bucket_key,
    now(),
    1,
    now() + make_interval(secs => p_window_seconds)
  )
  on conflict (bucket_key) do update set
    count = case when g.expires_at <= now() then 1 else g.count + 1 end,
    window_start = case when g.expires_at <= now() then now() else g.window_start end,
    expires_at = case
      when g.expires_at <= now() then now() + make_interval(secs => p_window_seconds)
      else g.expires_at
    end
  returning g.count into v_count;

  return v_count;
end;
$$;

-- Supabase grants EXECUTE on new public functions to anon/authenticated by
-- default, which would expose this throttle via /rest/v1/rpc. Only the
-- service-role client (inside the gate Server Actions) may call it.
revoke all on function public.increment_gate_rate_limit(text, integer) from public;
grant execute on function public.increment_gate_rate_limit(text, integer) to service_role;
