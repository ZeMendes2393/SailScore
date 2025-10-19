'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import RequireAuth from '@/components/RequireAuth';
import { useAuth } from '@/context/AuthContext';
import { useRule42, type Rule42Scope } from '@/lib/hooks/useRule42';
import type { Rule42ListItem } from '@/lib/api';

function Row({ r }: { r: Rule42ListItem }) {
  return (
    <tr className="border-t">
      <td className="p-2 whitespace-nowrap">{r.sail_num}</td>
      <td className="p-2 whitespace-nowrap">{r.penalty_number}</td>
      <td className="p-2 whitespace-nowrap">{r.race}</td>
      <td className="p-2 whitespace-nowrap">{r.group || '—'}</td>
      <td className="p-2 whitespace-nowrap">{r.rule}</td>
      <td className="p-2 whitespace-nowrap">{r.comp_action || '—'}</td>
      <td className="p-2">{r.entry?.boat_name || '—'}</td>
      <td className="p-2 whitespace-nowrap">{r.class_name}</td>
      <td className="p-2 whitespace-nowrap">{new Date(r.date).toLocaleDateString('en-GB')}</td>
    </tr>
  );
}

export default function Page() {
  const searchParams = useSearchParams();
  const { user, token } = useAuth();

  // Regatta ativa: igual ao padrão dos Protests
  const regattaId = useMemo(() => {
    if (user?.role === 'regatista' && user?.current_regatta_id) return user.current_regatta_id;
    const fromQS = Number(searchParams.get('regattaId') || '');
    const fromEnv = Number(process.env.NEXT_PUBLIC_CURRENT_REGATTA_ID || '1');
    return Number.isFinite(fromQS) && fromQS > 0 ? fromQS : fromEnv;
  }, [user?.role, user?.current_regatta_id, searchParams]);

  // Estado local (apenas scope)
  const [scope, setScope] = useState<Rule42Scope>(user?.role === 'admin' ? 'all' : 'mine');

  // Hook com paginação (sem search)
  const { items, loading, error, hasMore, loadMore } = useRule42(
    regattaId || null,
    { scope, limit: 20 },
    token || undefined
  );

  // Proteção enquanto não há regattaId/token
  if (!regattaId || !token) {
    return (
      <RequireAuth roles={['regatista', 'admin']}>
        <div className="p-6 text-sm text-gray-600">Initializing Rule 42…</div>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth roles={['regatista', 'admin']}>
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold">Rule 42</h1>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-2 mb-3">
          {/* Scope selector: only show 'All' to admin */}
          <div className="flex gap-2">
            <button
              className={`px-3 py-1 rounded border ${scope === 'mine' ? 'bg-gray-900 text-white' : 'bg-white'}`}
              onClick={() => setScope('mine')}
              title="Only my records"
            >
              Mine
            </button>
            {user?.role === 'admin' && (
              <button
                className={`px-3 py-1 rounded border ${scope === 'all' ? 'bg-gray-900 text-white' : 'bg-white'}`}
                onClick={() => setScope('all')}
                title="All regatta records"
              >
                All
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto rounded border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-2 text-left">Sail Number</th>
                <th className="p-2 text-left">Penalty #</th>
                <th className="p-2 text-left">Race</th>
                <th className="p-2 text-left">Group</th>
                <th className="p-2 text-left">Rule</th>
                <th className="p-2 text-left">Competitor Action</th>
                <th className="p-2 text-left">Boat</th>
                <th className="p-2 text-left">Class</th>
                <th className="p-2 text-left">Date</th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 && (
                <tr>
                  <td className="p-3" colSpan={9}>Loading…</td>
                </tr>
              )}
              {!loading && items.length === 0 && !error && (
                <tr>
                  <td className="p-6 text-center text-gray-600" colSpan={9}>
                    You don’t have any Rule 42 records in this regatta yet.
                  </td>
                </tr>
              )}
              {items.map((r) => (
                <Row key={r.id} r={r} />
              ))}
            </tbody>
          </table>
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
    </RequireAuth>
  );
}
