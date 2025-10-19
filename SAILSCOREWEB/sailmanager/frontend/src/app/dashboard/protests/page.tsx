'use client';

import { useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useProtests, ProtestScope } from '@/hooks/useProtests';
import { useRegattaStatus } from '@/hooks/useRegattaStatus';
import { useAuth } from '@/context/AuthContext';

// 👉 importa os tipos do sítio onde estão definidos (no teu caso, @/lib/api)
import type { ProtestListItem, ProtestPartySummary } from '@/lib/api';

const DEFAULT_WINDOWS = {
  entryData: true,
  documents: true,
  rule42: true,
  scoreReview: true,
  requests: true,
  protest: true,
};

function Row({ item }: { item: ProtestListItem }) {
  const respondents = item.respondents
    .map((r: ProtestPartySummary) => r.sail_no || r.free_text || '—')
    .join(', ');

  return (
    <tr className="border-b">
      <td className="py-2 px-3">{item.short_code}</td>
      <td className="py-2 px-3 capitalize">{item.type.replaceAll('_', ' ')}</td>
      <td className="py-2 px-3">{item.race_number || '—'}</td>
      <td className="py-2 px-3">{item.race_date || '—'}</td>
      <td className="py-2 px-3">{item.initiator.sail_no || '—'}</td>
      <td className="py-2 px-3">{respondents || '—'}</td>
      <td className="py-2 px-3">{item.status}</td>
    </tr>
  );
}

export default function ProtestsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, token } = useAuth();

  // regatta: sailor usa a do token; admin aceita ?regattaId=; senão fallback .env
  const regattaId = useMemo(() => {
    if (user?.role === 'regatista' && user?.current_regatta_id) return user.current_regatta_id;
    const fromQS = Number(searchParams.get('regattaId') || '');
    const fromEnv = Number(process.env.NEXT_PUBLIC_CURRENT_REGATTA_ID || '1');
    return Number.isFinite(fromQS) && fromQS > 0 ? fromQS : fromEnv;
  }, [user?.role, user?.current_regatta_id, searchParams]);

  const [tab, setTab] = useState<ProtestScope>('all');

  // ✅ sem pesquisa
  const protestParams = useMemo(
    () => ({ scope: tab, limit: 20 }),
    [tab]
  );

  // passa token explicitamente ao hook
  const { items, loading, error, hasMore, loadMore } =
    useProtests(regattaId, protestParams, token || undefined);

  const { data: regStatus } = useRegattaStatus(regattaId);
  const windows = regStatus?.windows ?? DEFAULT_WINDOWS;

  // proteção simples enquanto não há regattaId / token
  if (!regattaId || !token) {
    return (
      <div className="max-w-6xl mx-auto p-4 text-sm text-gray-600">
        Initializing protests…
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Protests</h1>
        <button
          disabled={!windows.protest}
          onClick={() => router.push(`/dashboard/protests/new?regattaId=${regattaId}`)}
          className={`px-4 py-2 rounded ${
            windows.protest
              ? 'bg-blue-600 text-white'
              : 'bg-gray-300 text-gray-600 cursor-not-allowed'
          }`}
          title={
            windows.protest ? 'Create new protest' : 'Outside the filing window for protests'
          }
        >
          New Protest
        </button>
      </div>

      <div className="flex gap-2 mb-3">
        {(['all', 'made', 'against'] as ProtestScope[]).map((s) => (
          <button
            key={s}
            className={`px-3 py-1 rounded border ${
              tab === s ? 'bg-gray-900 text-white' : 'bg-white'
            }`}
            onClick={() => setTab(s)}
          >
            {s === 'all' ? 'All' : s === 'made' ? 'Made by me' : 'Against me'}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto bg-white rounded border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left py-2 px-3">#</th>
              <th className="text-left py-2 px-3">Type</th>
              <th className="text-left py-2 px-3">Race</th>
              <th className="text-left py-2 px-3">Date</th>
              <th className="text-left py-2 px-3">Initiator</th>
              <th className="text-left py-2 px-3">Respondent(s)</th>
              <th className="text-left py-2 px-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <Row key={it.id} item={it} />
            ))}
          </tbody>
        </table>

        {!loading && items.length === 0 && (
          <div className="p-6 text-center text-gray-600">
            There are no protests related to you in this regatta yet.
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 mt-3">
        {hasMore && (
          <button
            onClick={loadMore}
            disabled={loading}
            className="px-4 py-2 rounded border"
          >
            {loading ? 'Loading…' : 'Load more'}
          </button>
        )}
        {error && <div className="text-red-600">{error}</div>}
      </div>
    </div>
  );
}
