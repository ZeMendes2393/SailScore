// useRegattaStatus.ts
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { BASE_URL } from '@/lib/api';

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

export function useRegattaStatus(explicitRegattaId?: number) {
  const { user, token } = useAuth();

  // Determina o regattaId (aceita snake_case ou camelCase e normaliza para número)
  const regattaId = useMemo(() => {
    let id: unknown = null;

    // Se for regatista, tenta ir buscar do token (/auth/me)
    if (user?.role === 'regatista') {
      id =
        (user as any)?.current_regatta_id ??
        (user as any)?.currentRegattaId ??
        null;
    }

    // Admin (ou sem valor no token): usa o explícito se vier
    if (!id && explicitRegattaId) id = explicitRegattaId;

    // Fallback DEV por env
    if (!id) id = Number(process.env.NEXT_PUBLIC_CURRENT_REGATTA_ID || '1');

    const n = Number(id);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }, [user?.role, (user as any)?.current_regatta_id, (user as any)?.currentRegattaId, explicitRegattaId]);

  const [data, setData] = useState<RegattaStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    fetch(`${BASE_URL}/regattas/${regattaId}/status`, {
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
