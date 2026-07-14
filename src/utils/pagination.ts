// =============================================================================
// Pagination utilities — moved out of `src/lib/helpers.ts` (Enhancement Batch).
// Re-exported from `src/lib/helpers.ts` for backward compatibility.
// =============================================================================

import { DEFAULT_PAGE, DEFAULT_PER_PAGE, MAX_PER_PAGE } from '@/lib/constants';

export interface PaginationParams {
  page?: number;
  perPage?: number;
}

export function parsePagination(searchParams: URLSearchParams): Required<PaginationParams> {
  const page = Math.max(DEFAULT_PAGE, Number(searchParams.get('page') ?? DEFAULT_PAGE) || DEFAULT_PAGE);
  const perPage = Math.min(
    MAX_PER_PAGE,
    Math.max(1, Number(searchParams.get('perPage') ?? DEFAULT_PER_PAGE) || DEFAULT_PER_PAGE)
  );
  return { page, perPage };
}

export function pageRange(page: number, perPage: number): [number, number] {
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  return [from, to];
}

export function totalPages(count: number, perPage: number): number {
  return Math.max(1, Math.ceil(count / perPage));
}
