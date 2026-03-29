'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProtests, ProtestScope } from '@/hooks/useProtests';
import { useRegattaStatus } from '@/hooks/useRegattaStatus';
import { useAuth } from '@/context/AuthContext';
import RequireAuth from '@/components/RequireAuth';
import { isAdminRole } from '@/lib/roles';
import { useDashboardRegattaId } from '@/lib/dashboardRegattaScope';

import type { ProtestListItem, ProtestPartySummary } from '@/lib/api';

const DEFAULT_WINDOWS = {
  entryData: true,
  documents: true,
  rule42: true,
  scoreReview: true,
  requests: true,
  protest: true,
};

function Row({
  item,
  canEdit,
  onEdit,
}: {
  item: ProtestListItem;
  canEdit: boolean;
  onEdit: (id: number) => void;
}) {
  const respondents = item.respondents
    .map((r: ProtestPartySummary) => r.sail_no || r.free_text || '—')
    .join(', ');

  return (
    <tr className="border-b">
      <td className="py-2 px-3">{item.short_code}</td>
      <td className="py-2 px-3 capitalize">{item.type.replaceAll('_', ' ')}</td>
      <td className="py-2 px-3">{item.race_number || '—'}</td>
      <td className="py-2 px-3">{item.race_date || '—'}</td>
      <td className="py-2 px-3 max-w-xs truncate" title={item.initiator.party_text || item.initiator.sail_no || ''}>
        {item.initiator.party_text || item.initiator.sail_no || '—'}
      </td>
      <td className="py-2 px-3">{respondents || '—'}</td>
      <td className="py-2 px-3">{item.status}</td>
      {canEdit && (
        <td className="py-2 px-3">
          <button
            type="button"
            className="text-blue-600 hover:underline text-sm"
            onClick={() => onEdit(item.id)}
          >
            Edit
          </button>
        </td>
      )}
    </tr>
  );
}

function ProtestsPageContent() {
  const router = useRouter();
  const { user, token } = useAuth();
  const isJury = user?.role === 'jury';
  const isAdmin = isAdminRole(user?.role);
  const staffView = isJury || isAdmin;

  const regattaId = useDashboardRegattaId();

  const [tab, setTab] = useState<ProtestScope>('all');

  const protestParams = useMemo(
    () => ({ scope: staffView ? 'all' : tab, limit: 20 }),
    [tab, staffView]
  );

  const { items, loading, error, hasMore, loadMore } = useProtests(
    regattaId,
    protestParams,
    token || undefined
  );

  const { data: regStatus } = useRegattaStatus(regattaId);
  const windows = regStatus?.windows ?? DEFAULT_WINDOWS;

  const canCreateProtest = Boolean(windows.protest) || isJury || isAdmin;

  const goNew = () => {
    if (isJury || user?.role === 'regatista') router.push('/dashboard/protests/new');
    else router.push(`/dashboard/protests/new?regattaId=${regattaId}`);
  };

  const goEdit = (id: number) => {
    if (isJury) router.push(`/dashboard/protests/${id}/edit`);
    else if (isAdmin && regattaId) {
      router.push(`/dashboard/protests/${id}/edit?regattaId=${regattaId}`);
    }
  };

  if (!token) {
    return (
      <RequireAuth roles={['regatista', 'jury', 'admin', 'platform_admin']}>
        <div className="max-w-6xl mx-auto p-4 text-sm text-gray-600">A iniciar…</div>
      </RequireAuth>
    );
  }

  if (!regattaId) {
    return (
      <RequireAuth roles={['regatista', 'jury', 'admin', 'platform_admin']}>
        <div className="max-w-6xl mx-auto p-4 text-sm text-gray-700">
          {isJury && 'No regatta in session. Sign in with /login?regattaId=…'}
          {isAdmin && 'Open this page with ?regattaId=… in the URL.'}
          {!isJury && !isAdmin && 'Regatta could not be identified.'}
        </div>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth roles={['regatista', 'jury', 'admin', 'platform_admin']}>
      <div className="max-w-6xl mx-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold">Protests</h1>
          <button
            disabled={!canCreateProtest}
            onClick={goNew}
            className={`px-4 py-2 rounded ${
              canCreateProtest
                ? 'bg-blue-600 text-white'
                : 'bg-gray-300 text-gray-600 cursor-not-allowed'
            }`}
            title={
              canCreateProtest
                ? 'New protest'
                : 'Outside the protest submission window'
            }
          >
            New protest
          </button>
        </div>

        {!staffView && (
          <div className="flex gap-2 mb-3">
            {(['all', 'made', 'against'] as ProtestScope[]).map((s) => (
              <button
                key={s}
                className={`px-3 py-1 rounded border ${
                  tab === s ? 'bg-gray-900 text-white' : 'bg-white'
                }`}
                onClick={() => setTab(s)}
              >
                {s === 'all' ? 'All' : s === 'made' ? 'Filed by me' : 'Against me'}
              </button>
            ))}
          </div>
        )}

        {isJury && (
          <p className="text-sm text-gray-600 mb-3">
            All protests for this regatta. You can create or edit on behalf of entries.
          </p>
        )}
        {isAdmin && (
          <p className="text-sm text-gray-600 mb-3">
            Admin view: all protests for this regatta. Use ?regattaId=… in the URL, or open from manage
            regatta. The “Filed by” field on the form identifies who submits the protest (editable).
          </p>
        )}

        <div className="overflow-x-auto bg-white rounded border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-2 px-3">#</th>
                <th className="text-left py-2 px-3">Type</th>
                <th className="text-left py-2 px-3">Race</th>
                <th className="text-left py-2 px-3">Date</th>
                <th className="text-left py-2 px-3">Initiator</th>
                <th className="text-left py-2 px-3">Respondent(s)</th>
                <th className="text-left py-2 px-3">Status</th>
                {staffView && <th className="text-left py-2 px-3"> </th>}
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <Row key={it.id} item={it} canEdit={staffView} onEdit={goEdit} />
              ))}
            </tbody>
          </table>

          {!loading && items.length === 0 && (
            <div className="p-6 text-center text-gray-600">
              {staffView
                ? 'There are no protests for this regatta yet.'
                : 'There are no protests linked to you for this regatta yet.'}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 mt-3">
          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loading}
              className="px-4 py-2 rounded border"
            >
              {loading ? 'Loading…' : 'More'}
            </button>
          )}
          {error && <div className="text-red-600">{error}</div>}
        </div>
      </div>
    </RequireAuth>
  );
}

export default function ProtestsPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-6xl mx-auto p-6 text-sm text-gray-500">Loading…</div>
      }
    >
      <ProtestsPageContent />
    </Suspense>
  );
}
