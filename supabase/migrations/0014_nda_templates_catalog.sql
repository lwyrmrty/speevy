-- supabase/migrations/0014_nda_templates_catalog.sql
--
-- NDA-gate chunk 1: the Speevy-owned NDA catalog.
--
-- SignatureAPI exposes no listable hosted-template resource, so the admin
-- "pick an NDA" dropdown must read from a Speevy-owned catalog table. This
-- migration:
--   1. Creates public.nda_templates (admin-managed; LPs never read it).
--   2. Repoints opportunities.nda_template_id from text -> uuid FK into the
--      catalog. The column is unused/null in practice today, so the conversion
--      is non-destructive (any non-uuid text becomes NULL).
--   3. Flips the opportunity_ndas.signature_provider default from 'dropbox_sign'
--      to 'signatureapi' (the v1 engine). The column stays text/pluggable.
--
-- See docs/nda-gate-design.md §5.2 / §5.3 / §9. RLS follows the admin-only
-- pattern in 0001_rls_policies.sql.

-- ============================================================================
-- nda_templates
-- ============================================================================
create table if not exists public.nda_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  signature_provider text not null default 'signatureapi',
  source_file_url text not null,
  fields_config jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  archived_at timestamptz,
  created_by_profile_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nda_templates_active_idx
  on public.nda_templates (archived_at);

-- Admin-only: full read/write via is_admin(). No LP/anon policy — LPs never read
-- the catalog directly (the opportunity editor is admin-only, and LP-facing NDA
-- flows resolve the source file server-side via the service role in later steps).
alter table public.nda_templates enable row level security;
alter table public.nda_templates force row level security;

drop policy if exists "nda_templates: admin all" on public.nda_templates;
create policy "nda_templates: admin all"
  on public.nda_templates for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================================
-- opportunities.nda_template_id: text -> uuid FK into nda_templates
-- The column is unused/null in practice. Convert any stray non-uuid text to
-- NULL so the type change is safe, then add the FK (ON DELETE SET NULL so
-- archiving/removing a template never orphans an opportunity row).
-- ============================================================================
alter table public.opportunities
  alter column nda_template_id drop default;

alter table public.opportunities
  alter column nda_template_id type uuid
  using (
    case
      when nda_template_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        then nda_template_id::uuid
      else null
    end
  );

alter table public.opportunities
  drop constraint if exists opportunities_nda_template_id_fkey;

alter table public.opportunities
  add constraint opportunities_nda_template_id_fkey
  foreign key (nda_template_id) references public.nda_templates(id)
  on delete set null;

-- ============================================================================
-- opportunity_ndas.signature_provider default -> 'signatureapi'
-- Stays a text column so the provider remains pluggable without a migration.
-- ============================================================================
alter table public.opportunity_ndas
  alter column signature_provider set default 'signatureapi';
