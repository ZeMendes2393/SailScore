'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiGet } from '@/lib/api';

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
};

export default function QuestionsPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const regattaId = useMemo(() => {
    if (user?.role === 'regatista' && user?.current_regatta_id) return user.current_regatta_id as number;
    const fromQS = Number(searchParams.get('regattaId') || '');
    if (Number.isFinite(fromQS) && fromQS > 0) return fromQS;
    const fromEnv = Number(process.env.NEXT_PUBLIC_CURRENT_REGATTA_ID || '0');
    if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
    return 7;
  }, [user?.role, user?.current_regatta_id, searchParams]);

  const [rows, setRows] = useState<QuestionRead[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!regattaId) return;
    setLoading(true);
    try {
      // BE agora devolve: público -> só públicas; sailor autenticado (não-admin) -> só as dele; admin -> todas
      const data = await apiGet<QuestionRead[]>(`/regattas/${regattaId}/questions`, token ?? undefined);
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [regattaId, token]);

  if (!regattaId) return <div className="p-4">Initializing…</div>;

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Questions</h1>
        <button
          className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
          onClick={() => router.push(`/dashboard/questions/new?regattaId=${regattaId}`)}
          disabled={!token}
        >
          New Question
        </button>
      </div>

      <div className="bg-white rounded border overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left">#</th>
              <th className="p-2 text-left">Sail No.</th>
              <th className="p-2 text-left">Class</th>
              <th className="p-2 text-left">Subject / Question</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left w-[28rem]">Answer (by Admin)</th>
              <th className="p-2 text-left">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t align-top">
                <td className="p-2">Q#{r.seq_no}</td>
                <td className="p-2">{r.sail_number || '—'}</td>
                <td className="p-2">{r.class_name || '—'}</td>
                <td className="p-2 max-w-[36rem]">
                  <div className="font-medium">{r.subject}</div>
                  <div className="whitespace-pre-wrap break-words opacity-80 line-clamp-3">
                    {r.body}
                  </div>
                </td>
                <td className="p-2 capitalize">{r.status}</td>
                <td className="p-2">
                  {r.answer_text ? (
                    <div className="p-2 rounded bg-green-50 border border-green-200 whitespace-pre-wrap break-words">
                      {r.answer_text}
                    </div>
                  ) : (
                    <span className="text-gray-500">—</span>
                  )}
                </td>
                <td className="p-2">{new Date(r.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {!rows.length && !loading && (
              <tr>
                <td className="p-6 text-center text-gray-500" colSpan={7}>
                  No questions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
