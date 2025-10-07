'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';

// Campos que usas no payload do formulário + alguns úteis
export type MyEntry = {
  id: number;
  regatta_id: number;
  class_name: string;

  // Boat
  boat_name?: string | null;
  sail_number?: string | null;
  boat_country?: string | null;
  category?: string | null;

  // Helm (skipper)
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

  // Address
  territory?: string | null;
  address?: string | null;
  zip_code?: string | null;
  town?: string | null;

  // meta
  user_id?: number | null;
  paid?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export function useMyEntry(regattaId: number | null, token?: string) {
  const [entry, setEntry] = useState<MyEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const fetchEntry = useCallback(async () => {
    if (!regattaId || !token) return;
    setLoading(true); setError(null);
    try {
      // endpoint já existente no teu BE: /entries?mine=1&regatta_id={id}
      const data = await apiGet<MyEntry[]>(
        `/entries?mine=1&regatta_id=${regattaId}`,
        token
      );
      setEntry(Array.isArray(data) && data.length > 0 ? data[0] : null);
    } catch (e: any) {
      setError(e?.message ?? 'Falha a carregar a tua inscrição.');
      setEntry(null);
    } finally {
      setLoading(false);
    }
  }, [regattaId, token]);

  useEffect(() => { fetchEntry(); }, [fetchEntry]);

  return { entry, loading, error, refresh: fetchEntry };
}
