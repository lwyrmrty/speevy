import type { BadgeColors } from '@/components/base/badges/badge-types';

export const INTEREST_PIPELINE_STATUSES = ['interested', 'contacted', 'confirmed', 'passed'] as const;
export type InterestPipelineStatus = (typeof INTEREST_PIPELINE_STATUSES)[number];

export const INTEREST_PIPELINE_STATUS_OPTIONS = ['interested', 'confirmed', 'passed'] as const;

export const INTEREST_PRIORITIES = ['low', 'medium', 'high'] as const;
export type InterestPriority = (typeof INTEREST_PRIORITIES)[number];

export const PIPELINE_STATUS_LABELS: Record<InterestPipelineStatus, string> = {
  interested: 'Interested',
  contacted: 'Contacted',
  confirmed: 'Confirmed',
  passed: 'Passed',
};

export const PIPELINE_STATUS_PILL: Record<InterestPipelineStatus, string> = {
  interested: '',
  contacted: 'blue',
  confirmed: 'green',
  passed: 'red',
};

export const PRIORITY_LABELS: Record<InterestPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export const PRIORITY_PILL: Record<InterestPriority, string> = {
  low: 'blue',
  medium: 'yellow',
  high: 'red',
};

const AUTHOR_COLORS: BadgeColors[] = [
  'blue',
  'purple',
  'orange',
  'teal',
  'pink',
  'indigo',
  'sky',
  'success',
];

export const AUTHOR_NOTE_STYLES: Record<BadgeColors, { bar: string; chip: string; name: string }> = {
  gray: {
    bar: 'border-l-utility-neutral-500',
    chip: 'bg-utility-neutral-50 text-utility-neutral-700',
    name: 'text-utility-neutral-700',
  },
  brand: {
    bar: 'border-l-utility-brand-500',
    chip: 'bg-utility-brand-50 text-utility-brand-700',
    name: 'text-utility-brand-700',
  },
  error: {
    bar: 'border-l-utility-red-500',
    chip: 'bg-utility-red-50 text-utility-red-700',
    name: 'text-utility-red-700',
  },
  warning: {
    bar: 'border-l-utility-yellow-500',
    chip: 'bg-utility-yellow-50 text-utility-yellow-700',
    name: 'text-utility-yellow-700',
  },
  success: {
    bar: 'border-l-utility-green-500',
    chip: 'bg-utility-green-50 text-utility-green-700',
    name: 'text-utility-green-700',
  },
  slate: {
    bar: 'border-l-utility-slate-500',
    chip: 'bg-utility-slate-50 text-utility-slate-700',
    name: 'text-utility-slate-700',
  },
  sky: {
    bar: 'border-l-utility-sky-500',
    chip: 'bg-utility-sky-50 text-utility-sky-700',
    name: 'text-utility-sky-700',
  },
  blue: {
    bar: 'border-l-utility-blue-500',
    chip: 'bg-utility-blue-50 text-utility-blue-700',
    name: 'text-utility-blue-700',
  },
  indigo: {
    bar: 'border-l-utility-indigo-500',
    chip: 'bg-utility-indigo-50 text-utility-indigo-700',
    name: 'text-utility-indigo-700',
  },
  purple: {
    bar: 'border-l-utility-purple-500',
    chip: 'bg-utility-purple-50 text-utility-purple-700',
    name: 'text-utility-purple-700',
  },
  pink: {
    bar: 'border-l-utility-pink-500',
    chip: 'bg-utility-pink-50 text-utility-pink-700',
    name: 'text-utility-pink-700',
  },
  orange: {
    bar: 'border-l-utility-orange-500',
    chip: 'bg-utility-orange-50 text-utility-orange-700',
    name: 'text-utility-orange-700',
  },
  teal: {
    bar: 'border-l-utility-teal-500',
    chip: 'bg-utility-teal-50 text-utility-teal-700',
    name: 'text-utility-teal-700',
  },
};

export type InterestCrmTeamMember = {
  id: string;
  fullName: string | null;
  email: string;
  photoUrl: string | null;
};

export type InterestCrmNote = {
  id: string;
  body: string;
  createdAt: string;
  authorProfileId: string;
  authorName: string;
};

export type InterestCrmRow = {
  id: string;
  lpId: string;
  investorName: string;
  investorEmail: string;
  entityName: string | null;
  photoUrl: string | null;
  amountCents: number;
  indicatedAt: string;
  confirmedAmountCents: number | null;
  confirmedByName: string | null;
  confirmedAt: string | null;
  pipelineStatus: InterestPipelineStatus;
  priority: InterestPriority | null;
  ownerProfileId: string | null;
  ownerName: string | null;
  notes: InterestCrmNote[];
};

export function isPipelineStatus(value: unknown): value is InterestPipelineStatus {
  return typeof value === 'string' && (INTEREST_PIPELINE_STATUSES as readonly string[]).includes(value);
}

export function isPriority(value: unknown): value is InterestPriority {
  return typeof value === 'string' && (INTEREST_PRIORITIES as readonly string[]).includes(value);
}

export function colorForProfileId(profileId: string): BadgeColors {
  let hash = 0;
  for (let index = 0; index < profileId.length; index += 1) {
    hash = (hash * 31 + profileId.charCodeAt(index)) >>> 0;
  }
  return AUTHOR_COLORS[hash % AUTHOR_COLORS.length] ?? 'blue';
}

export function centsToNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) return 0;
  return typeof value === 'string' ? Number(value) : value;
}

export function formatUsdFromCents(value: number | string | null | undefined) {
  const cents = centsToNumber(value);
  if (!cents) return '—';

  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

export function formatUsdSumFromCents(totalCents: number) {
  return (totalCents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

export function dollarsInputToCents(value: string) {
  const digits = value.replace(/[^\d]/g, '');
  return digits ? Number(digits) * 100 : null;
}

export function formatUsdInput(value: string) {
  const digits = value.replace(/[^\d]/g, '');
  if (!digits) return '';

  return `$${Number(digits).toLocaleString('en-US')}`;
}

export function formatDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatDateTimeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function teamMemberLabel(member: Pick<InterestCrmTeamMember, 'fullName' | 'email'>) {
  return member.fullName || member.email;
}

export function initialsForLabel(label: string) {
  return label
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function firstNameFromLabel(label: string) {
  return label.split(/\s+/)[0] || label;
}

export const CLOSING_EMAIL_TEMPLATE = `Hi #investorfirst,

Thank you for confirming your interest of #confirmamount in #opportunity. We are in the final stages of closing out this opportunity, and from this point forward we will correspond directly off-platform to finalize steps.

Thank you for using our SPV platform, and we hope you continue to provide the best opportunities in the future.

Thanks again,

#senderfirst`;

export const EMAIL_VARIABLES = [
  '#investorfirst',
  '#confirmamount',
  '#opportunity',
  '#senderfirst',
] as const;
