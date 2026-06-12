import { buildAppUrl } from '@/lib/app-url';
import { INVESTOR_SECTORS } from '@/lib/investor-request';
import {
  hasLoopsLpOpportunityStatusChangedEnv,
  sendLpOpportunityStatusChangedEmail,
} from '@/lib/loops/transactional';
import {
  formatOpportunityStatusChange,
  opportunityStatusLabel,
} from '@/lib/opportunity/opportunity-status-labels';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

function deriveFirstName(fullName: string | null, email: string) {
  const trimmed = fullName?.trim();
  if (trimmed) {
    return trimmed.split(/\s+/)[0];
  }

  return email;
}

function normalizeSectors(value: unknown) {
  const sectors = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? [value]
      : [];

  return Array.from(new Set(
    sectors.filter((sector): sector is string =>
      typeof sector === 'string'
      && sector.trim().length > 0
      && (INVESTOR_SECTORS as readonly string[]).includes(sector),
    ),
  ));
}

function findMatchingSectors(lpSectors: string[], opportunitySectors: string[]) {
  const opportunitySectorSet = new Set(opportunitySectors);
  return lpSectors.filter((sector) => opportunitySectorSet.has(sector));
}

export async function notifyLpsOfOpportunityStatusChange(input: {
  opportunityId: string;
  opportunityTitle: string;
  opportunitySlug: string;
  opportunitySectors: string[];
  previousStatus: string;
  newStatus: string;
  savedAt: string;
}): Promise<void> {
  if (
    input.previousStatus === input.newStatus
    || input.newStatus === 'draft'
    || !hasLoopsLpOpportunityStatusChangedEnv()
  ) {
    return;
  }

  const supabase = createSupabaseAdminClient();
  const opportunitySectors = normalizeSectors(input.opportunitySectors);
  const opportunityUrl = buildAppUrl(`/opportunities/${input.opportunitySlug}`);
  const previousStatusLabel = opportunityStatusLabel(input.previousStatus);
  const newStatusLabel = opportunityStatusLabel(input.newStatus);
  const statusChangeSummary = formatOpportunityStatusChange(
    input.previousStatus,
    input.newStatus,
  );

  const recipients = new Map<string, {
    email: string;
    fullName: string | null;
    matchingSectors: string[];
  }>();

  const { data: interestRows, error: interestError } = await supabase
    .from('interests')
    .select(`
      lp_id,
      lps (
        email,
        full_name
      )
    `)
    .eq('opportunity_id', input.opportunityId)
    .neq('status', 'withdrawn');

  if (interestError) {
    console.error('Opportunity status change interest lookup failed:', interestError.message);
  } else {
    for (const row of interestRows ?? []) {
      const lp = row.lps;
      const lpRecord = Array.isArray(lp) ? lp[0] : lp;
      if (!lpRecord?.email) {
        continue;
      }

      recipients.set(lpRecord.email, {
        email: lpRecord.email,
        fullName: lpRecord.full_name,
        matchingSectors: [],
      });
    }
  }

  if (opportunitySectors.length > 0) {
    const { data: lpRows, error: lpError } = await supabase
      .from('lps')
      .select('email, full_name, sectors_interested')
      .eq('status', 'approved');

    if (lpError) {
      console.error('Opportunity status change sector lookup failed:', lpError.message);
    } else {
      for (const lp of lpRows ?? []) {
        if (!lp.email) {
          continue;
        }

        const matchingSectors = findMatchingSectors(
          normalizeSectors(lp.sectors_interested),
          opportunitySectors,
        );

        if (matchingSectors.length === 0) {
          continue;
        }

        const existing = recipients.get(lp.email);
        recipients.set(lp.email, {
          email: lp.email,
          fullName: existing?.fullName ?? lp.full_name,
          matchingSectors,
        });
      }
    }
  }

  if (recipients.size === 0) {
    return;
  }

  await Promise.allSettled(
    [...recipients.values()].map((recipient) =>
      sendLpOpportunityStatusChangedEmail({
        email: recipient.email,
        firstName: deriveFirstName(recipient.fullName, recipient.email),
        investorName: recipient.fullName || recipient.email,
        opportunityTitle: input.opportunityTitle,
        opportunityUrl,
        previousStatus: previousStatusLabel,
        newStatus: newStatusLabel,
        statusChangeSummary,
        matchingSectors: recipient.matchingSectors.join(', '),
        idempotencyKey: `lp-opportunity-status-changed-${input.opportunityId}-${recipient.email}-${input.previousStatus}-${input.newStatus}-${input.savedAt}`,
      }),
    ),
  );
}
