// useRegattaStatus.ts
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getApiBaseUrl } from '@/lib/api';

export type RegattaWindows = {
  entryData: boolean;
  documents: boolean;
  rule42: boolean;
  scoreReview: boolean;
  requests: boolean;
  protest: boolean;
};

export type RegattaStatusResponse = {
  status: 'upcoming' | 'active' | 'finished';
  now_utc: string;
  start_utc?: string | null;
  end_utc?: string | null;
  windows: RegattaWindows;
  regatta?: { id: number; name: string } | null;
};

// Fallback “tudo aberto” para DEV
const DEFAULT_WINDOWS: RegattaWindows = {
  entryData: true,
  documents: true,
  rule42: true,
  scoreReview: true,
  requests: true,
  protest: true,
};

export function useRegattaStatus(explicitRegattaId?: number | null) {
  const { token } = useAuth();

  const regattaId = useMemo(() => {
    const n = Number(explicitRegattaId);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [explicitRegattaId]);

  const [data, setData] = useState<RegattaStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (regattaId == null) {
      setLoading(false);
      setError(null);
      setData(null);
      return () => {
        alive = false;
      };
    }

    setLoading(true);
    setError(null);

    fetch(`${getApiBaseUrl()}/regattas/${regattaId}/status`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = (await r.json()) as RegattaStatusResponse;
        if (alive) setData(json);
      })
      .catch((e) => {
        if (!alive) return;
        setError(String(e));
        // fallback suave para não bloquear a UI
        setData({
          status: 'active',
          now_utc: new Date().toISOString(),
          start_utc: null,
          end_utc: null,
          windows: DEFAULT_WINDOWS,
          regatta: { id: regattaId, name: 'Regatta' },
        });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [regattaId, token]);

  return { data, loading, error, regattaId };
}
