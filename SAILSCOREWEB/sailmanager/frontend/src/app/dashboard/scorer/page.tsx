'use client';

import RequireAuth from '@/components/RequireAuth';
import { useAuth } from '@/context/AuthContext';
import { useDashboardRegattaId } from '@/lib/dashboardRegattaScope';

export default function ScorerHoldingPage() {
  const { user, logout } = useAuth();
  const regattaId = useDashboardRegattaId();

  return (
    <RequireAuth roles={['scorer']}>
      <div className="mx-auto max-w-2xl px-4 py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Scorer account</h1>
          <p className="mt-2 text-sm text-gray-600">
            Sessao iniciada com sucesso para <span className="font-medium">{user?.email}</span>.
          </p>
        </div>

        <div className="rounded-lg border bg-amber-50 border-amber-200 p-4 text-sm text-amber-900">
          A area do scorer ainda nao esta ativa. Para ja, esta conta apenas valida o login por campeonato.
        </div>

        <button
          onClick={() =>
            logout({
              redirectTo: regattaId != null ? `/regattas/${regattaId}` : '/',
            })
          }
          className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
        >
          Terminar sessao
        </button>
      </div>
    </RequireAuth>
  );
}
