export const INVESTOR_SECTORS = [
  'AI',
  'Aerospace',
  'Biotech',
  'Chips / Compute',
  'Critical Minerals / Materials',
  'Cybersecurity',
  'Defense',
  'Energy',
  'Manufacturing',
  'Robotics',
  'Software',
] as const;

export type InvestorSector = (typeof INVESTOR_SECTORS)[number];

export const INVESTMENT_RANGE_MIN = 1;
export const INVESTMENT_RANGE_MAX = 10_000_000;
export const INVESTMENT_RANGE_STEP = 50_000;
export const INVESTMENT_RANGE_VALUES = [
  1,
  50_000,
  100_000,
  150_000,
  200_000,
  250_000,
  300_000,
  350_000,
  400_000,
  450_000,
  500_000,
  600_000,
  700_000,
  800_000,
  900_000,
  1_000_000,
  1_500_000,
  2_000_000,
  2_500_000,
  3_000_000,
  3_500_000,
  4_000_000,
  4_500_000,
  5_000_000,
  6_000_000,
  7_000_000,
  8_000_000,
  9_000_000,
  10_000_000,
] as const;

export function formatInvestmentRange(value: number) {
  if (value >= INVESTMENT_RANGE_MAX) {
    return '$10,000,000+';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}
