'use client';

import { useMemo, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiGet } from '@/lib/api';
import { SailNumberDisplay } from '@/components/ui/SailNumberDisplay';

type RequestRead = {
  id: number;
  request_no: number;
  class_name?: string | null;
  sail_number?: string | null;
  request_text: string;
  admin_response?: string | null;
  status: 'submitted' | 'under_review' | 'closed';
  created_at: string;
  updated_at?: string | null;
};

export default function RequestsSailor() {
  const { user, token } = useAuth();
  const searchParams = useSearchParams();

  const regattaId = useMemo(() => {
    if (user?.role === 'regatista' && user?.current_regatta_id) return user.current_regatta_id;
    const fromQS = Number(searchParams.get('regattaId') || '');
    const fromEnv = Number(process.env.NEXT_PUBLIC_CURRENT_REGATTA_ID || '1');
    return Number.isFinite(fromQS) && fromQS > 0 ? fromQS : fromEnv;
  }, [user?.role, user?.current_regatta_id, searchParams]);

  const [rows, setRows] = useState<RequestRead[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    if (!regattaId || !token) return;
    setLoading(true); setErr(null);
    try {
      // o backend já filtra “só meus” se não és admin
      const data = await apiGet<RequestRead[]>(`/regattas/${regattaId}/requests`, token);
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load requests.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [regattaId, token]);

  if (!regattaId || !token) return <div className="p-4 text-sm text-gray-600">Initializing…</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Requests</h1>

      <div className="bg-white rounded border overflow-x-auto">
        <table className="min-w-full text-sm table-fixed">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 w-16">#</th>
              <th className="p-2 w-32">Sail No.</th>
              <th className="p-2 w-40">Class</th>
              <th className="p-2">Request</th>
              <th className="p-2 w-[28rem]">Admin response</th>
              <th className="p-2 w-32">Status</th>
              <th className="p-2 w-40">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-b align-top">
                <td className="p-2">{r.request_no}</td>
                <td className="p-2"><SailNumberDisplay countryCode={(r as any).boat_country_code} sailNumber={r.sail_number} /></td>
                <td className="p-2">{r.class_name || '—'}</td>
                <td className="p-2 max-w-[28rem]">
                  <div className="whitespace-pre-wrap break-words">{r.request_text}</div>
                </td>
                <td className="p-2 max-w-[28rem]">
                  <div className="whitespace-pre-wrap break-words">{r.admin_response?.trim() || '—'}</div>
                </td>
                <td className="p-2">{r.status}</td>
                <td className="p-2">{new Date(r.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 && (
          <div className="p-6 text-center text-gray-600">No requests yet.</div>
        )}
      </div>

      {loading && <div className="text-gray-600">Loading…</div>}
      {err && <div className="text-red-600">{err}</div>}
    </div>
  );
}
