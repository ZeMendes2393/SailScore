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
  };
  regatta?: { id: number; name: string };
};

function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, { label: string; classes: string }> = {
    upcoming: { label: 'por começar', classes: 'bg-amber-100 text-amber-800' },
    active:   { label: 'a decorrer',  classes: 'bg-emerald-100 text-emerald-800' },
    finished: { label: 'terminada',   classes: 'bg-gray-200 text-gray-800' },
  };
  const s = (status && map[status]) || { label: 'desconhecido', classes: 'bg-gray-100 text-gray-700' };
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

  // tenta extrair id do path (/regattas/[id]/dashboard)
  const idFromPath = Number((params as any)?.id);
  // tenta extrair da query (?regattaId=)
  const idFromQS = Number(search.get('regattaId') || '');

  const regattaId = useMemo(() => {
    // sailor: o token já trás a regata certa
    if (user?.role === 'regatista' && user?.current_regatta_id) {
      return user.current_regatta_id;
    }
    // admin (ou outros): aceita rota /regattas/[id]/dashboard
    if (Number.isFinite(idFromPath)) return idFromPath;
    // ou aceita ?regattaId=
    if (Number.isFinite(idFromQS)) return idFromQS;
    // fallback dev
    return Number(process.env.NEXT_PUBLIC_CURRENT_REGATTA_ID || '1');
  }, [user?.role, user?.current_regatta_id, idFromPath, idFromQS]);

  const { data, loading } = useRegattaStatus(regattaId);
  const status = data as RegattaStatusResponse | undefined;

  return (
    <RequireAuth roles={['regatista', 'admin']}>
      <div className="space-y-6">
        {/* Cabeçalho */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Sailor Dashboard</h1>
            <p className="mt-1 text-sm text-gray-600 flex items-center gap-2">
              {user?.email}
              {!loading && <StatusBadge status={status?.status} />}
            </p>
          </div>
          <button
            onClick={logout}
            className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300"
          >
            Terminar sessão
          </button>
        </header>

        {/* Info bar */}
        {!loading && (
          <div className="rounded-lg border bg-white p-4 text-sm text-gray-700">
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <div>
                <span className="font-medium">Regata:</span>{' '}
                <span>{status?.regatta?.name ?? `#${regattaId}`}</span>
              </div>
              <div className="text-gray-600">
                <span className="font-medium">Janelas:</span>{' '}
                Rule42 {status?.windows?.rule42 ? '✔' : '✖'} ·{' '}
                Score Review {status?.windows?.scoreReview ? '✔' : '✖'} ·{' '}
                Requests {status?.windows?.requests ? '✔' : '✖'} ·{' '}
                Protest {status?.windows?.protest ? '✔' : '✖'}
              </div>
            </div>
          </div>
        )}

        {/* Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          <FeatureCard
            title="Entry data"
            description="Revê os dados da tua inscrição e descarrega recibos."
            href={`/dashboard/entry-data?regattaId=${regattaId}`}
            enabled={Boolean(status?.windows?.entryData)}
            cta="Ir para Entry Data"
          />
          <FeatureCard
            title="Documents"
            description="Documentos e comprovativos associados à tua inscrição."
            href={`/dashboard/documents?regattaId=${regattaId}`}
            enabled={Boolean(status?.windows?.documents)}
            cta="Ir para Documents"
          />

          <FeatureCard
            title="Rule 42"
            description="Consulta penalizações por infrações na água (Regra 42)."
            href={`/dashboard/rule42?regattaId=${regattaId}`}
            enabled={Boolean(status?.windows?.rule42)}
            cta="Ir para Rule 42"
          />
          <FeatureCard
            title="Score Review"
            description="Submete pedidos de revisão de pontuação e acompanha decisões."
            href={`/dashboard/score-review?regattaId=${regattaId}`}
            enabled={Boolean(status?.windows?.scoreReview)}
            cta="Ir para Score Review"
          />
          <FeatureCard
            title="Requests"
            description="Envia pedidos/perguntas ao Race Committee e acompanha respostas."
            href={`/dashboard/requests?regattaId=${regattaId}`}
            enabled={Boolean(status?.windows?.requests)}
            cta="Ir para Requests"
          />
          <FeatureCard
            title="Protests"
            description="Submete e acompanha protestos (protestor, protestee ou testemunha)."
            href={`/dashboard/protests?regattaId=${regattaId}`}
            enabled={Boolean(status?.windows?.protest)}
            cta="Ir para Protest"
          />
        </div>

        {loading && (
          <div className="text-sm text-gray-500">A carregar estado da regata…</div>
        )}
      </div>
    </RequireAuth>
  );
}
