'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import RequireAuth from '@/components/RequireAuth';
import { useAuth } from '@/context/AuthContext';
import { useMyEntry } from '@/lib/hooks/useMyEntry';

function V({ children }: { children?: React.ReactNode }) {
  return <span className="text-gray-900">{children ?? '—'}</span>;
}

export default function Page() {
  const searchParams = useSearchParams();
  const { user, token } = useAuth();

  // Same rule as Protests to pick the active regatta
  const regattaId = useMemo(() => {
    if (user?.role === 'regatista' && user?.current_regatta_id) return user.current_regatta_id;
    const fromQS = Number(searchParams.get('regattaId') || '');
    const fromEnv = Number(process.env.NEXT_PUBLIC_CURRENT_REGATTA_ID || '1');
    return Number.isFinite(fromQS) && fromQS > 0 ? fromQS : fromEnv;
  }, [user?.role, user?.current_regatta_id, searchParams]);

  const { entry, loading, error, refresh } = useMyEntry(regattaId || null, token || undefined);

  return (
    <RequireAuth roles={['regatista','admin']}>
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold">My entry data</h1>
          <button
            onClick={refresh}
            className="px-3 py-2 rounded border"
            title="Reload"
          >
            Reload
          </button>
        </div>

        {(!regattaId || !token) && (
          <div className="text-sm text-gray-600">Initializing…</div>
        )}

        {loading && (
          <div className="text-gray-600">Loading…</div>
        )}

        {error && (
          <div className="text-red-600 mb-3">{error}</div>
        )}

        {!loading && !entry && !error && (
          <div className="p-6 rounded border bg-white">
            There is no entry associated with this regatta yet.
          </div>
        )}

        {entry && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Summary */}
            <section className="bg-white rounded border p-4">
              <h2 className="font-semibold mb-3">Summary</h2>
              <dl className="grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-gray-500">Regatta ID</dt><dd><V>{entry.regatta_id}</V></dd>
                <dt className="text-gray-500">Class</dt><dd><V>{entry.class_name}</V></dd>
                <dt className="text-gray-500">Paid</dt><dd><V>{entry.paid ? 'Yes' : 'No'}</V></dd>
                <dt className="text-gray-500">Created at</dt>
                <dd><V>{entry.created_at ? new Date(entry.created_at).toLocaleString('en-GB') : '—'}</V></dd>
              </dl>
            </section>

            {/* Boat */}
            <section className="bg-white rounded border p-4">
              <h2 className="font-semibold mb-3">Boat</h2>
              <dl className="grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-gray-500">Boat name</dt><dd><V>{entry.boat_name}</V></dd>
                <dt className="text-gray-500">Sail number</dt><dd><V>{entry.sail_number}</V></dd>
                <dt className="text-gray-500">Boat country</dt><dd><V>{entry.boat_country}</V></dd>
                <dt className="text-gray-500">Category</dt><dd><V>{entry.category}</V></dd>
              </dl>
            </section>

            {/* Helm */}
            <section className="bg-white rounded border p-4">
              <h2 className="font-semibold mb-3">Helm</h2>
              <dl className="grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-gray-500">Name</dt>
                <dd><V>{[entry.first_name, entry.last_name].filter(Boolean).join(' ') || '—'}</V></dd>
                <dt className="text-gray-500">Date of birth</dt>
                <dd><V>{entry.date_of_birth ? new Date(entry.date_of_birth).toLocaleDateString('en-GB') : '—'}</V></dd>
                <dt className="text-gray-500">Gender</dt><dd><V>{entry.gender}</V></dd>
                <dt className="text-gray-500">Club</dt><dd><V>{entry.club}</V></dd>
                <dt className="text-gray-500">Country (primary)</dt><dd><V>{entry.helm_country}</V></dd>
                <dt className="text-gray-500">Country (secondary)</dt><dd><V>{entry.helm_country_secondary}</V></dd>
              </dl>
            </section>

            {/* Contacts & Address */}
            <section className="bg-white rounded border p-4">
              <h2 className="font-semibold mb-3">Contacts & Address</h2>
              <dl className="grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-gray-500">Email</dt><dd><V>{entry.email}</V></dd>
                <dt className="text-gray-500">Phone 1</dt><dd><V>{entry.contact_phone_1}</V></dd>
                <dt className="text-gray-500">Phone 2</dt><dd><V>{entry.contact_phone_2}</V></dd>
                <dt className="text-gray-500">Territory</dt><dd><V>{entry.territory}</V></dd>
                <dt className="text-gray-500">Address</dt><dd><V>{entry.address}</V></dd>
                <dt className="text-gray-500">ZIP code</dt><dd><V>{entry.zip_code}</V></dd>
                <dt className="text-gray-500">City</dt><dd><V>{entry.town}</V></dd>
              </dl>
            </section>
          </div>
        )}
      </div>
    </RequireAuth>
  );
}
