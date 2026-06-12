'use client';

import { useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
  opportunityStatusLabel,
  type OpportunityStatus,
} from '@/lib/opportunity/opportunity-status-labels';

export type OpportunityStatusFilterValue = 'all' | OpportunityStatus;

const filterOptions: { value: OpportunityStatusFilterValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: opportunityStatusLabel('active') },
  { value: 'potential', label: opportunityStatusLabel('potential') },
  { value: 'upcoming', label: opportunityStatusLabel('upcoming') },
  { value: 'draft', label: opportunityStatusLabel('draft') },
  { value: 'closed', label: opportunityStatusLabel('closed') },
];

export function AdminOpportunitiesStatusFilter({
  value,
}: {
  value: OpportunityStatusFilterValue;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function applyFilter(next: OpportunityStatusFilterValue) {
    if (next === value) return;

    const params = new URLSearchParams(searchParams.toString());
    if (next === 'all') {
      params.delete('status');
    } else {
      params.set('status', next);
    }
    params.delete('page');

    const query = params.toString();
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  return (
    <div
      className="speevy-investor-filter"
      role="group"
      aria-label="Filter opportunities by status"
      data-pending={isPending ? 'true' : undefined}
    >
      {filterOptions.map((option) => {
        const isActive = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            className={`speevy-investor-filter-option${isActive ? ' active' : ''}`}
            aria-pressed={isActive}
            onClick={() => applyFilter(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
