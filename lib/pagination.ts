export const DEFAULT_PAGE_SIZE = 25;
export const PAGE_SEARCH_PARAM = 'page';

export type PaginatedResult<T> = {
  rows: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export function parsePageParam(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function getPaginationOffset(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}

export function getTotalPages(totalCount: number, pageSize: number): number {
  if (totalCount <= 0) {
    return 1;
  }

  return Math.ceil(totalCount / pageSize);
}

export function clampPage(page: number, totalPages: number): number {
  return Math.min(Math.max(page, 1), totalPages);
}

export function buildPaginatedResult<T>(
  rows: T[],
  totalCount: number,
  page: number,
  pageSize: number,
): PaginatedResult<T> {
  const totalPages = getTotalPages(totalCount, pageSize);
  const clampedPage = clampPage(page, totalPages);

  return {
    rows,
    totalCount,
    page: clampedPage,
    pageSize,
    totalPages,
  };
}

export function paginateArray<T>(
  items: T[],
  page: number,
  pageSize: number = DEFAULT_PAGE_SIZE,
): PaginatedResult<T> {
  const totalCount = items.length;
  const totalPages = getTotalPages(totalCount, pageSize);
  const clampedPage = clampPage(page, totalPages);
  const offset = getPaginationOffset(clampedPage, pageSize);
  const rows = items.slice(offset, offset + pageSize);

  return buildPaginatedResult(rows, totalCount, clampedPage, pageSize);
}

export type PaginationListItem =
  | { type: 'page'; value: number; isCurrent: boolean }
  | { type: 'ellipsis' };

function paginationRange(start: number, end: number) {
  const length = end - start + 1;
  return Array.from({ length }, (_, index) => index + start);
}

export function getPaginationListItems(
  currentPage: number,
  totalPages: number,
  siblingCount = 1,
): PaginationListItem[] {
  if (totalPages <= 0) {
    return [];
  }

  const items: PaginationListItem[] = [];
  const totalPageNumbers = siblingCount * 2 + 5;

  if (totalPageNumbers >= totalPages) {
    for (let page = 1; page <= totalPages; page += 1) {
      items.push({
        type: 'page',
        value: page,
        isCurrent: page === currentPage,
      });
    }

    return items;
  }

  const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
  const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages);
  const showLeftEllipsis = leftSiblingIndex > 2;
  const showRightEllipsis = rightSiblingIndex < totalPages - 1;

  if (!showLeftEllipsis && showRightEllipsis) {
    const leftItemCount = siblingCount * 2 + 3;
    paginationRange(1, leftItemCount).forEach((page) => {
      items.push({
        type: 'page',
        value: page,
        isCurrent: page === currentPage,
      });
    });
    items.push({ type: 'ellipsis' });
    items.push({
      type: 'page',
      value: totalPages,
      isCurrent: totalPages === currentPage,
    });
    return items;
  }

  if (showLeftEllipsis && !showRightEllipsis) {
    const rightItemCount = siblingCount * 2 + 3;
    items.push({
      type: 'page',
      value: 1,
      isCurrent: currentPage === 1,
    });
    items.push({ type: 'ellipsis' });
    paginationRange(totalPages - rightItemCount + 1, totalPages).forEach((page) => {
      items.push({
        type: 'page',
        value: page,
        isCurrent: page === currentPage,
      });
    });
    return items;
  }

  if (showLeftEllipsis && showRightEllipsis) {
    items.push({
      type: 'page',
      value: 1,
      isCurrent: currentPage === 1,
    });
    items.push({ type: 'ellipsis' });
    paginationRange(leftSiblingIndex, rightSiblingIndex).forEach((page) => {
      items.push({
        type: 'page',
        value: page,
        isCurrent: page === currentPage,
      });
    });
    items.push({ type: 'ellipsis' });
    items.push({
      type: 'page',
      value: totalPages,
      isCurrent: totalPages === currentPage,
    });
  }

  return items;
}
