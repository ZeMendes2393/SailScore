'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProtests, ProtestScope } from '@/hooks/useProtests';
import { useRegattaStatus } from '@/hooks/useRegattaStatus';
import { useAuth } from '@/context/AuthContext';
import RequireAuth from '@/components/RequireAuth';
import { isAdminRole } from '@/lib/roles';
import { useDashboardOrg } from '@/context/DashboardOrgContext';
import { useDashboardRegattaId } from '@/lib/dashboardRegattaScope';

import type { ProtestListItem, ProtestPartySummary } from '@/lib/api';
import HearingsDecisions from '@/app/admin/manage-regattas/[id]/noticeboard/sections/HearingsDecisions';

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

/** Júri / admin: só a tabela de audiências (sem lista duplicada de protestos). */
function StaffHearingsOnly({ regattaId }: { regattaId: number }) {
  const { withOrg } = useDashboardOrg();
  const { user } = useAuth();
  const isAdmin = isAdminRole(user?.role);

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-6">Hearings & protest decisions</h1>
      <HearingsDecisions
        regattaId={regattaId}
        linkWithOrg={withOrg}
        newProtestHref={
          isAdmin && regattaId ? `/dashboard/protests/new?regattaId=${regattaId}` : '/dashboard/protests/new'
        }
        fillDecisionPath={(pid) => `/dashboard/protests/${pid}/decision`}
      />
    </div>
  );
}

/** Regatista: lista de protestos (âmbito pessoal). */
function SailorProtestsList({ regattaId }: { regattaId: number }) {
  const router = useRouter();
  const { token } = useAuth();
  const { withOrg } = useDashboardOrg();

  const [tab, setTab] = useState<ProtestScope>('all');

  const protestParams = useMemo(() => ({ scope: tab, limit: 20 }), [tab]);

  const { items, loading, error, hasMore, loadMore } = useProtests(
    regattaId,
    protestParams,
    token || undefined
  );

  const { data: regStatus } = useRegattaStatus(regattaId);
  const windows = regStatus?.windows ?? DEFAULT_WINDOWS;

  const canCreateProtest = Boolean(windows.protest);

  const goNew = () => {
    router.push(withOrg('/dashboard/protests/new'));
  };

  const goEdit = (id: number) => {
    router.push(withOrg(`/dashboard/protests/${id}/edit`));
  };

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Protests</h1>
        <button
          disabled={!canCreateProtest}
          onClick={goNew}
          className={`px-4 py-2 rounded ${
            canCreateProtest ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600 cursor-not-allowed'
          }`}
          title={canCreateProtest ? 'New protest' : 'Outside the protest submission window'}
        >
          New protest
        </button>
      </div>

      <div className="flex gap-2 mb-3">
        {(['all', 'made', 'against'] as ProtestScope[]).map((s) => (
          <button
            key={s}
            className={`px-3 py-1 rounded border ${tab === s ? 'bg-gray-900 text-white' : 'bg-white'}`}
            onClick={() => setTab(s)}
          >
            {s === 'all' ? 'All' : s === 'made' ? 'Filed by me' : 'Against me'}
          </button>
        ))}
      </div>

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
              <th className="text-left py-2 px-3"> </th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <Row key={it.id} item={it} canEdit onEdit={goEdit} />
            ))}
          </tbody>
        </table>

        {!loading && items.length === 0 && (
          <div className="p-6 text-center text-gray-600">
            There are no protests linked to you for this regatta yet.
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 mt-3">
        {hasMore && (
          <button onClick={loadMore} disabled={loading} className="px-4 py-2 rounded border">
            {loading ? 'Loading…' : 'More'}
          </button>
        )}
        {error && <div className="text-red-600">{error}</div>}
      </div>
    </div>
  );
}

function ProtestsPageContent() {
  const { user, token } = useAuth();
  const isAdmin = isAdminRole(user?.role);
  const staffView = user?.role === 'jury' || isAdmin;

  const regattaId = useDashboardRegattaId();

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
          {user?.role === 'jury' && 'No regatta in session. Sign in with /login?regattaId=…'}
          {isAdmin && 'Open this page with ?regattaId=… in the URL.'}
          {user?.role === 'regatista' && 'Regatta could not be identified.'}
        </div>
      </RequireAuth>
    );
  }

  if (staffView) {
    return (
      <RequireAuth roles={['regatista', 'jury', 'admin', 'platform_admin']}>
        <StaffHearingsOnly regattaId={regattaId} />
      </RequireAuth>
    );
  }

  return (
    <RequireAuth roles={['regatista', 'jury', 'admin', 'platform_admin']}>
      <SailorProtestsList regattaId={regattaId} />
    </RequireAuth>
  );
}

export default function ProtestsPage() {
  return <ProtestsPageContent />;
}
