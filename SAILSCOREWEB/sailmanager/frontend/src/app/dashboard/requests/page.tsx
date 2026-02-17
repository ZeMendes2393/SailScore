'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiGet } from '@/lib/api';
import type { RequestRead } from '@/lib/api';
import { SailNumberDisplay } from '@/components/ui/SailNumberDisplay';

export default function RequestsPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const regattaId = useMemo(() => {
    if (user?.role === 'regatista' && user?.current_regatta_id) return user.current_regatta_id;
    const fromQS = Number(searchParams.get('regattaId') || '');
    const fromEnv = Number(process.env.NEXT_PUBLIC_CURRENT_REGATTA_ID || '1');
    return Number.isFinite(fromQS) && fromQS > 0 ? fromQS : fromEnv;
  }, [user?.role, user?.current_regatta_id, searchParams]);

  const [rows, setRows] = useState<RequestRead[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!regattaId || !token) return;
    setLoading(true);
    try {
      const data = await apiGet<RequestRead[]>(`/regattas/${regattaId}/requests`, token);
      setRows(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [regattaId, token]); // init

  if (!regattaId || !token) return <div className="p-4">Initializing…</div>;

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Requests</h1>
        <button
          className="px-4 py-2 rounded bg-blue-600 text-white"
          onClick={() => router.push(`/dashboard/requests/new?regattaId=${regattaId}`)}
        >
          New Request
        </button>
      </div>

      {/* (search removed) */}

      <div className="bg-white rounded border overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2">#</th>
              <th className="p-2">Sail No.</th>
              <th className="p-2">Class</th>
              <th className="p-2">Request</th>
              <th className="p-2">Status</th>
              <th className="p-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t">
                <td className="p-2">{r.request_no}</td>
                <td className="p-2"><SailNumberDisplay countryCode={(r as any).boat_country_code} sailNumber={r.sail_number} /></td>
                <td className="p-2">{r.class_name || '—'}</td>
                <td className="p-2 max-w-[32rem]">
                  <div className="whitespace-pre-wrap break-words">{r.request_text}</div>
                </td>
                <td className="p-2">{r.status}</td>
                <td className="p-2">{new Date(r.created_at).toLocaleString('en-GB')}</td>
              </tr>
            ))}
            {!rows.length && !loading && (
              <tr><td className="p-6 text-center text-gray-500" colSpan={6}>No requests yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
