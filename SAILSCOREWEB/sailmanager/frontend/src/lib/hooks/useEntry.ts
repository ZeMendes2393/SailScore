'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet, apiPatch } from '@/lib/api';

export type Entry = {
  id: number;
  regatta_id: number;
  class_name: string;
  boat_name?: string | null;
  sail_number?: string | null;
  bow_number?: string | null;
  boat_country?: string | null;
  boat_country_code?: string | null;
  boat_model?: string | null;
  rating?: number | null;
  category?: string | null;
  owner_first_name?: string | null;
  owner_last_name?: string | null;
  owner_email?: string | null;
  helm_position?: string | null;
  crew_members?: Array<{ position?: string; first_name?: string; last_name?: string; email?: string; federation_license?: string; [k: string]: any }> | null;
  first_name?: string | null;
  last_name?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  email?: string | null;
  contact_phone_1?: string | null;
  contact_phone_2?: string | null;
  club?: string | null;
  helm_country?: string | null;
  helm_country_secondary?: string | null;
  territory?: string | null;
  federation_license?: string | null;
  address?: string | null;
  zip_code?: string | null;
  town?: string | null;
  user_id?: number | null;
  paid?: boolean | null;
  confirmed?: boolean | null;

};

type UseEntryArgs = { entryId: number | null; token?: string };

export function useEntry({ entryId, token }: UseEntryArgs) {
  const [entry, setEntry]   = useState<Entry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // evita “double fetch” e reentrâncias
  const inFlightKeyRef = useRef<string | null>(null);
  const abortRef       = useRef<AbortController | null>(null);

  const fetchEntry = useCallback(async () => {
    if (!entryId || !token) return;

    const key = `${entryId}|${token}`;
    if (inFlightKeyRef.current === key) return; // já a carregar esta mesma key
    inFlightKeyRef.current = key;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<Entry>(`/entries/${entryId}`, token);
      setEntry(data || null);
    } catch (e: any) {
      if (e?.name !== 'AbortError') setError(e?.message ?? 'Failed to load entry.');
    } finally {
      setLoading(false);
      inFlightKeyRef.current = null;
    }
  }, [entryId, token]);

  useEffect(() => {
    fetchEntry();
    return () => abortRef.current?.abort();
  }, [fetchEntry]);

  const patch = useCallback(
    async (partial: Partial<Entry>, extra?: { propagate_keys?: boolean }) => {
      if (!entryId || !token) throw new Error('Missing entryId/token');
      setLoading(true);
      setError(null);
      try {
        const payload = { ...partial, ...(extra ?? {}) };
        const updated = await apiPatch<Entry>(`/entries/${entryId}`, payload, token);
        setEntry(updated || null);
        return updated || null;
      } catch (e: any) {
        setError(e?.message ?? 'Failed to save.');
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [entryId, token]
  );

  return { entry, loading, error, setEntry, refresh: fetchEntry, patch };
}
