import { INVESTOR_SECTORS } from '@/lib/investor-request';

const EMAIL_CONTEXT_PLACEHOLDER = '—';

function centsToNumber(value: number | string | null) {
  if (value === null) {
    return 0;
  }

  return typeof value === 'string' ? Number(value) : value;
}

export function normalizeOpportunitySectors(value: unknown) {
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

export function formatOpportunitySectorsLabel(value: unknown) {
  const sectors = normalizeOpportunitySectors(value);
  return sectors.length > 0 ? sectors.join(', ') : EMAIL_CONTEXT_PLACEHOLDER;
}

export function formatOpportunityRaiseLabel(value: number | string | null) {
  const amount = centsToNumber(value) / 100;

  if (!amount) {
    return EMAIL_CONTEXT_PLACEHOLDER;
  }

  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    return `$${Number.isInteger(millions) ? millions : millions.toFixed(1)} Million`;
  }

  if (amount >= 1_000) {
    return `$${Math.round(amount / 1_000)}k`;
  }

  return `$${amount.toLocaleString('en-US')}`;
}

export function formatOpportunityStageLabel(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || EMAIL_CONTEXT_PLACEHOLDER;
}

export function formatOpportunityTeaserLabel(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || EMAIL_CONTEXT_PLACEHOLDER;
}

export function formatOpportunityMinimumLabel(value: number | string | null) {
  const amount = centsToNumber(value) / 100;

  if (!amount) {
    return EMAIL_CONTEXT_PLACEHOLDER;
  }

  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    return `$${Number.isInteger(millions) ? millions : millions.toFixed(1)}M min`;
  }

  if (amount >= 1_000) {
    return `$${Math.round(amount / 1_000)}k min`;
  }

  return `$${amount.toLocaleString('en-US')} min`;
}
