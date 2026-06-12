import { buildAppUrl } from '@/lib/app-url';
import { INVESTOR_SECTORS } from '@/lib/investor-request';
import {
  hasLoopsLpMatchingOpportunityEnv,
  sendLpMatchingOpportunityEmail,
} from '@/lib/loops/transactional';
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

export async function notifyMatchingLpsOfNewOpportunity(input: {
  opportunityId: string;
  opportunityTitle: string;
  opportunitySlug: string;
  opportunityTeaser: string | null;
  opportunitySectors: string[];
  publishedAt: string;
}): Promise<void> {
  const opportunitySectors = normalizeSectors(input.opportunitySectors);

  if (opportunitySectors.length === 0 || !hasLoopsLpMatchingOpportunityEnv()) {
    return;
  }

  const supabase = createSupabaseAdminClient();
  const { data: lpRows, error } = await supabase
    .from('lps')
    .select('email, full_name, sectors_interested')
    .eq('status', 'approved');

  if (error) {
    console.error('Matching opportunity notification lookup failed:', error.message);
    return;
  }

  const opportunityUrl = buildAppUrl(`/opportunities/${input.opportunitySlug}`);
  const opportunityTeaser = input.opportunityTeaser?.trim() ?? '';

  const recipients = new Map<string, {
    email: string;
    fullName: string | null;
    matchingSectors: string[];
  }>();

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

    recipients.set(lp.email, {
      email: lp.email,
      fullName: lp.full_name,
      matchingSectors,
    });
  }

  if (recipients.size === 0) {
    return;
  }

  await Promise.allSettled(
    [...recipients.values()].map((recipient) =>
      sendLpMatchingOpportunityEmail({
        email: recipient.email,
        firstName: deriveFirstName(recipient.fullName, recipient.email),
        investorName: recipient.fullName || recipient.email,
        opportunityTitle: input.opportunityTitle,
        opportunityUrl,
        opportunityTeaser,
        matchingSectors: recipient.matchingSectors.join(', '),
        idempotencyKey: `lp-matching-opportunity-${input.opportunityId}-${recipient.email}-${input.publishedAt}`,
      }),
    ),
  );
}
