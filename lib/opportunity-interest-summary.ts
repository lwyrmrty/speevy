import type { createSupabaseAdminClient } from '@/lib/supabase/admin';

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

export function centsToNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  return typeof value === 'string' ? Number(value) : value;
}

export function formatCompactUsdFromCents(cents: number) {
  const amount = cents / 100;

  if (!amount) {
    return '$0';
  }

  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    const label = Number.isInteger(millions) ? String(millions) : millions.toFixed(1).replace(/\.0$/, '');
    return `$${label}M`;
  }

  if (amount >= 1_000) {
    return `$${Math.round(amount / 1_000)}K`;
  }

  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

export function formatWholeUsdFromCents(cents: number) {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

export function buildOpportunityFillSummary(
  totalInterestCents: number,
  targetAllocationCents: number | null,
) {
  const totalLabel = formatCompactUsdFromCents(totalInterestCents);

  if (!targetAllocationCents || targetAllocationCents <= 0) {
    return `${totalLabel} total interest indicated`;
  }

  const targetLabel = formatCompactUsdFromCents(targetAllocationCents);
  return `${totalLabel} of the available ${targetLabel} is now filled`;
}

export async function getOpportunityInterestTotals(
  supabase: SupabaseAdminClient,
  opportunityId: string,
) {
  const { data: interests } = await supabase
    .from('interests')
    .select('amount_cents')
    .eq('opportunity_id', opportunityId)
    .neq('status', 'withdrawn');

  const investorCount = interests?.length ?? 0;
  const totalInterestCents = (interests ?? []).reduce(
    (sum, interest) => sum + centsToNumber(interest.amount_cents),
    0,
  );

  return {
    investorCount,
    totalInterestCents,
  };
}
