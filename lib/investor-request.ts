export const INVESTOR_SECTORS = [
  'Defense AI',
  'Frontier Energy',
  'Space Infrastructure',
  'Dual-Use Software',
  'Advanced Manufacturing',
  'Cybersecurity',
  'Autonomy & Robotics',
  'Other',
] as const;

export type InvestorSector = (typeof INVESTOR_SECTORS)[number];

export const INVESTMENT_RANGE_MIN = 100_000;
export const INVESTMENT_RANGE_MAX = 10_000_000;
export const INVESTMENT_RANGE_STEP = 50_000;

export function formatInvestmentRange(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}
