'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPatch } from '@/lib/api';

type QuestionRead = {
  id: number;
  regatta_id: number;
  seq_no: number;
  class_name: string | null;
  sail_number: string | null;
  sailor_name: string | null;
  subject: string;
  body: string;
  status: 'open' | 'answered' | 'closed';
  answer_text?: string | null;
  created_at: string;
  updated_at?: string | null;
};
type Row = QuestionRead & { _expanded?: boolean };

export default function Questions({ regattaId }: { regattaId: number }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all'|'open'|'answered'|'closed'>('all');

  const listPath = useMemo(() => {
    const p = new URLSearchParams();
    if (statusFilter !== 'all') p.set('status', statusFilter);
    return `/regattas/${regattaId}/questions${p.toString() ? `?${p.toString()}` : ''}`;
  }, [regattaId, statusFilter]);

  async function fetchRows() {
    setLoading(true); setErr(null);
    try {
      const data = await apiGet<QuestionRead[]>(listPath);
      setRows(Array.isArray(data) ? data.map(d => ({ ...d })) : []);
    } catch (e: any) {
      setRows([]); setErr(e?.message || 'Failed to load questions.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { fetchRows(); }, [listPath]);

  async function save(id: number, patch: Partial<QuestionRead>) {
    await apiPatch(`/regattas/${regattaId}/questions/${id}`, patch);
    await fetchRows();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">Questions</h3>
        <div className="flex gap-2">
          <select className="border rounded px-2 py-1" value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value as any)}>
            <option value="all">All</option>
            <option value="open">Open</option>
            <option value="answered">Answered</option>
            <option value="closed">Closed</option>
          </select>
          <button className="px-3 py-1 border rounded hover:bg-gray-50" onClick={fetchRows}>Refresh</button>
        </div>
      </div>

      <div className="overflow-x-auto rounded border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 w-10"></th>
              <th className="p-2">#</th>
              <th className="p-2">Sail No.</th>
              <th className="p-2">Class</th>
              <th className="p-2">Subject / Question</th>
              <th className="p-2">Status</th>
              <th className="p-2 w-[28rem]">Admin Answer</th>
              <th className="p-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (<tr><td className="p-3" colSpan={8}>Loading…</td></tr>)}
            {!loading && rows.length === 0 && (<tr><td className="p-6 text-center text-gray-500" colSpan={8}>No questions.</td></tr>)}

            {rows.map(r => (
              <QuestionRow
                key={r.id}
                r={r}
                onSave={save}
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

function QuestionRow({
  r,
  onSave,
  onToggle,
}: {
  r: Row;
  onSave: (id: number, patch: Partial<QuestionRead>) => Promise<void>;
  onToggle: () => void;
}) {
  const [status, setStatus] = useState<QuestionRead['status']>(r.status);
  const [resp, setResp] = useState<string>(r.answer_text || '');

  useEffect(() => { setStatus(r.status); setResp(r.answer_text || ''); }, [r.id]);

  return (
    <>
      <tr className="border-t align-top">
        <td className="p-2 align-middle">
          <button className="px-2 py-1 border rounded hover:bg-gray-50" onClick={onToggle} title={r._expanded ? 'Hide details' : 'More info'}>
            {r._expanded ? '−' : '+'}
          </button>
        </td>
        <td className="p-2">Q#{r.seq_no}</td>
        <td className="p-2">{r.sail_number || '—'}</td>
        <td className="p-2">{r.class_name || '—'}</td>
        <td className="p-2 max-w-[32rem]">
          <div className="font-medium">{r.subject}</div>
          <div className="whitespace-pre-wrap break-words">{r.body}</div>
        </td>
        <td className="p-2">
          <select className="border rounded p-1" value={status} onChange={(e)=>setStatus(e.target.value as any)}>
            <option value="open">open</option>
            <option value="answered">answered</option>
            <option value="closed">closed</option>
          </select>
        </td>
        <td className="p-2">
          <textarea
            rows={2}
            className="border rounded p-2 w-full resize-none whitespace-pre-wrap break-words"
            value={resp}
            onChange={(e)=>setResp(e.target.value)}
            placeholder="Admin answer…"
          />
        </td>
        <td className="p-2 text-right">
          <div className="inline-flex gap-3">
            <button className="text-blue-600 hover:underline"
              onClick={()=>onSave(r.id, { status, answer_text: resp })}>
              Save
            </button>
          </div>
        </td>
      </tr>

      {r._expanded && (
        <tr className="bg-gray-50">
          <td className="p-3" colSpan={8}>
            <div className="grid md:grid-cols-3 gap-3 text-sm">
              <Field label="Sailor" value={r.sailor_name || '—'} />
              <Field label="Created" value={new Date(r.created_at).toLocaleString('en-GB')} />
              <Field label="Updated" value={r.updated_at ? new Date(r.updated_at).toLocaleString('en-GB') : '—'} />
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
