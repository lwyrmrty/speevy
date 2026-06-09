'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

import { getPaginationListItems, PAGE_SEARCH_PARAM } from '@/lib/pagination';

export function AdminListPagination({
  page,
  totalPages,
  paramName = PAGE_SEARCH_PARAM,
}: {
  page: number;
  totalPages: number;
  paramName?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  if (totalPages <= 1) {
    return null;
  }

  const pageItems = getPaginationListItems(page, totalPages);

  function goToPage(nextPage: number) {
    if (nextPage === page || nextPage < 1 || nextPage > totalPages) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    if (nextPage === 1) {
      params.delete(paramName);
    } else {
      params.set(paramName, String(nextPage));
    }

    const query = params.toString();
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  return (
    <div
      className="speevy-list-pagination"
      data-pending={isPending ? 'true' : undefined}
    >
      <div
        className="speevy-list-pagination-controls"
        role="navigation"
        aria-label="Pagination Navigation"
      >
        <div className="speevy-list-pagination-side">
          <button
            type="button"
            className="button short secondary speevy-pagination-nav"
            disabled={page <= 1 || isPending}
            onClick={() => goToPage(page - 1)}
          >
            Previous
          </button>
        </div>

        <div className="speevy-list-pagination-pages">
          {pageItems.map((item, index) =>
            item.type === 'ellipsis' ? (
              <span
                key={`ellipsis-${index}`}
                className="speevy-pagination-ellipsis"
                aria-hidden="true"
              >
                …
              </span>
            ) : (
              <button
                key={item.value}
                type="button"
                className={`speevy-pagination-page${item.isCurrent ? ' current' : ''}`}
                aria-current={item.isCurrent ? 'page' : undefined}
                disabled={isPending}
                onClick={() => goToPage(item.value)}
              >
                {item.value}
              </button>
            ),
          )}
        </div>

        <div className="speevy-list-pagination-mobile">
          Page <span className="speevy-pagination-mobile-current">{page}</span> of{' '}
          <span className="speevy-pagination-mobile-total">{totalPages}</span>
        </div>

        <div className="speevy-list-pagination-side speevy-list-pagination-side-end">
          <button
            type="button"
            className="button short secondary speevy-pagination-nav"
            disabled={page >= totalPages || isPending}
            onClick={() => goToPage(page + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
