'use client';

import { useEffect, useState } from 'react';
import RequireAuth from '@/components/RequireAuth';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { useAuth } from '@/context/AuthContext';
import { apiListMarketingDemoRequests, type MarketingDemoRequestRow } from '@/lib/api';

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export default function DemoRequestsPage() {
  const { token, user } = useAuth();
  const [rows, setRows] = useState<MarketingDemoRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || user?.role !== 'platform_admin') {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await apiListMarketingDemoRequests(token, { limit: 200 });
        if (!cancelled) setRows(Array.isArray(data) ? data : []);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load demo requests.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, user?.role]);

  return (
    <RequireAuth roles={['platform_admin']}>
      <div className="flex min-h-screen bg-gray-100">
        <AdminSidebar />
        <main className="flex-1 px-6 sm:px-8 py-10">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">Demo requests</h1>
          <p className="text-gray-600 mb-6 max-w-3xl">
            Submissions from the &quot;Book a Demo&quot; form on the public homepage. You also get a copy by email when{' '}
            <code className="mx-1 rounded bg-gray-200 px-1 text-xs">DEMO_REQUEST_NOTIFY_EMAIL</code>
            is set on the server.
          </p>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
          )}

          {loading ? (
            <p className="text-gray-500">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-gray-500">No demo requests yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-600">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Club</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Notify email sent</th>
                    <th className="px-4 py-3">Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r) => (
                    <tr key={r.id} className="align-top hover:bg-gray-50/80">
                      <td className="whitespace-nowrap px-4 py-3 text-gray-700">{formatWhen(r.created_at)}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{r.full_name}</td>
                      <td className="px-4 py-3">
                        <a className="text-blue-600 hover:underline" href={`mailto:${r.email}`}>
                          {r.email}
                        </a>
                      </td>
                      <td className="max-w-[12rem] px-4 py-3 text-gray-800">{r.club_name}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-700">{r.phone || '—'}</td>
                      <td className="px-4 py-3 text-gray-700">{r.notification_email_sent ? 'Yes' : 'No'}</td>
                      <td className="max-w-md px-4 py-3 text-gray-700">
                        {r.message ? (
                          <span className="whitespace-pre-wrap break-words">{r.message}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </RequireAuth>
  );
}
