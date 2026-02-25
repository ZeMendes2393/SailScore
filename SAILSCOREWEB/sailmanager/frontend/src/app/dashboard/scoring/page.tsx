'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiGet } from '@/lib/api';
import type { ScoringRead } from '@/lib/api';
import { SailNumberDisplay } from '@/components/ui/SailNumberDisplay';

export default function ScoringEnquiriesPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const regattaId = useMemo(() => {
    if (user?.role === 'regatista' && user?.current_regatta_id) return user.current_regatta_id;
    const fromQS = Number(searchParams.get('regattaId') || '');
    const fromEnv = Number(process.env.NEXT_PUBLIC_CURRENT_REGATTA_ID || '1');
    return Number.isFinite(fromQS) && fromQS > 0 ? fromQS : fromEnv;
  }, [user?.role, user?.current_regatta_id, searchParams]);

  const [rows, setRows] = useState<ScoringRead[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    if (!regattaId || !token) return;
    setLoading(true);
    setErr(null);
    try {
      const data = await apiGet<ScoringRead[]>(`/regattas/${regattaId}/scoring`, token);
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load scoring enquiries.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [regattaId, token]);

  if (!regattaId || !token) {
    return <div className="p-4 text-sm text-gray-600">Initializing…</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Scoring Enquiries</h1>
        <div className="flex items-center gap-2">
          <button
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
            onClick={() => router.push(`/dashboard/scoring/new?regattaId=${regattaId}`)}
          >
            New Scoring Enquiry
          </button>
          <button
            className="px-3 py-2 rounded border hover:bg-gray-50"
            onClick={load}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-600">
        Submit and track scoring questions to the Race Committee. These are separate from Requests or Redress.
      </p>

      <div className="bg-white rounded border overflow-x-auto">
        <table className="min-w-full text-sm table-fixed">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 w-16">#</th>
              <th className="p-2 w-32">Sail No.</th>
              <th className="p-2 w-40">Class</th>
              <th className="p-2 w-24">Race</th>
              <th className="p-2">Requested change</th>
              <th className="p-2 w-28">Status</th>
              <th className="p-2 w-[28rem]">Decision / Response</th>
              <th className="p-2 w-40">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="p-6 text-center text-gray-500" colSpan={8}>Loading…</td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td className="p-6 text-center text-gray-500" colSpan={8}>
                  No scoring enquiries yet. Use &quot;New Scoring Enquiry&quot; to submit one.
                </td>
              </tr>
            )}
            {!loading && rows.map((r) => (
              <tr key={r.id} className="border-t align-top">
                <td className="p-2">{r.id}</td>
                <td className="p-2">
                  <SailNumberDisplay countryCode={(r as any).boat_country_code} sailNumber={r.sail_number} />
                </td>
                <td className="p-2">{r.class_name || '—'}</td>
                <td className="p-2">{r.race_number || '—'}</td>
                <td className="p-2 max-w-[20rem]">
                  <div className="whitespace-pre-wrap break-words">{r.requested_change || '—'}</div>
                </td>
                <td className="p-2 capitalize">{(r.status || '').replace('_', ' ')}</td>
                <td className="p-2 max-w-[28rem]">
                  <div className="whitespace-pre-wrap break-words">
                    {r.response?.trim() || <span className="text-gray-400">—</span>}
                  </div>
                </td>
                <td className="p-2">{r.created_at ? new Date(r.created_at).toLocaleString('en-GB') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!loading && rows.length > 0 && (
        <div className="text-sm text-gray-500">
          Details: requested score, boat ahead/behind — visible to the Race Committee; response appears when they reply.
        </div>
      )}

      {err && <div className="text-red-600">{err}</div>}
    </div>
  );
}
