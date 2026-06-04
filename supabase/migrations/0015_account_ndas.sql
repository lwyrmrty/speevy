-- supabase/migrations/0015_account_ndas.sql
--
-- NDA-gate Track 1B PR 1: the account-level NDA backend spine.
--
-- Adds:
--   1. nda_templates.is_account_default — designates THE standard account-level
--      NDA template, with a PARTIAL UNIQUE INDEX so at most one active
--      (archived_at IS NULL) row can be the default.
--   2. account_ndas — one row per LP (unique(lp_id)); the single account-level
--      NDA signed once per investor. Mirrors opportunity_ndas. INFORMATIONAL
--      status only — NOT part of any RLS gate (the only automatic NDA gate
--      remains the per-opportunity NDA on opportunity_sections). A future
--      hard-gate option is preserved in docs/nda-gate-design.md §4B.9.
--   3. nda_webhook_events — idempotency anchor for the SignatureAPI webhook.
--   4. nda-documents — a PRIVATE Supabase Storage bucket for sealed signed PDFs.
--
-- RLS follows the patterns in 0001_rls_policies.sql: admin read via is_admin();
-- LP read own via current_lp_id(); all writes via the service role (the webhook
-- + onboarding server action), so there is intentionally NO insert/update
-- policy on account_ndas / nda_webhook_events.
--
-- See docs/nda-gate-design.md §4B.3 / §5.3 / §6.1.

-- ============================================================================
-- nda_templates.is_account_default + partial unique index
-- ============================================================================
alter table public.nda_templates
  add column if not exists is_account_default boolean not null default false;

-- At most one active (non-archived) template may be the account default.
create unique index if not exists nda_templates_one_account_default
  on public.nda_templates (is_account_default)
  where is_account_default = true and archived_at is null;

-- ============================================================================
-- account_ndas — one account-level NDA per LP
-- ============================================================================
create table if not exists public.account_ndas (
  id uuid primary key default gen_random_uuid(),
  lp_id uuid not null unique references public.lps(id) on delete cascade,
  -- Which standard NDA template was signed (attribution across versions).
  nda_template_id uuid not null references public.nda_templates(id),
  signature_provider text not null default 'signatureapi',
  envelope_id text not null,
  status signature_status not null default 'sent',
  sent_at timestamptz not null default now(),
  signed_at timestamptz,
  declined_at timestamptz,
  expired_at timestamptz,
  signed_document_storage_key text,
  last_webhook_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists account_ndas_envelope_idx
  on public.account_ndas (envelope_id);

alter table public.account_ndas enable row level security;
alter table public.account_ndas force row level security;

-- Admin read all; LP read own. All writes via service role (webhook +
-- onboarding action) — no insert/update policy by design.
drop policy if exists "account_ndas: admin read" on public.account_ndas;
create policy "account_ndas: admin read"
  on public.account_ndas for select
  using (public.is_admin());

drop policy if exists "account_ndas: lp read own" on public.account_ndas;
create policy "account_ndas: lp read own"
  on public.account_ndas for select
  using (lp_id = public.current_lp_id());

-- ============================================================================
-- nda_webhook_events — idempotency anchor for NDA signature webhooks
-- ============================================================================
create table if not exists public.nda_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text,
  event_type text,
  account_nda_id uuid references public.account_ndas(id) on delete set null,
  opportunity_nda_id uuid references public.opportunity_ndas(id) on delete set null,
  status text not null default 'received',
  raw_payload jsonb,
  received_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

alter table public.nda_webhook_events enable row level security;
alter table public.nda_webhook_events force row level security;

-- Admin read only; all writes via service role (the webhook). raw_payload is
-- never surfaced to analytics; scrub PII before any log line.
drop policy if exists "nda_webhook_events: admin read" on public.nda_webhook_events;
create policy "nda_webhook_events: admin read"
  on public.nda_webhook_events for select
  using (public.is_admin());

-- ============================================================================
-- Storage bucket: nda-documents (PRIVATE)
-- Sealed signed NDA PDFs are downloaded by the webhook (service role) and
-- served only via short-lived signed URLs (no public bucket). Service-role
-- access bypasses storage RLS, so no storage.objects policy is required for
-- the webhook upload or the admin signed-URL reads. If buckets cannot be
-- created via SQL in this environment, create a PRIVATE bucket named
-- "nda-documents" manually in the Supabase dashboard.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('nda-documents', 'nda-documents', false)
on conflict (id) do nothing;
