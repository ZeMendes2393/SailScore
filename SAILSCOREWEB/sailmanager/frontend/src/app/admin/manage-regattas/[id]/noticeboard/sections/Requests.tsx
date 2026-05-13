'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPatch, apiDelete } from '@/lib/api';
import { SailNumberDisplay } from '@/components/ui/SailNumberDisplay';
import notify from '@/lib/notify';
import { useConfirm } from '@/components/ConfirmDialog';

type RequestRead = {
  id: number;
  regatta_id: number;
  request_no: number;
  initiator_entry_id: number | null;
  class_name?: string | null;
  sail_number?: string | null;
  sailor_name?: string | null;
  request_text: string;
  status: 'submitted' | 'under_review' | 'closed';
  admin_response?: string | null;
  created_at: string;
  updated_at: string;
};
type Row = RequestRead & { _expanded?: boolean };

export default function Requests({ regattaId }: { regattaId: number }) {
  const confirm = useConfirm();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'under_review' | 'closed'>('all');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [patch, setPatch] = useState<Partial<RequestRead>>({});

  const listPath = useMemo(() => {
    const p = new URLSearchParams();
    if (statusFilter !== 'all') p.set('status_q', statusFilter);
    return `/regattas/${regattaId}/requests${p.toString() ? `?${p.toString()}` : ''}`;
  }, [regattaId, statusFilter]);

  async function fetchRows() {
    setLoading(true); setErr(null);
    try {
      const data = await apiGet<RequestRead[]>(listPath);
      setRows(Array.isArray(data) ? data.map(d => ({ ...d })) : []);
    } catch (e: any) {
      setRows([]); setErr(e?.message || 'Failed to load requests.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { fetchRows(); }, [listPath]);

  async function save(id: number) {
    try {
      await apiPatch(`/regattas/${regattaId}/requests/${id}`, patch);
      setEditingId(null);
      setPatch({});
      notify.success('Request updated.');
      await fetchRows();
    } catch (e: any) {
      notify.error(e?.message || 'Failed to update request.');
    }
  }
  async function remove(id: number) {
    const ok = await confirm({
      title: 'Delete this request?',
      description: 'The request will be permanently removed from the notice board.',
      tone: 'danger',
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    try {
      await apiDelete(`/regattas/${regattaId}/requests/${id}`);
      notify.success('Request deleted.');
      await fetchRows();
    } catch (e: any) {
      notify.error(e?.message || 'Failed to delete request.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">Requests</h3>
        <div className="flex gap-2">
          <select className="border rounded px-2 py-1" value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value as any)}>
            <option value="all">All</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under review</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2">#</th>
              <th className="p-2">Sail No.</th>
              <th className="p-2">Class</th>
              <th className="p-2">Request</th>
              <th className="p-2">Status</th>
              <th className="p-2 w-[28rem]">Response</th>
              <th className="p-2 text-right">Actions</th>
              <th className="p-2 w-24 text-right">More info</th>
            </tr>
          </thead>
          <tbody>
            {loading && (<tr><td className="p-3" colSpan={8}>Loading…</td></tr>)}
            {!loading && rows.length === 0 && (<tr><td className="p-6 text-center text-gray-500" colSpan={8}>No requests.</td></tr>)}

            {rows.map(r => (
              <RequestRow
                key={r.id}
                r={r}
                isEd={editingId === r.id}
                patch={patch}
                onSave={() => save(r.id)}
                onRemove={() => remove(r.id)}
                onStartEdit={() => { setEditingId(r.id); setPatch({}); }}
                onCancelEdit={() => { setEditingId(null); setPatch({}); }}
                onChangePatch={(p) => setPatch(prev => ({ ...prev, ...p }))}
                onToggle={() => setRows(prev => prev.map(x => x.id===r.id ? ({...x, _expanded: !x._expanded}) : x))}
              />
            ))}
          </tbody>
        </table>
      </div>

      {err && <div className="text-red-600">{err}</div>}
    </div>
  );
}

function RequestRow({
  r,
  isEd,
  patch,
  onSave,
  onRemove,
  onStartEdit,
  onCancelEdit,
  onChangePatch,
  onToggle,
}: {
  r: Row;
  isEd: boolean;
  patch: Partial<RequestRead>;
  onSave: () => Promise<void>;
  onRemove: () => Promise<void>;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onChangePatch: (p: Partial<RequestRead>) => void;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="border-t align-top">
        <td className="p-2">{r.request_no}</td>
        <td className="p-2"><SailNumberDisplay countryCode={(r as any).boat_country_code} sailNumber={r.sail_number} /></td>
        <td className="p-2">{r.class_name || '—'}</td>
        <td className="p-2 max-w-[32rem]">
          <div className="whitespace-pre-wrap break-words">{r.request_text}</div>
        </td>
        <td className="p-2">
          {isEd ? (
            <select
              className="border rounded p-1"
              value={(patch.status ?? r.status) as any}
              onChange={(e)=>onChangePatch({ status: e.target.value as any })}
            >
              <option value="submitted">submitted</option>
              <option value="under_review">under_review</option>
              <option value="closed">closed</option>
            </select>
          ) : (
            r.status
          )}
        </td>
        <td className="p-2">
          {isEd ? (
            <textarea
              rows={2}
              className="border rounded p-2 w-full resize-none whitespace-pre-wrap break-words"
              value={patch.admin_response ?? r.admin_response ?? ''}
              onChange={(e)=>onChangePatch({ admin_response: e.target.value })}
              placeholder="Admin response…"
            />
          ) : (
            <div className="whitespace-pre-wrap break-words">
              {r.admin_response?.trim() || <span className="text-gray-400">—</span>}
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
          <td className="p-3" colSpan={8}>
            <div className="grid md:grid-cols-3 gap-3 text-sm">
              <Field label="Sailor" value={r.sailor_name || '—'} />
              <Field label="Created" value={new Date(r.created_at).toLocaleString('en-GB')} />
              <Field label="Updated" value={new Date(r.updated_at).toLocaleString('en-GB')} />
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
      <div className="font-medium">{value}</div>
    </div>
  );
}
