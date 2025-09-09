// src/hooks/useProtests.ts
'use client';
import { useEffect, useState, useCallback } from 'react';
import { apiGet } from '@/lib/api';
import { ProtestsListResponse, ProtestListItem } from '@/types/protest';

export type ProtestScope = 'all' | 'made' | 'against';

export function useProtests(
  regattaId: number,
  params: { scope?: ProtestScope; search?: string; limit?: number },
  token?: string      // opcional
) {
  const [items, setItems] = useState<ProtestListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [cursor, setCursor] = useState<number|null>(null);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(async (reset = false) => {
    if (!regattaId) return;
    setLoading(true); setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set('scope', params.scope || 'all');
      if (params.search) qs.set('search', params.search);
      if (params.limit)  qs.set('limit', String(params.limit));
      if (!reset && cursor) qs.set('cursor', String(cursor));

      const data = await apiGet<ProtestsListResponse>(
        `/regattas/${regattaId}/protests?${qs.toString()}`,
        token
      );

      const list = reset ? data.items : [...items, ...data.items];
      setItems(list);
      setHasMore(Boolean(data.page_info?.has_more));
      setCursor(data.page_info?.next_cursor ?? null);
    } catch (e:any) {
      setError(e.message || 'Falha a carregar protestos');
    } finally {
      setLoading(false);
    }
  }, [regattaId, params.scope, params.search, params.limit, cursor, items, token]);

  useEffect(() => { setItems([]); setCursor(null); /* reset ao mudar filtros */}, [regattaId, params.scope, params.search]);
  useEffect(() => { load(true); }, [load]);

  return { items, loading, error, hasMore, loadMore: () => load(false), refresh: () => load(true) };
}
