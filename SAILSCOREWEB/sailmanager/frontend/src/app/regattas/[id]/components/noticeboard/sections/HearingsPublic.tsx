'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiGet } from '@/lib/api';
import type { HearingsList, HearingItem } from '@/types/hearings';

export default function HearingsPublic({ regattaId }: { regattaId: number }) {
  const [rows, setRows] = useState<HearingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'open' | 'closed' | 'all'>('open');
  const [error, setError] = useState<string | null>(null);

  const listPath = useMemo(() => {
    const p = new URLSearchParams();
    if (statusFilter !== 'all') p.set('status_q', statusFilter); // "open" | "closed"
    return `/hearings/${regattaId}${p.toString() ? `?${p.toString()}` : ''}`;
  }, [regattaId, statusFilter]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiGet<HearingsList>(listPath);
        if (!cancelled) setRows(Array.isArray(data?.items) ? data.items : []);
      } catch (e: any) {
        if (!cancelled) {
          setRows([]);
          setError(e?.message || 'Erro a carregar hearings.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [listPath]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Hearings & Decisions</h3>
        <select
          className="border rounded px-2 py-1"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'open' | 'closed' | 'all')}
        >
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="all">All</option>
        </select>
      </div>

      {loading && <div className="text-gray-500">A carregar…</div>}
      {error && <div className="text-red-600">{error}</div>}

      <div className="overflow-x-auto rounded border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2">Case</th>
              <th className="p-2">Race</th>
              <th className="p-2">Initiator</th>
              <th className="p-2">Respondent</th>
              <th className="p-2">Date</th>
              <th className="p-2">Time</th>
              <th className="p-2">Room</th>
              <th className="p-2">Status</th>
              <th className="p-2">Decision</th>
              <th className="p-2">More</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && (
              <tr>
                <td className="p-6 text-center text-gray-500" colSpan={10}>
                  Sem hearings.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2">{r.case_number}</td>
                <td className="p-2">{r.race}</td>
                <td className="p-2">{r.initiator}</td>
                <td className="p-2">{r.respondent}</td>
                <td className="p-2">{r.sch_date || '—'}</td>
                <td className="p-2">{r.sch_time || '—'}</td>
                <td className="p-2">{r.room || '—'}</td>
                <td className="p-2">{r.status}</td>
                <td className="p-2">{r.decision || '—'}</td>
                <td className="p-2">
                  {r.decision_pdf_url ? (
                    <a
                      href={r.decision_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      PDF
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
