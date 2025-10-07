// src/lib/hooks/useRule42.ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet } from '@/lib/api';
import type { Rule42ListItem, Rule42ListResponse } from '@/lib/api';

export type Rule42Scope = 'mine' | 'all';

// debounce simples
function useDebounced(value: string, ms = 400) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export function useRule42(
  regattaId: number | null,
  opts: { scope?: Rule42Scope; search?: string; limit?: number },
  token?: string
) {
  const scope = opts.scope ?? 'mine';
  const limit = opts.limit ?? 20;
  const debouncedSearch = useDebounced(opts.search ?? '', 400);

  const [items, setItems] = useState<Rule42ListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const nextCursorRef = useRef<number | null>(null);
  const inFlightKeyRef = useRef<string | null>(null);

  useEffect(() => {
    setItems([]); setError(null); setHasMore(false); nextCursorRef.current = null;
  }, [regattaId, scope, debouncedSearch, limit]);

  const fetchPage = useCallback(async (cursor?: number | null) => {
    if (!regattaId || !token) return;
    const search = debouncedSearch.trim();
    const key = `${regattaId}|${scope}|${limit}|${search}|${cursor ?? 0}`;
    if (inFlightKeyRef.current === key) return;
    inFlightKeyRef.current = key;

    setLoading(true); setError(null);
    try {
      const qs = new URLSearchParams({ scope, limit: String(limit) });
      if (search) qs.set('search', search);
      if (cursor) qs.set('cursor', String(cursor));

      // tenta o endpoint paginado
      let data: Rule42ListResponse | null = null;
      try {
        data = await apiGet<Rule42ListResponse>(`/rule42/${regattaId}/list?${qs.toString()}`, token);
      } catch {
        // fallback para o endpoint antigo, sem paginação
        if (!cursor) {
          const arr = await apiGet<Rule42ListItem[]>(`/rule42/${regattaId}`, token);
          data = { items: Array.isArray(arr) ? arr : [], page_info: { has_more: false, next_cursor: null } };
        } else {
          data = { items: [], page_info: { has_more: false, next_cursor: null } };
        }
      }

      setItems(prev => (cursor ? [...prev, ...(data?.items ?? [])] : (data?.items ?? [])));
      nextCursorRef.current = data?.page_info?.next_cursor ?? null;
      setHasMore(Boolean(data?.page_info?.has_more));
    } catch (e: any) {
      setError(e?.message ?? 'Falha a carregar Rule 42.');
    } finally {
      setLoading(false);
      inFlightKeyRef.current = null;
    }
  }, [regattaId, token, scope, limit, debouncedSearch]);

  useEffect(() => { fetchPage(null); }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;
    const cursor = nextCursorRef.current;
    if (!cursor) return;
    fetchPage(cursor);
  }, [loading, hasMore, fetchPage]);

  return { items, loading, error, hasMore, loadMore };
}
