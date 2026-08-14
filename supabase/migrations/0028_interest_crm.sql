-- Admin CRM fields on investor interest, plus threaded internal notes.
-- Pipeline status is separate from LP-facing interest_status (indicated /
-- committed / withdrawn) so LP upserts never overwrite the deal workspace.

alter type public.audit_action add value if not exists 'interest.crm_updated';
alter type public.audit_action add value if not exists 'interest.note_added';

create type public.interest_pipeline_status as enum ('interested', 'contacted', 'confirmed');
create type public.interest_priority as enum ('low', 'medium', 'high');

alter table public.interests
  add column pipeline_status public.interest_pipeline_status not null default 'interested',
  add column priority public.interest_priority,
  add column owner_profile_id uuid references public.profiles(id),
  add column confirmed_amount_cents bigint,
  add column confirmed_by_profile_id uuid references public.profiles(id),
  add column confirmed_at timestamptz;

create index if not exists interests_pipeline_status_idx
  on public.interests (pipeline_status);

create index if not exists interests_owner_profile_idx
  on public.interests (owner_profile_id);

create table if not exists public.interest_notes (
  id uuid primary key default gen_random_uuid(),
  interest_id uuid not null references public.interests(id) on delete cascade,
  author_profile_id uuid not null references public.profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists interest_notes_interest_idx
  on public.interest_notes (interest_id, created_at desc);

alter table public.interest_notes enable row level security;
alter table public.interest_notes force row level security;

drop policy if exists "interest_notes: admin all" on public.interest_notes;
create policy "interest_notes: admin all"
  on public.interest_notes for all
  using (public.is_admin())
  with check (public.is_admin());
