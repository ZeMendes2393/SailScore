'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';

type Row = {
  id: number;
  regatta_id: number;
  class_name: string;
  fleet: string | null;
  date: string;          // "YYYY-MM-DD"
  time_limit_hm: string; // "HH:MM"
  notes: string | null;
};

export default function ProtestTimeLimitPublic({ regattaId }: { regattaId: number }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchRows() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<Row[]>(`/ptl/${regattaId}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar Protest Time Limit.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regattaId]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Protest Time Limit</h3>
        <button
          type="button"
          onClick={fetchRows}
          className="text-sm px-3 py-1 border rounded hover:bg-gray-50"
        >
          Atualizar
        </button>
      </div>

      <div className="overflow-x-auto rounded border bg-white">
        <table className="min-w-full table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-[28%]" />
            <col className="w-[18%]" />
            <col className="w-[22%]" />
            <col className="w-[20%]" />
            <col className="w-[12%]" />
          </colgroup>

          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2 text-left">Class</th>
              <th className="px-3 py-2 text-left">Fleet</th>
              <th className="px-3 py-2 text-left">Time Limit (HH:MM)</th>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Notes</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td className="px-3 py-2" colSpan={5}>A carregar…</td>
              </tr>
            )}

            {!loading && rows.length === 0 && (
              <tr>
                <td className="px-3 py-2 text-center text-gray-500" colSpan={5}>
                  Sem registos.
                </td>
              </tr>
            )}

            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">{r.class_name}</td>
                <td className="px-3 py-2">{r.fleet || '—'}</td>
                <td className="px-3 py-2 font-mono">{r.time_limit_hm}</td>
                <td className="px-3 py-2">{r.date}</td>
                <td className="px-3 py-2">{r.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <div className="text-red-600">{error}</div>}
    </div>
  );
}
