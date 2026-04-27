'use client';

import { useMemo } from 'react';
import RequireAuth from '@/components/RequireAuth';
import { useAuth } from '@/context/AuthContext';
import Rule42Manager from '@/components/rule42/Rule42Manager';

export default function JuryRule42Page() {
  const { user, logout } = useAuth();

  const regattaId = useMemo(() => {
    if (user?.role !== 'jury') return null;
    const rid = user?.current_regatta_id;
    return typeof rid === 'number' && rid > 0 ? rid : null;
  }, [user?.role, user?.current_regatta_id]);

  if (!regattaId) {
    return (
      <RequireAuth roles={['jury']}>
        <div className="p-6 max-w-lg text-sm text-gray-700">
          <p className="mb-2">No regatta found in this session.</p>
          <p className="mb-4">
            Start from the regatta page with{' '}
            <code className="bg-gray-100 px-1 rounded">/login?regattaId=...</code> and jury credentials.
          </p>
        </div>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth roles={['jury']}>
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-gray-900">Rule 42</h1>
          <button
            type="button"
            onClick={() => logout({ redirectTo: `/regattas/${regattaId}` })}
            className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300 text-sm"
          >
            Sign out
          </button>
        </header>
        <Rule42Manager regattaId={regattaId} heading="" />
      </div>
    </RequireAuth>
  );
}
