-- opportunity_update_broadcasts — admin-sent follower update history.

alter type audit_action add value if not exists 'opportunity.update_sent';

create table public.opportunity_update_broadcasts (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  sent_by_profile_id uuid not null references public.profiles (id),
  update_note text not null,
  recipient_count integer not null,
  sent_at timestamptz not null default now()
);

create index opportunity_update_broadcasts_opportunity_idx
  on public.opportunity_update_broadcasts (opportunity_id);

alter table public.opportunity_update_broadcasts enable row level security;
alter table public.opportunity_update_broadcasts force row level security;

create policy "opportunity_update_broadcasts: admin all"
  on public.opportunity_update_broadcasts for all
  using (public.is_admin())
  with check (public.is_admin());
