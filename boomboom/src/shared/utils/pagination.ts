import type { CursorPage, CursorPageParam } from '@/shared/types/api';

export const cursorInfiniteQueryOptions = {
  initialPageParam: null as CursorPageParam,
  getNextPageParam: (lastPage: CursorPage<unknown>) =>
    lastPage.nextCursor ?? undefined,
  getPreviousPageParam: () => undefined,
};

export function cursorParams(pageParam: CursorPageParam, limit: number) {
  return pageParam ? { cursor: pageParam, limit } : { limit };
}

export function flatPageItems<T>(
  data?:
    | { pages?: Array<{ items?: T[] | null } | null>; items?: T[] | null }
    | T[]
    | null,
): T[] {
  if (Array.isArray(data)) {
    return data;
  }
  const fromPages = (data?.pages ?? []).flatMap(page => page?.items ?? []);
  if (fromPages.length > 0) {
    return fromPages;
  }
  return data?.items ?? [];
}

/** Message pages are newest-first batches; flatten oldest → newest for the thread. */
export function flatMessagePages<T>(
  data?: { pages?: Array<{ items?: T[] | null } | null> } | null,
): T[] {
  return [...(data?.pages ?? [])]
    .reverse()
    .flatMap(page => page?.items ?? []);
}

type InfiniteQueryLike = {
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage: () => unknown;
};

export function loadMoreIfNeeded(query: InfiniteQueryLike) {
  if (query.hasNextPage && !query.isFetchingNextPage) {
    void query.fetchNextPage();
  }
}
