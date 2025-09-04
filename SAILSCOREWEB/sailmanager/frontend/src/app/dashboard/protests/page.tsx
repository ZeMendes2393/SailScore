'use client';

import { useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useProtests, ProtestScope } from '@/hooks/useProtests';
import { ProtestListItem } from '@/types/protest';
import { useRegattaStatus } from '@/hooks/useRegattaStatus';
import { useAuth } from '@/context/AuthContext';

const DEFAULT_WINDOWS = {
  entryData: true,
  documents: true,
  rule42: true,
  scoreReview: true,
  requests: true,
  protest: true,
};

function Row({ item }: { item: ProtestListItem }) {
  const respondents = item.respondents.map((r) => r.sail_no || r.free_text || '—').join(', ');
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
  const { user } = useAuth();

  // regata efetiva: regatista usa token; admin aceita query (?regattaId=)
  const regattaId = useMemo(() => {
    if (user?.role === 'regatista' && user?.current_regatta_id) return user.current_regatta_id;
    const fromQS = Number(searchParams.get('regattaId') || '');
    const fromEnv = Number(process.env.NEXT_PUBLIC_CURRENT_REGATTA_ID || '1');
    return Number.isFinite(fromQS) && fromQS > 0 ? fromQS : fromEnv;
  }, [user?.role, user?.current_regatta_id, searchParams]);

  const [tab, setTab] = useState<ProtestScope>('all');
  const [query, setQuery] = useState('');

  const { items, loading, error, hasMore, loadMore } = useProtests(regattaId, {
    scope: tab,
    search: query,
  });

  const { data: regStatus } = useRegattaStatus(regattaId);
  const windows = regStatus?.windows ?? DEFAULT_WINDOWS;

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
            windows.protest ? 'Criar novo protesto' : 'Fora da janela para apresentar protestos'
          }
        >
          Novo Protesto
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
            {s === 'all' ? 'Todos' : s === 'made' ? 'Feitos por mim' : 'Contra mim'}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <input
          placeholder="Procurar por sail no., boat, nº de regata…"
          className="w-full border rounded px-3 py-2"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto bg-white rounded border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left py-2 px-3">#</th>
              <th className="text-left py-2 px-3">Tipo</th>
              <th className="text-left py-2 px-3">Race</th>
              <th className="text-left py-2 px-3">Data</th>
              <th className="text-left py-2 px-3">Iniciador</th>
              <th className="text-left py-2 px-3">Respondente(s)</th>
              <th className="text-left py-2 px-3">Estado</th>
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
            Ainda não existem protestos relacionados contigo nesta regata.
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 mt-3">
        <button onClick={loadMore} disabled={!hasMore || loading} className="px-4 py-2 rounded border">
          {loading ? 'A carregar…' : hasMore ? 'Carregar mais' : 'Sem mais resultados'}
        </button>
        {error && <div className="text-red-600">{error}</div>}
      </div>
    </div>
  );
}
