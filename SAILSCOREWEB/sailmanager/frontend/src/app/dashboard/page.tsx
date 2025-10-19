'use client';

import RequireAuth from '@/components/RequireAuth';
import { useAuth } from '@/context/AuthContext';
import FeatureCard from '@/components/FeatureCard';
import { useRegattaStatus } from '@/hooks/useRegattaStatus';
import { useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

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
    // scoringEnquiry?: boolean;
  };
  regatta?: { id: number; name: string };
};

function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, { label: string; classes: string }> = {
    upcoming: { label: 'upcoming', classes: 'bg-amber-100 text-amber-800' },
    active:   { label: 'active',   classes: 'bg-emerald-100 text-emerald-800' },
    finished: { label: 'finished', classes: 'bg-gray-200 text-gray-800' },
  };
  const s = (status && map[status]) || { label: 'unknown', classes: 'bg-gray-100 text-gray-700' };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${s.classes}`}>
      {s.label}
    </span>
  );
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const params = useParams();
  const search = useSearchParams();

  const idFromPath = Number((params as any)?.id);
  const idFromQS = Number(search.get('regattaId') || '');

  const regattaId = useMemo(() => {
    if (user?.role === 'regatista' && user?.current_regatta_id) return user.current_regatta_id;
    if (Number.isFinite(idFromPath)) return idFromPath;
    if (Number.isFinite(idFromQS)) return idFromQS;
    return Number(process.env.NEXT_PUBLIC_CURRENT_REGATTA_ID || '1');
  }, [user?.role, user?.current_regatta_id, idFromPath, idFromQS]);

  const { data, loading } = useRegattaStatus(regattaId);
  const status = data as RegattaStatusResponse | undefined;

  return (
    <RequireAuth roles={['regatista', 'admin']}>
      <div className="space-y-6">
        {/* Header */}
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
                redirectTo: Number.isFinite(regattaId) ? `/regattas/${regattaId}` : '/',
              })
            }
            className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300"
          >
            Sign out
          </button>
        </header>

        {/* Info bar */}
        {!loading && (
          <div className="rounded-lg border bg-white p-4 text-sm text-gray-700">
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <div>
                <span className="font-medium">Regatta:</span>{' '}
                <span>{status?.regatta?.name ?? `#${regattaId}`}</span>
              </div>
              <div className="text-gray-600">
                <span className="font-medium">Windows:</span>{' '}
                Rule 42 {status?.windows?.rule42 ? '✔' : '✖'} ·{' '}
                Score Review {status?.windows?.scoreReview ? '✔' : '✖'} ·{' '}
                Requests {status?.windows?.requests ? '✔' : '✖'} ·{' '}
                Questions {status?.windows?.questions ? '✔' : '✖'} ·{' '}
                Protest {status?.windows?.protest ? '✔' : '✖'}
              </div>
            </div>
          </div>
        )}

        {/* Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          <FeatureCard
            title="Entry data"
            description="Review your entry details and download receipts."
            href={`/dashboard/entry-data?regattaId=${regattaId}`}
            enabled={Boolean(status?.windows?.entryData)}
            cta="Go to Entry Data"
          />
          <FeatureCard
            title="Documents"
            description="Documents and proofs associated with your entry."
            href={`/dashboard/documents?regattaId=${regattaId}`}
            enabled={Boolean(status?.windows?.documents)}
            cta="Go to Documents"
          />

          <FeatureCard
            title="Rule 42"
            description="Check on-the-water penalties (Rule 42)."
            href={`/dashboard/rule42?regattaId=${regattaId}`}
            enabled={Boolean(status?.windows?.rule42)}
            cta="Go to Rule 42"
          />

          {/* Scoring Enquiries (optional) */}
          <FeatureCard
            title="Scoring Enquiries"
            description="Submit and track scoring questions to the Race Committee."
            href={`/dashboard/scoring?regattaId=${regattaId}`}
            enabled={Boolean((status as any)?.windows?.scoringEnquiry ?? status?.windows?.scoreReview)}
            cta="Go to Scoring Enquiries"
          />

          <FeatureCard
            title="Score Review"
            description="Submit score review requests and follow decisions."
            href={`/dashboard/score-review?regattaId=${regattaId}`}
            enabled={Boolean(status?.windows?.scoreReview)}
            cta="Go to Score Review"
          />

          <FeatureCard
            title="Questions"
            description="Ask questions to the organization and see answers."
            href={`/dashboard/questions?regattaId=${regattaId}`}
            // Fallback: if windows.questions is undefined, use windows.requests; otherwise default TRUE
            enabled={
              (status?.windows?.questions ??
               status?.windows?.requests ??
               true) as boolean
            }
            cta="Go to Questions"
          />

          <FeatureCard
            title="Requests"
            description="Send requests to the Race Committee and track responses."
            href={`/dashboard/requests?regattaId=${regattaId}`}
            enabled={Boolean(status?.windows?.requests)}
            cta="Go to Requests"
          />

          <FeatureCard
            title="Protests"
            description="Submit and track protests (protestor, protestee, or witness)."
            href={`/dashboard/protests?regattaId=${regattaId}`}
            enabled={Boolean(status?.windows?.protest)}
            cta="Go to Protests"
          />
        </div>

        {loading && <div className="text-sm text-gray-500">Loading regatta status…</div>}
      </div>
    </RequireAuth>
  );
}
