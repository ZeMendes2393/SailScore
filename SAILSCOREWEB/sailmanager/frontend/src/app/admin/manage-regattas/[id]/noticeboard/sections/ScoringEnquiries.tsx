'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPatch, apiDelete } from '@/lib/api';
import { SailNumberDisplay } from '@/components/ui/SailNumberDisplay';
import type { ScoringRead } from '@/lib/api';

type Row = ScoringRead & { _expanded?: boolean };

export default function ScoringEnquiries({ regattaId }: { regattaId: number }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setErr] = useState<string | null>(null);

  // simple filter
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all');

  // inline edit
  const [editingId, setEditingId] = useState<number | null>(null);
  const [patch, setPatch] = useState<Partial<ScoringRead>>({});

  const listPath = useMemo(() => {
    const p = new URLSearchParams();
    if (statusFilter !== 'all') p.set('status_q', statusFilter);
    return `/regattas/${regattaId}/scoring${p.toString() ? `?${p.toString()}` : ''}`;
  }, [regattaId, statusFilter]);

  async function fetchRows() {
    setLoading(true); setErr(null);
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

  useEffect(() => { fetchRows(); }, [listPath]);

  function toggleExpand(id: number) {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, _expanded: !r._expanded } : r)));
  }

  async function saveEdit(id: number) {
    try {
      await apiPatch(`/regattas/${regattaId}/scoring/${id}`, patch);
      setEditingId(null);
      setPatch({});
      fetchRows();
    } catch (e: any) {
      alert(e?.message || 'Failed to save.');
    }
  }

  async function remove(id: number) {
    if (!confirm('Delete this scoring enquiry?')) return;
    try {
      await apiDelete(`/regattas/${regattaId}/scoring/${id}`);
      fetchRows();
    } catch (e: any) {
      alert(e?.message || 'Failed to delete.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Scoring Enquiries</h2>
        <div className="flex flex-wrap gap-2">
          <select
            className="border rounded px-2 py-1"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            title="Filter by status"
          >
            <option value="all">All</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
          <button className="px-3 py-1 border rounded hover:bg-gray-50" onClick={fetchRows}>
            Refresh
          </button>
        </div>
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
              <th className="p-2 w-[28rem]">Response</th>
              <th className="p-2 w-36 text-right">Actions</th>
              <th className="p-2 w-24 text-right">More info</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td className="p-3" colSpan={9}>Loading…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td className="p-6 text-center text-gray-500" colSpan={9}>No scoring enquiries.</td></tr>
            )}

            {rows.map((r) => {
              const isEd = editingId === r.id;
              return (
                <FragmentRow
                  key={r.id}
                  r={r}
                  isEd={isEd}
                  patch={patch}
                  onToggle={() => toggleExpand(r.id)}
                  onStartEdit={() => { setEditingId(r.id); setPatch({}); }}
                  onCancelEdit={() => { setEditingId(null); setPatch({}); }}
                  onSave={() => saveEdit(r.id)}
                  onRemove={() => remove(r.id)}
                  onChangePatch={(p) => setPatch(prev => ({ ...prev, ...p }))}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {error && <div className="text-red-600">{error}</div>}
    </div>
  );
}

function FragmentRow({
  r,
  isEd,
  patch,
  onToggle,
  onStartEdit,
  onCancelEdit,
  onSave,
  onRemove,
  onChangePatch,
}: {
  r: Row;
  isEd: boolean;
  patch: Partial<ScoringRead>;
  onToggle: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onRemove: () => void;
  onChangePatch: (p: Partial<ScoringRead>) => void;
}) {
  return (
    <>
      {/* main row */}
      <tr className="border-t align-top">
        <td className="p-2">{r.id}</td>
        <td className="p-2"><SailNumberDisplay countryCode={(r as any).boat_country_code} sailNumber={r.sail_number} /></td>
        <td className="p-2">{r.class_name || '—'}</td>
        <td className="p-2">{r.race_number || '—'}</td>
        <td className="p-2">{r.requested_change || '—'}</td>
        <td className="p-2">
          {isEd ? (
            <select
              className="border rounded p-1 w-full"
              value={(patch.status ?? r.status) as any}
              onChange={(e) => onChangePatch({ status: e.target.value as any })}
            >
              <option value="submitted">submitted</option>
              <option value="under_review">under_review</option>
              <option value="closed">closed</option>
            </select>
          ) : (
            r.status
          )}
        </td>

        {/* Response (inline editable) */}
        <td className="p-2 align-top w-[28rem]">
          {isEd ? (
            <textarea
              rows={3}
              className="border rounded p-2 w-full whitespace-pre-wrap"
              value={patch.response ?? r.response ?? ''}
              onChange={(e) => onChangePatch({ response: e.target.value })}
              placeholder="Write your response to the sailor…"
            />
          ) : (
            <div className="max-w-[28rem] whitespace-pre-wrap break-words">
              {r.response?.trim() || <span className="text-gray-400">—</span>}
            </div>
          )}
        </td>

        <td className="p-2 text-right">
          {!isEd ? (
            <div className="inline-flex gap-3">
              <button className="text-blue-600 hover:underline" onClick={onStartEdit}>Edit</button>
              <button className="text-red-600 hover:underline" onClick={onRemove}>Delete</button>
            </div>
          ) : (
            <div className="inline-flex gap-3">
              <button className="text-blue-600 hover:underline" onClick={onSave}>Save</button>
              <button className="text-gray-600 hover:underline" onClick={onCancelEdit}>Cancel</button>
            </div>
          )}
        </td>

        {/* +/- button */}
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

      {/* details row */}
      {r._expanded && (
        <tr className="bg-gray-50">
          <td colSpan={9} className="p-3">
            <div className="grid md:grid-cols-3 gap-3 text-sm">
              <Field label="Requested score" value={fmtNum(r.requested_score)} />
              <Field label="Boat ahead" value={fmtText(r.boat_ahead)} />
              <Field label="Boat behind" value={fmtText(r.boat_behind)} />
              <Field label="Created at" value={r.created_at ? new Date(r.created_at).toLocaleString('en-GB') : '—'} />
              <Field label="Updated at" value={r.updated_at ? new Date(r.updated_at).toLocaleString('en-GB') : '—'} />
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
