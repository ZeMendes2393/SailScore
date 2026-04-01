'use client';

import RequireAuth from '@/components/RequireAuth';
import { useAuth } from '@/context/AuthContext';
import { useDashboardOrg } from '@/context/DashboardOrgContext';
import FeatureCard from '@/components/FeatureCard';
import { useRegattaStatus } from '@/hooks/useRegattaStatus';
import { useDashboardRegattaId } from '@/lib/dashboardRegattaScope';

type RegattaStatusResponse = {
  status: 'upcoming' | 'active' | 'finished';
  now_utc: string;
  start_utc?: string | null;
  end_utc?: string | null;
  windows: {
    entryData: boolean;
    documents: boolean;
    rule42: boolean;
    scoreReview: boolean;
    requests: boolean;
    protest: boolean;
    questions: boolean;
  };
  regatta?: { id: number; name: string };
};

function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, { label: string; classes: string }> = {
    upcoming: { label: 'upcoming', classes: 'bg-amber-100 text-amber-800' },
    active: { label: 'active', classes: 'bg-emerald-100 text-emerald-800' },
    finished: { label: 'finished', classes: 'bg-gray-200 text-gray-800' },
  };
  const s = (status && map[status]) || { label: 'unknown', classes: 'bg-gray-100 text-gray-700' };
  return (
    <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-sm font-medium ${s.classes}`}>
      {s.label}
    </span>
  );
}

const dashboardShell = 'mx-auto w-full max-w-[min(100%,90rem)] px-4 sm:px-6 lg:px-10 space-y-6';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const { withOrg } = useDashboardOrg();
  const regattaId = useDashboardRegattaId();

  const { data, loading } = useRegattaStatus(regattaId);
  const status = data as RegattaStatusResponse | undefined;

  if (user?.role === 'jury') {
    return (
      <RequireAuth roles={['jury']}>
        <div className={dashboardShell}>
          <header className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Júri</h1>
              <p className="mt-1 text-base text-gray-600">
                {(user as { name?: string }).name || user?.email}
                {!loading && status?.regatta?.name && (
                  <span className="ml-2 text-gray-500">· {status.regatta.name}</span>
                )}
              </p>
            </div>
            <button
              onClick={() =>
                logout({
                  redirectTo: regattaId != null ? `/regattas/${regattaId}` : '/',
                })
              }
              className="px-4 py-2.5 rounded-lg text-base font-medium bg-gray-200 hover:bg-gray-300"
            >
              Terminar sessão
            </button>
          </header>

          <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
            <FeatureCard
              title="Rule 42"
              description="Registar e gerir penalidades Rule 42 nesta regata."
              href={withOrg('/dashboard/jury/rule42')}
              enabled
              cta="Abrir Rule 42"
            />
            <FeatureCard
              title="Protests"
              description="View all protests and create one on behalf of an entry."
              href={withOrg('/dashboard/protests')}
              enabled
              cta="Open protests"
            />
          </div>

          {loading && <div className="text-sm text-gray-500">A carregar regata…</div>}
        </div>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth roles={['regatista', 'admin']}>
      <div className="space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Sailor Dashboard</h1>
            <p className="mt-1 text-sm text-gray-600 flex items-center gap-2">
              {user?.email}
              {!loading && <StatusBadge status={status?.status} />}
            </p>
          </div>
          <button
            onClick={() =>
              logout({
                redirectTo: regattaId != null ? `/regattas/${regattaId}` : '/',
              })
            }
            className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300"
          >
            Sign out
          </button>
        </header>

        {!loading && (
          <div className="rounded-lg border bg-white p-4 text-sm text-gray-700">
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <div>
                <span className="font-medium">Regatta:</span>{' '}
                <span>{status?.regatta?.name ?? `#${regattaId}`}</span>
              </div>
              <div className="text-gray-600">
                <span className="font-medium">Windows:</span> Rule 42 {status?.windows?.rule42 ? '✔' : '✖'} ·
                Requests {status?.windows?.requests ? '✔' : '✖'} · Questions{' '}
                {status?.windows?.questions ? '✔' : '✖'} · Protest {status?.windows?.protest ? '✔' : '✖'}
              </div>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <FeatureCard
            title="Entry data"
            description="Review your entry details."
            href={withOrg('/dashboard/entry-data')}
            enabled={Boolean(status?.windows?.entryData)}
            cta="Go to Entry Data"
          />
          <FeatureCard
            title="Documents"
            description="Documents and proofs associated with your entry."
            href={withOrg('/dashboard/documents')}
            enabled={Boolean(status?.windows?.documents)}
            cta="Go to Documents"
          />

          <FeatureCard
            title="Rule 42"
            description="Check on-the-water penalties (Rule 42)."
            href={withOrg('/dashboard/rule42')}
            enabled={Boolean(status?.windows?.rule42)}
            cta="Go to Rule 42"
          />

          <FeatureCard
            title="Scoring Enquiries"
            description="Submit and track scoring questions to the Race Committee."
            href={withOrg('/dashboard/scoring')}
            enabled={Boolean((status as any)?.windows?.scoringEnquiry ?? status?.windows?.scoreReview)}
            cta="Go to Scoring Enquiries"
          />

          <FeatureCard
            title="Questions"
            description="Ask questions to the organization and see answers."
            href={withOrg('/dashboard/questions')}
            enabled={
              (status?.windows?.questions ?? status?.windows?.requests ?? true) as boolean
            }
            cta="Go to Questions"
          />

          <FeatureCard
            title="Requests"
            description="Send requests to the Race Committee and track responses."
            href={withOrg('/dashboard/requests')}
            enabled={Boolean(status?.windows?.requests)}
            cta="Go to Requests"
          />

          <FeatureCard
            title="Protests"
            description="Submit and track protests (protestor, protestee, or witness)."
            href={withOrg('/dashboard/protests')}
            enabled={Boolean(status?.windows?.protest)}
            cta="Go to Protests"
          />
        </div>

        {loading && <div className="text-base text-gray-500">Loading regatta status…</div>}
      </div>
    </RequireAuth>
  );
}
