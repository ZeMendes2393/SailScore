'use client';

import { useMemo, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiGet } from '@/lib/api';
import type { ScoringRead } from '@/lib/api';
import { useRegattaStatus } from '@/hooks/useRegattaStatus';

const DEFAULT_WINDOWS = {
  entryData: true, documents: true, rule42: true, scoreReview: true, requests: true, protest: true,
};

export default function ScoringListPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // regattaId: se for regatista usamos o do token; senão QS -> .env fallback
  const regattaId = useMemo(() => {
    if (user?.role === 'regatista' && user?.current_regatta_id) return user.current_regatta_id;
    const fromQS = Number(searchParams.get('regattaId') || '');
    const fromEnv = Number(process.env.NEXT_PUBLIC_CURRENT_REGATTA_ID || '1');
    return Number.isFinite(fromQS) && fromQS > 0 ? fromQS : fromEnv;
  }, [user?.role, user?.current_regatta_id, searchParams]);

  const { data: regStatus } = useRegattaStatus(regattaId);
  const windows = regStatus?.windows ?? DEFAULT_WINDOWS;

  const [items, setItems] = useState<ScoringRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  async function load() {
    if (!regattaId || !token) return;
    setLoading(true); setErr(null);
    try {
      // O backend devolve só os "meus" automaticamente (lógica do router)
      const data = await apiGet<ScoringRead[]>(
        `/regattas/${regattaId}/scoring?search=${encodeURIComponent(query)}`,
        token
      );
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load scoring enquiries.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [regattaId, token]); // load inicial
  // re-search quando mudar a query (podes trocar por botão "Search" se preferires)
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [query]); // debounce simples

  if (!regattaId || !token) {
    return <div className="max-w-6xl mx-auto p-4 text-sm text-gray-600">Initializing…</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Scoring Enquiries</h1>
        <button
          disabled={!windows.scoreReview}
          onClick={() => router.push(`/dashboard/scoring/new?regattaId=${regattaId}`)}
          className={`px-4 py-2 rounded ${windows.scoreReview ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600 cursor-not-allowed'}`}
          title={windows.scoreReview ? 'Create a scoring enquiry' : 'Score review window is closed'}
        >
          New Scoring Enquiry
        </button>
      </div>

      <div className="flex gap-2">
        <input
          placeholder="Search by sail no., class, race nº…"
          className="w-full border rounded px-3 py-2"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button onClick={load} className="px-4 py-2 rounded border">Search</button>
      </div>

      <div className="bg-white rounded border overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left py-2 px-3">#</th>
              <th className="text-left py-2 px-3">Sail No.</th>
              <th className="text-left py-2 px-3">Class</th>
              <th className="text-left py-2 px-3">Race</th>
              <th className="text-left py-2 px-3">Reason</th>
              <th className="text-left py-2 px-3">Status</th>
              <th className="text-left py-2 px-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-b">
                <td className="py-2 px-3">{it.id}</td>
                <td className="py-2 px-3">{it.sail_number || '—'}</td>
                <td className="py-2 px-3">{it.class_name || '—'}</td>
                <td className="py-2 px-3">{it.race_number || '—'}</td>
                <td className="py-2 px-3">{it.reason || '—'}</td>
                <td className="py-2 px-3">{it.status}</td>
                <td className="py-2 px-3">{new Date(it.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && items.length === 0 && (
          <div className="p-6 text-center text-gray-600">No scoring enquiries yet.</div>
        )}
      </div>

      {loading && <div className="text-gray-600">Loading…</div>}
      {err && <div className="text-red-600">{err}</div>}
    </div>
  );
}
