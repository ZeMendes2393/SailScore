'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiGet, apiPostJson } from '@/lib/api';

type TokenRes = { access_token: string };

export default function LoginPage() {
  const router = useRouter();
  const qs = useSearchParams();
  const { user, token, login, logout } = useAuth();

  // lê ?regattaId= e ?force=1
  const regattaId = Number(qs.get('regattaId') || '');
  const force = qs.get('force') === '1';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // se já estou autenticado como regatista **nesta** regata e não há "force",
  // segue direto para o dashboard
  useEffect(() => {
    if (!Number.isFinite(regattaId)) return;
    if (force) return;
    if (user?.role === 'regatista' && user.current_regatta_id === regattaId) {
      router.replace('/dashboard');
      return;
    }
  }, [user, regattaId, force, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (!Number.isFinite(regattaId)) {
        throw new Error('Regata inválida no URL.');
      }

      // login JSON com regatta_id (fluxo de regatista)
      const { access_token } = await apiPostJson<TokenRes>('/auth/login', {
        email,
        password,
        regatta_id: regattaId,
      });

      // perfil (traz id/role/current_regatta_id)
      const me = await apiGet('/auth/me', access_token);

      // guarda sessão e vai para o dashboard
      login(access_token, me as any);
      router.replace('/dashboard');
    } catch (err: any) {
      let msg = String(err?.message || 'Erro ao iniciar sessão.');
      try {
        const j = JSON.parse(msg);
        if (j?.detail?.requires_regatta_selection) {
          msg =
            'Esta conta tem inscrições em várias regatas. Entra a partir da página da regata pretendida.';
        } else if (j?.detail) {
          msg = j.detail;
        }
      } catch {}
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const disabled = !Number.isFinite(regattaId);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-md bg-white rounded border p-6">
        <h1 className="text-xl font-semibold mb-4">
          Entrar — Regata #{Number.isFinite(regattaId) ? regattaId : '—'}
        </h1>

        {!Number.isFinite(regattaId) && (
          <div className="mb-3 text-sm text-red-600">Regata inválida no URL.</div>
        )}

        {/* barra para trocar de conta rapidamente */}
        {user?.role === 'regatista' && (
          <div className="mb-4 flex items-center justify-between gap-3 text-sm">
            <span className="text-gray-600">
              Sessão atual: <b>{user.email}</b>
            </span>
            <button onClick={logout} className="px-3 py-1 rounded border hover:bg-gray-50">
              Entrar com outra conta
            </button>
          </div>
        )}

        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            className="w-full border rounded px-3 py-2"
            placeholder="Email do atleta"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
            disabled={disabled}
          />
          <input
            type="password"
            className="w-full border rounded px-3 py-2"
            placeholder="Palavra-passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            disabled={disabled}
          />
          <button
            type="submit"
            className="w-full bg-blue-600 text-white rounded py-2 disabled:opacity-50"
            disabled={loading || disabled}
          >
            {loading ? 'A entrar…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
