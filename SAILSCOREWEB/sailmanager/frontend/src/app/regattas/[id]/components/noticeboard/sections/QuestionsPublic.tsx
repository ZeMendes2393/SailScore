'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiGet } from '@/lib/api';
import { SailNumberDisplay } from '@/components/ui/SailNumberDisplay';

type QuestionRead = {
  id: number;
  seq_no: number;
  class_name?: string | null;
  sail_number?: string | null;
  subject: string;
  body: string;
  status: 'open' | 'answered' | 'closed';
  answer_text?: string | null;
  created_at: string;
};

export default function QuestionsPublic({ regattaId }: { regattaId: number }) {
  const [rows, setRows] = useState<QuestionRead[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const listPath = useMemo(() => {
    // show all questions without search
    return `/regattas/${regattaId}/questions`;
  }, [regattaId]);

  useEffect(() => {
    (async () => {
      setLoading(true); setErr(null);
      try {
        const data = await apiGet<QuestionRead[]>(listPath);
        setRows(Array.isArray(data) ? data : []);
      } catch (e: any) {
        setErr(e?.message || 'Failed to load questions.');
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [listPath]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">Questions</h3>
      </div>

      <div className="bg-white rounded border overflow-x-auto">
        <table className="min-w-full text-sm table-fixed">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 w-20">#</th>
              <th className="p-2 w-32">Sail No.</th>
              <th className="p-2 w-40">Class</th>
              <th className="p-2">Subject / Question</th>
              <th className="p-2 w-28">Status</th>
              <th className="p-2 w-[28rem]">Answer</th>
            </tr>
          </thead>
          <tbody>
            {loading && (<tr><td className="p-3" colSpan={6}>Loading…</td></tr>)}
            {!loading && rows.length === 0 && (
              <tr><td className="p-6 text-center text-gray-500" colSpan={6}>No questions yet.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t align-top">
                <td className="p-2">Q#{r.seq_no}</td>
                <td className="p-2"><SailNumberDisplay countryCode={(r as any).boat_country_code} sailNumber={r.sail_number} /></td>
                <td className="p-2">{r.class_name || '—'}</td>
                <td className="p-2 max-w-[28rem]">
                  <div className="font-medium">{r.subject}</div>
                  <div className="whitespace-pre-wrap break-words opacity-80">{r.body}</div>
                </td>
                <td className="p-2 capitalize">{r.status}</td>
                <td className="p-2 max-w-[28rem]">
                  <div className="whitespace-pre-wrap break-words">
                    {r.answer_text?.trim() || '—'}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {err && <div className="text-red-600">{err}</div>}
    </div>
  );
}
