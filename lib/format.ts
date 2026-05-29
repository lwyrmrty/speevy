export function formatCents(value: bigint) {
  const dollars = Number(value / 100n);

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
    notation: dollars >= 1_000_000 ? 'compact' : 'standard',
  }).format(dollars);
}

export function statusLabel(status: string) {
  return status.replaceAll('_', ' ');
}
