'use client';

import { useParams, useRouter } from 'next/navigation';
import RequireAuth from '@/components/RequireAuth';
import { useAuth } from '@/context/AuthContext';
import { isAdminRole } from '@/lib/roles';
import { useDashboardOrg } from '@/context/DashboardOrgContext';
import { useDashboardRegattaId } from '@/lib/dashboardRegattaScope';
import useProtestPage, { ProtestType } from '../../new/useProtestPage';
import ProtestorCard from '../../new/components/ProtestorCard';
import RespondentsEditor from '../../new/components/RespondentsEditor';

const TYPES: ProtestType[] = [
  'protest',
  'redress',
  'reopen',
  'support_person_report',
  'misconduct_rss69',
];

const TYPE_LABELS: Record<ProtestType, string> = {
  protest: 'Protest',
  redress: 'Redress',
  reopen: 'Reopen hearing',
  support_person_report: 'Support person report',
  misconduct_rss69: 'Misconduct (RRS 69)',
};

function EditProtestPageContent() {
  const router = useRouter();
  const params = useParams();
  const { user, token } = useAuth();

  const protestId = Number((params as { protestId?: string }).protestId || '');
  const isJury = user?.role === 'jury';
  const isAdmin = isAdminRole(user?.role);

  const regattaId = useDashboardRegattaId();
  const { withOrg } = useDashboardOrg();

  const api = useProtestPage(regattaId, token || undefined, {
    forJury: isJury,
    forAdmin: isAdmin,
    editProtestId: Number.isFinite(protestId) && protestId > 0 ? protestId : null,
  });

  const back = () => {
    if (isJury) router.push(withOrg('/dashboard/protests'));
    else if (isAdmin && regattaId) router.push(`/admin/manage-regattas/${regattaId}`);
    else router.push(withOrg('/dashboard/protests'));
  };

  if (!isJury && !isAdmin) {
    return (
      <RequireAuth roles={['jury', 'admin', 'platform_admin']}>
        <div className="max-w-3xl mx-auto p-4">Access denied.</div>
      </RequireAuth>
    );
  }

  if (!regattaId || !Number.isFinite(protestId) || protestId <= 0) {
    return (
      <RequireAuth roles={['jury', 'admin', 'platform_admin']}>
        <div className="max-w-3xl mx-auto p-4 text-sm text-gray-700">
          {isAdmin
            ? 'Set the regatta in the URL: ?regattaId=…'
            : 'Invalid regatta or protest for this session.'}
        </div>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth roles={['jury', 'admin', 'platform_admin']}>
      <div className="max-w-3xl mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Editar protesto {api.editProtestId ? `P-${api.editProtestId}` : ''}</h1>
          <button type="button" className="px-3 py-2 rounded border" onClick={back}>
            Voltar
          </button>
        </div>

        <section className="bg-white rounded border p-4 space-y-3">
          <h2 className="font-semibold">Basic information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">Type</label>
              <select
                className="w-full border rounded px-3 py-2"
                value={api.type}
                onChange={(e) => api.setType(e.target.value as ProtestType)}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Race date</label>
              <input
                type="date"
                lang="en-GB"
                className="w-full border rounded px-3 py-2"
                value={api.raceDate}
                onChange={(e) => api.setRaceDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Race number</label>
              <input
                className="w-full border rounded px-3 py-2"
                value={api.raceNumber}
                onChange={(e) => api.setRaceNumber(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Group (optional)</label>
              <input
                className="w-full border rounded px-3 py-2"
                value={api.groupName}
                onChange={(e) => api.setGroupName(e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="bg-white rounded border p-4 space-y-3">
          {api.adminInitiatorFreeTextOnly ? (
            <>
              <h2 className="font-semibold">Protestor / party</h2>
              <div>
                <label className="block text-sm mb-1">Who is protesting</label>
                <input
                  type="text"
                  className="w-full max-w-xl border rounded px-3 py-2 text-sm"
                  value={api.initiatorPartyText}
                  onChange={(e) => api.setInitiatorPartyText(e.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              <h2 className="font-semibold">Protestor (initiating boat)</h2>
              <ProtestorCard
                loadingEntries={api.loadingEntries}
                myEntries={api.myEntries}
                initiatorEntryId={api.initiatorEntryId}
                setInitiatorEntryId={api.setInitiatorEntryId}
                selectedInitiator={api.selectedInitiator}
                initiatorRep={api.initiatorRep}
                setInitiatorRep={api.setInitiatorRep}
              />
            </>
          )}
        </section>

        <section className="bg-white rounded border p-4 space-y-3">
          <h2 className="font-semibold">Respondents</h2>
          <RespondentsEditor
            respondents={api.respondents}
            classes={api.classes}
            entriesByClass={api.entriesByClass}
            addRespondent={api.addRespondent}
            removeRespondent={api.removeRespondent}
            updateRespondent={api.updateRespondent}
            ensureClassEntries={api.ensureClassEntries}
          />
        </section>

        <section className="bg-white rounded border p-4 space-y-3">
          <h2 className="font-semibold">Incident</h2>
          <div>
            <label className="block text-sm mb-1">When and where</label>
            <textarea
              className="w-full border rounded px-3 py-2"
              rows={2}
              value={api.incidentWhenWhere}
              onChange={(e) => api.setIncidentWhenWhere(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Description</label>
            <textarea
              className="w-full border rounded px-3 py-2"
              rows={4}
              value={api.incidentDescription}
              onChange={(e) => api.setIncidentDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Regras alegadas</label>
            <textarea
              className="w-full border rounded px-3 py-2"
              rows={2}
              value={api.rulesAlleged}
              onChange={(e) => api.setRulesAlleged(e.target.value)}
            />
          </div>
        </section>

        {api.error && <div className="text-red-600">{api.error}</div>}
        <div className="flex items-center gap-3">
          <button
            className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
            onClick={async () => {
              const ok = await api.submit();
              if (ok) back();
            }}
            disabled={api.submitting}
          >
            {api.submitting ? 'Saving…' : 'Save changes'}
          </button>
          <button type="button" className="px-4 py-2 rounded border" onClick={back}>
            Cancel
          </button>
        </div>
      </div>
    </RequireAuth>
  );
}

export default function EditProtestPage() {
  return <EditProtestPageContent />;
}
