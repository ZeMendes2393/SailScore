'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

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

const API_BASE = 'http://localhost:8000';

// Fallback “tudo aberto” para evitar bloquear UI em DEV
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
  const regattaId = useMemo(() => {
    // regatista: usa regata do token
    if (user?.role === 'regatista' && user?.currentRegattaId) {
      return user.currentRegattaId;
    }
    // admin: aceita um id passado
    if (explicitRegattaId) return explicitRegattaId;
    // fallback DEV
    return Number(process.env.NEXT_PUBLIC_CURRENT_REGATTA_ID || '1');
  }, [user?.role, user?.currentRegattaId, explicitRegattaId]);

  const [data, setData] = useState<RegattaStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    fetch(`${API_BASE}/regattas/${regattaId}/status`, {
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
        setData({
          status: 'active',
          now_utc: new Date().toISOString(),
          start_utc: null,
          end_utc: null,
          windows: DEFAULT_WINDOWS,
          regatta: { id: regattaId, name: 'Regatta' },
        });
      })
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [regattaId, token]);

  return { data, loading, error, regattaId };
}
