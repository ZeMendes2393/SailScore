'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';
import { ProtestsListResponse, ProtestListItem } from '@/types/protest';

export type ProtestScope = 'all' | 'made' | 'against';

interface Params {
  scope?: ProtestScope;
  search?: string;
  limit?: number;
}

export function useProtests(regattaId: number, params: Params = {}) {
  const [items, setItems] = useState<ProtestListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null | undefined>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scope = params.scope ?? 'all';
  const limit = params.limit ?? 20;
  const search = params.search ?? '';

  const fetchPage = useCallback(
    async (cursor?: number | null, replace = false) => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        qs.set('scope', scope);
        qs.set('limit', String(limit));
        if (search) qs.set('search', search);
        if (cursor) qs.set('cursor', String(cursor));

        const data = await apiGet<ProtestsListResponse>(
          `/regattas/${regattaId}/protests?${qs.toString()}`
        );

        if (replace) setItems(data.items);
        else setItems((prev) => [...prev, ...data.items]);

        setNextCursor(data.page_info?.next_cursor ?? null);
      } catch (e: any) {
        setError(e?.message ?? 'Erro ao carregar protestos');
      } finally {
        setLoading(false);
      }
    },
    [regattaId, scope, limit, search]
  );

  useEffect(() => {
    fetchPage(undefined, true);
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (nextCursor) fetchPage(nextCursor, false);
  }, [nextCursor, fetchPage]);

  return { items, loading, error, hasMore: !!nextCursor, loadMore };
}
