-- Backfill active follows for LPs with non-withdrawn interest.
-- Skips rows that already exist (including explicit unfollows).

insert into public.opportunity_follows (opportunity_id, lp_id, followed_at)
select
  i.opportunity_id,
  i.lp_id,
  i.indicated_at
from public.interests i
left join public.opportunity_follows f
  on f.opportunity_id = i.opportunity_id
 and f.lp_id = i.lp_id
where i.status <> 'withdrawn'
  and f.id is null;
