-- supabase/migrations/0012_opportunity_insider_visibility.sql
--
-- Insider visibility model change.
--
-- New rule (confirmed with the product owner):
--   - An "insider" is an LP with lps.status = 'approved'. Insiders can SELECT
--     and view EVERY opportunity whose status <> 'draft' (potential/active/past)
--     WITHOUT needing a per-opportunity opportunity_access grant or the
--     visible_to_all_approved_lps flag.
--   - status is now the single source of truth for "not in Draft". published_at
--     no longer gates insider visibility. (In practice published_at is set iff
--     status <> 'draft', so this is behavior-preserving for existing data while
--     making the intent explicit.)
--   - The per-opportunity opportunity_access grant path is preserved as an
--     ADDITIONAL allow path so outsiders / shared-link / password-gate users
--     keep working — and so an explicit grant still works even for a
--     non-approved LP or a draft opportunity.
--   - visible_to_all_approved_lps is now redundant for insiders (every approved
--     LP already sees every non-draft opportunity) and is dropped from the
--     policy. Drafts stay hidden from insiders unless explicitly granted; the
--     grant path (b) still bypasses the draft restriction.
--   - Admins continue to see everything via the unchanged "admin all" policies.
--
-- The opportunity_sections "lp read with nda gate" policy embeds the SAME
-- parent-visibility check (RLS does not transitively cascade across joins), and
-- LP body reads go through the RLS-bound session client. It is recreated here
-- with the identical new visibility branches so insiders can read the body,
-- while the NDA gate is preserved exactly as before.
--
-- Idempotent: drop the policy if it exists, then recreate. Admin policies and
-- all other tables are intentionally left untouched.

-- ============================================================================
-- opportunities: LP can SELECT a row when EITHER
--   (a) they are an approved LP AND the opportunity is not a draft, OR
--   (b) they have a non-revoked opportunity_access grant for it.
-- ============================================================================
drop policy if exists "opportunities: lp read accessible" on public.opportunities;

create policy "opportunities: lp read accessible"
  on public.opportunities for select
  using (
    (
      exists (
        select 1 from public.lps
        where lps.profile_id = auth.uid()
          and lps.status = 'approved'
      )
      and status <> 'draft'
    )
    or exists (
      select 1 from public.opportunity_access oa
      where oa.opportunity_id = opportunities.id
        and oa.lp_id = public.current_lp_id()
        and oa.revoked_at is null
    )
  );

-- ============================================================================
-- opportunity_sections: parent visibility check (mirrors the policy above) plus
-- the unchanged NDA gate. The parent check is duplicated on purpose: RLS does
-- not transitively cascade across joins.
-- ============================================================================
drop policy if exists "opportunity_sections: lp read with nda gate" on public.opportunity_sections;

create policy "opportunity_sections: lp read with nda gate"
  on public.opportunity_sections for select
  using (
    exists (
      select 1
      from public.opportunities o
      where o.id = opportunity_sections.opportunity_id
        and (
          (
            exists (
              select 1 from public.lps
              where lps.profile_id = auth.uid() and lps.status = 'approved'
            )
            and o.status <> 'draft'
          )
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
