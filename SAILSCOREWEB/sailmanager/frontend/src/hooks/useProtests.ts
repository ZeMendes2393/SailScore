
// src/hooks/useProtests.ts
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiGet } from '@/lib/api';
import type { ProtestsListResponse, ProtestListItem } from '@/lib/api';

export type ProtestScope = 'all' | 'made' | 'against';

type Options = {
  scope?: ProtestScope;
  search?: string;
  limit?: number;
};

// debounce simples
function useDebounced(value: string, ms = 400) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function useProtests(
  regattaId: number | null,
  opts: Options,
  token?: string
) {
  const scope = opts.scope ?? 'all';
  const limit = opts.limit ?? 20;
  const debouncedSearch = useDebounced(opts.search ?? '', 400);

  const [items, setItems] = useState<ProtestListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const nextCursorRef = useRef<number | null>(null);
  const inFlightKeyRef = useRef<string | null>(null);

  // reset sempre que mudam filtros base
  useEffect(() => {
    setItems([]);
    setError(null);
    setHasMore(false);
    nextCursorRef.current = null;
  }, [regattaId, scope, debouncedSearch, limit]);

  const fetchPage = useCallback(
    async (cursor?: number | null) => {
      if (!regattaId || !token) return;
      const search = debouncedSearch.trim();

      const key = `${regattaId}|${scope}|${limit}|${search}|${cursor ?? 0}`;
      if (inFlightKeyRef.current === key) return; // evita duplicados
      inFlightKeyRef.current = key;

      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ scope, limit: String(limit) });
        if (search) qs.set('search', search);
        if (cursor) qs.set('cursor', String(cursor));

        const data = await apiGet<ProtestsListResponse>(
          `/regattas/${regattaId}/protests?${qs.toString()}`,
          token
        );

        setItems(prev => (cursor ? [...prev, ...data.items] : data.items));
        nextCursorRef.current = data.page_info?.next_cursor ?? null;
        setHasMore(Boolean(data.page_info?.has_more));
      } catch (e: any) {
        setError(e?.message ?? 'Falha a carregar protestos.');
      } finally {
        setLoading(false);
        inFlightKeyRef.current = null;
      }
    },
    [regattaId, token, scope, limit, debouncedSearch]
  );

  // 1º load e quando filtros mudam
  useEffect(() => {
    fetchPage(null);
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;
    const cursor = nextCursorRef.current;
    if (!cursor) return;
    fetchPage(cursor);
  }, [loading, hasMore, fetchPage]);

  return { items, loading, error, hasMore, loadMore };
}
