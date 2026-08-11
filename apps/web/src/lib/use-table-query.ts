'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

/**
 * Table state that lives in the URL (DESIGN.md §9).
 *
 * "Filters, tabs, selections and pagination live in the URL and survive reload
 * and sharing" has been in the design document since its first draft and was
 * never implemented — filter and sort lived in `useState`, so no view a
 * developer built could be sent to a colleague, bookmarked, or survive a
 * refresh. On a tool whose whole audience works by sharing links to things,
 * that is a product defect rather than a nicety.
 *
 * Deliberately built on `useSearchParams` rather than adding a query-state
 * dependency: this is roughly forty lines and a new package would have to earn
 * its bundle cost on a surface that has four parameters.
 *
 * Defaults are never written to the URL. A pristine surface has a clean address
 * bar, and only state the user actually chose appears — so a shared link
 * carries intent rather than noise.
 */

export interface TableQuery<F extends string, S extends string> {
  filter: F;
  query: string;
  sort: S;
  desc: boolean;
  page: number;
  setFilter: (value: F) => void;
  setQuery: (value: string) => void;
  /** Toggles direction when the same key is passed again. */
  toggleSort: (key: S) => void;
  setPage: (page: number) => void;
  reset: () => void;
}

export function useTableQuery<F extends string, S extends string>(defaults: {
  filter: F;
  sort: S;
  desc: boolean;
}): TableQuery<F, S> {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const filter = (params.get('status') as F) ?? defaults.filter;
  const query = params.get('q') ?? '';
  const sort = (params.get('sort') as S) ?? defaults.sort;
  const desc = params.get('dir') ? params.get('dir') === 'desc' : defaults.desc;
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1);

  const commit = React.useCallback(
    (next: Record<string, string | null>) => {
      const search = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(next)) {
        if (value === null || value === '') search.delete(key);
        else search.set(key, value);
      }
      const qs = search.toString();
      // `scroll: false` — changing a filter should not throw the reader back to
      // the top of a list they were part-way down.
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  return {
    filter,
    query,
    sort,
    desc,
    page,
    setFilter: (value) =>
      commit({ status: value === defaults.filter ? null : value, page: null }),
    setQuery: (value) => commit({ q: value || null, page: null }),
    toggleSort: (key) => {
      const nextDesc = key === sort ? !desc : true;
      commit({
        sort: key === defaults.sort && nextDesc === defaults.desc ? null : key,
        dir:
          key === defaults.sort && nextDesc === defaults.desc
            ? null
            : nextDesc
              ? 'desc'
              : 'asc',
        page: null,
      });
    },
    setPage: (next) => commit({ page: next <= 1 ? null : String(next) }),
    reset: () => commit({ status: null, q: null, page: null }),
  };
}
