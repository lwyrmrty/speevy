-- supabase/migrations/0016_lp_tags.sql
--
-- Customizable, admin-managed tags for investors (LPs).
--
-- This migration:
--   1. Creates public.tags (the freely-creatable label catalog).
--   2. Creates public.lp_tags (the lps <-> tags many-to-many join).
--   3. Enables + forces RLS with the admin-only pattern from 0001_rls_policies.sql.
--
-- Tags are internal admin metadata (like lps.internal_notes): LPs never read
-- them, so there is no LP/anon policy on either table — only is_admin() can
-- read or write. Admin checks are also enforced in the Server Actions
-- (belt and suspenders). Audit actions are added in 0015_tag_audit_actions.sql.

-- ============================================================================
-- tags
-- name is unique case-insensitively via a lower(name) unique index.
-- color is constrained to the Untitled UI Badge palette; defaults to 'gray'.
-- ============================================================================
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default 'gray',
  created_by_profile_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tags_color_check check (
    color in (
      'gray', 'brand', 'error', 'warning', 'success', 'slate',
      'sky', 'blue', 'indigo', 'purple', 'pink', 'orange'
    )
  )
);

create unique index if not exists tags_name_lower_idx
  on public.tags (lower(name));

-- ============================================================================
-- lp_tags — many-to-many join between lps and tags.
-- Composite PK (lp_id, tag_id) guarantees one assignment per pair.
-- ============================================================================
create table if not exists public.lp_tags (
  lp_id uuid not null references public.lps(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  assigned_by_profile_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (lp_id, tag_id)
);

create index if not exists lp_tags_tag_idx on public.lp_tags (tag_id);

-- ============================================================================
-- RLS — admin-only on both tables. No LP/anon policy: tags are internal admin
-- metadata and are never exposed to LPs.
-- ============================================================================
alter table public.tags    enable row level security;
alter table public.lp_tags enable row level security;

alter table public.tags    force row level security;
alter table public.lp_tags force row level security;

drop policy if exists "tags: admin all" on public.tags;
create policy "tags: admin all"
  on public.tags for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "lp_tags: admin all" on public.lp_tags;
create policy "lp_tags: admin all"
  on public.lp_tags for all
  using (public.is_admin())
  with check (public.is_admin());
