'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';

type Row = {
  id: number;
  sail_num: string;
  penalty_number: string;
  race: string;
  group: string | null;
  rule: string;
  comp_action: string | null;
  description: string | null;
  class_name: string;
  date: string; // ISO
};

export default function Rule42({ regattaId }: { regattaId: number }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const data = await apiGet<Row[]>(`/rule42/${regattaId}`);
        if (!cancelled) setRows(Array.isArray(data) ? data : []);
      } catch (e: any) {
        if (!cancelled) {
          setRows([]);
          setErr(e?.message || 'Failed to load.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [regattaId]);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Rule 42</h3>
      {loading && <div className="text-gray-500">Loading…</div>}
      {err && <div className="text-red-600">{err}</div>}

      <div className="overflow-x-auto rounded border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2">Sail Number</th>
              <th className="p-2">Penalty Number</th>
              <th className="p-2">Race</th>
              <th className="p-2">Group</th>
              <th className="p-2">Rule</th>
              <th className="p-2">Competitor Action</th>
              <th className="p-2">Notes</th>
              <th className="p-2">Class</th>
              <th className="p-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="p-3" colSpan={9}>Loading…</td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td className="p-6 text-center text-gray-500" colSpan={9}>
                  No records.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2">{r.sail_num}</td>
                <td className="p-2">{r.penalty_number}</td>
                <td className="p-2">{r.race}</td>
                <td className="p-2">{r.group || '—'}</td>
                <td className="p-2">{r.rule}</td>
                <td className="p-2">{r.comp_action || '—'}</td>
                <td className="p-2">{r.description || '—'}</td>
                <td className="p-2">{r.class_name}</td>
                <td className="p-2">{new Date(r.date).toLocaleDateString('en-GB')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
