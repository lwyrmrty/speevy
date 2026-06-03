'use client';

import { useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export type InvestorStatusFilterValue = 'all' | 'insider' | 'outsider';

const filterOptions: { value: InvestorStatusFilterValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'insider', label: 'Insiders' },
  { value: 'outsider', label: 'Outsiders' },
];

export function AdminInvestorsStatusFilter({
  value,
}: {
  value: InvestorStatusFilterValue;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function applyFilter(next: InvestorStatusFilterValue) {
    if (next === value) return;

    const params = new URLSearchParams(searchParams.toString());
    if (next === 'all') {
      params.delete('status');
    } else {
      params.set('status', next);
    }
    // Drop any open investor slideout selection; the targeted row may be
    // filtered out by the new status filter.
    params.delete('investor');

    const query = params.toString();
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  return (
    <div
      className="speevy-investor-filter"
      role="group"
      aria-label="Filter investors by type"
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
