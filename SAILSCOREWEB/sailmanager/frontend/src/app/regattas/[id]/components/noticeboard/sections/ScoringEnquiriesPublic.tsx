'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiGet } from '@/lib/api';
import type { ScoringRead } from '@/lib/api';
import { SailNumberDisplay } from '@/components/ui/SailNumberDisplay';

type Row = ScoringRead & { _expanded?: boolean };

export default function ScoringEnquiriesPublic({ regattaId }: { regattaId: number }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Public list: show ALL items (any status)
  const listPath = useMemo(() => {
    const p = new URLSearchParams();
    p.set('public', '1'); // backend should allow unauthenticated, all statuses
    return `/regattas/${regattaId}/scoring?${p.toString()}`;
  }, [regattaId]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const data = await apiGet<ScoringRead[]>(listPath);
      setRows(Array.isArray(data) ? data.map(d => ({ ...d })) : []);
    } catch (e: any) {
      setRows([]);
      setErr(e?.message || 'Failed to load scoring enquiries.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [listPath]);

  function toggleExpand(id: number) {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, _expanded: !r._expanded } : r)));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">Scoring Enquiries</h3>
        <button className="px-3 py-1 border rounded hover:bg-gray-50" onClick={load}>
          Refresh
        </button>
      </div>

      <div className="overflow-x-auto rounded border bg-white">
        <table className="min-w-full text-sm table-fixed">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 w-16">#</th>
              <th className="p-2 w-32">Sail No.</th>
              <th className="p-2 w-40">Class</th>
              <th className="p-2 w-40">Race</th>
              <th className="p-2">Requested change</th>
              <th className="p-2 w-40">Status</th>
              <th className="p-2 w-[28rem]">Decision / Response</th>
              <th className="p-2 w-24 text-right">More info</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td className="p-3" colSpan={8}>Loading…</td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td className="p-6 text-center text-gray-500" colSpan={8}>No scoring enquiries yet.</td></tr>
            )}

            {rows.map((r) => (
              <FragmentRow key={r.id} r={r} onToggle={() => toggleExpand(r.id)} />
            ))}
          </tbody>
        </table>
      </div>

      {err && <div className="text-red-600">{err}</div>}
    </div>
  );
}

function FragmentRow({
  r,
  onToggle,
}: {
  r: Row;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="border-t align-top">
        <td className="p-2">{r.id}</td>
        <td className="p-2"><SailNumberDisplay countryCode={(r as any).boat_country_code} sailNumber={r.sail_number} /></td>
        <td className="p-2">{r.class_name || '—'}</td>
        <td className="p-2">{r.race_number || '—'}</td>
        <td className="p-2">{r.requested_change || '—'}</td>
        <td className="p-2 capitalize">{(r.status || '').replace('_', ' ')}</td>
        <td className="p-2 align-top w-[28rem]">
          <div className="max-w-[28rem] whitespace-pre-wrap break-words">
            {r.response?.trim() || <span className="text-gray-400">—</span>}
          </div>
        </td>
        <td className="p-2 text-right align-middle">
          <button
            className="px-2 py-1 border rounded hover:bg-gray-50"
            onClick={onToggle}
            title={r._expanded ? 'Hide details' : 'More info'}
            aria-label={r._expanded ? 'Hide details' : 'More info'}
          >
            {r._expanded ? '−' : '+'}
          </button>
        </td>
      </tr>

      {r._expanded && (
        <tr className="bg-gray-50">
          <td colSpan={8} className="p-3">
            <div className="grid md:grid-cols-3 gap-3 text-sm">
              <Field label="Requested score" value={fmtNum(r.requested_score)} />
              <Field label="Boat ahead" value={fmtText(r.boat_ahead)} />
              <Field label="Boat behind" value={fmtText(r.boat_behind)} />
              <Field label="Created at" value={r.created_at ? new Date(r.created_at).toLocaleString() : '—'} />
              <Field label="Updated at" value={r.updated_at ? new Date(r.updated_at).toLocaleString() : '—'} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-medium break-words">{value}</div>
    </div>
  );
}

function fmtNum(n?: number | null) {
  return typeof n === 'number' && Number.isFinite(n) ? String(n) : '—';
}
function fmtText(t?: string | null) {
  return (t || '').trim() || '—';
}
