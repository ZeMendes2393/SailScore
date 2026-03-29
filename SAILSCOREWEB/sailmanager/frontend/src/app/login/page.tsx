'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiGet, apiPostJson } from '@/lib/api';
import { parseRegattaId } from '@/utils/parseRegattaId';
import { isAdminRole } from '@/lib/roles';

type TokenRes = { access_token: string };

type RegattaLite = { id: number; name: string };

export default function LoginPage() {
  const router = useRouter();
  const qs = useSearchParams();
  const { user, login, logout } = useAuth();

  // se houver ?regattaId= => modo "sailor"; caso contrário => "admin"
  const qsId = parseRegattaId(qs); // number | null
  const mode: 'admin' | 'sailor' = qsId ? 'sailor' : 'admin';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [regattaName, setRegattaName] = useState<string>('');
  const [regattaNameLoading, setRegattaNameLoading] = useState(false);

  // Já autenticado? Faz redireciono gentil.
  useEffect(() => {
    if (!user) return;

    // Se existe um redirect pendente (guardado pelo api.ts quando apanha 401)
    const after = sessionStorage.getItem('postLoginRedirect');
    if (after) {
      router.replace(after);
      sessionStorage.removeItem('postLoginRedirect');
      return;
    }

    // Se estamos em modo admin e já há sessão, reaproveita.
    if (mode === 'admin') {
      if (isAdminRole(user.role)) {
        const slug = (user as { organization_slug?: string | null }).organization_slug?.trim();
        router.replace(slug ? `/admin?org=${encodeURIComponent(slug)}` : '/admin');
      } else if (user.role === 'regatista' || user.role === 'jury') {
        const rid = user.current_regatta_id ?? undefined;
        router.replace(rid ? `/dashboard?regattaId=${rid}` : '/dashboard');
      }
      return;
    }

    // Modo sailor:
    // - Se já é regatista, pode ser redirecionado logo para o dashboard da regata.
    // - Se a sessão atual é de admin, NÃO fazemos redirect automático,
    //   para permitir que o utilizador troque para a Sailor Account.
    if (mode === 'sailor' && (user.role === 'regatista' || user.role === 'jury')) {
      const rid = user.current_regatta_id ?? qsId ?? undefined;
      router.replace(rid ? `/dashboard?regattaId=${rid}` : '/dashboard');
    }
  }, [user, router, qsId, mode]);

  useEffect(() => {
    const fetchRegattaName = async () => {
      if (mode !== 'sailor' || !qsId) return;
      setRegattaNameLoading(true);
      try {
        const r = await apiGet<RegattaLite>(`/regattas/${qsId}`).catch(() => null);
        setRegattaName(r?.name ?? '');
      } catch {
        setRegattaName('');
      } finally {
        setRegattaNameLoading(false);
      }
    };

    fetchRegattaName();
  }, [mode, qsId]);

  const title = useMemo(
    () =>
      mode === 'sailor'
        ? regattaName
          ? `Sign in — ${regattaName}`
          : regattaNameLoading
            ? 'Sign in — Regatta'
            : `Sign in — Regatta #${qsId ?? '—'}`
        : 'Sign in — Admin',
    [mode, qsId, regattaName]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // corpo do login: inclui regatta_id apenas no modo sailor
      const body: any = { email, password };
      if (mode === 'sailor') {
        if (!qsId) throw new Error('Invalid regatta in URL.');
        body.regatta_id = qsId;
      }

      const { access_token } = await apiPostJson<TokenRes>('/auth/login', body);

      // perfil
      const me = await apiGet('/auth/me', access_token);

      // guarda sessão
      login(access_token, me as any);

      // redireciono pós-login
      const after = sessionStorage.getItem('postLoginRedirect');
      if (after) {
        router.replace(after);
        sessionStorage.removeItem('postLoginRedirect');
        return;
      }
      if (isAdminRole((me as any).role)) {
        const orgQs = qs.get('org')?.trim();
        const orgUser = (me as { organization_slug?: string | null }).organization_slug?.trim();
        const slug = orgQs || orgUser || null;
        router.replace(slug ? `/admin?org=${encodeURIComponent(slug)}` : '/admin');
      } else {
        const rid =
          (me as any).current_regatta_id ??
          qsId ??
          process.env.NEXT_PUBLIC_CURRENT_REGATTA_ID ??
          '';
        router.replace(rid ? `/dashboard?regattaId=${rid}` : '/dashboard');
      }
    } catch (err: any) {
      let msg = String(err?.message || 'Failed to sign in.');
      try {
        const j = JSON.parse(msg);
        if (j?.detail?.requires_regatta_selection) {
          msg =
            'This account has entries in multiple regattas. Please sign in from the desired regatta page.';
        } else if (j?.detail) {
          msg = j.detail;
        }
      } catch {}
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // barra de “trocar de conta” apenas se já há sessão
  const relogUrl =
    mode === 'sailor' && qsId
      ? `/login?regattaId=${qsId}&force=1`
      : '/login?force=1';

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-md bg-white rounded border p-6">
        <h1 className="text-xl font-semibold mb-4">{title}</h1>

        {/* Só mostra erro de regata quando realmente estamos em modo sailor sem regattaId */}
        {mode === 'sailor' && !qsId && (
          <div className="mb-3 text-sm text-red-600">Invalid regatta in URL.</div>
        )}

        {user && (
          <div className="mb-4 flex items-center justify-between gap-3 text-sm">
            <span className="text-gray-600">
              Current session:{' '}
              <b>
                {user.role === 'regatista' && (user as any).username
                  ? (user as any).username
                  : user.email}
              </b>{' '}
              ({user.role})
            </span>
            <button
              onClick={() => logout({ redirectTo: relogUrl })}
              className="px-3 py-1 rounded border hover:bg-gray-50"
            >
              Sign in with another account
            </button>
          </div>
        )}

        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            className="w-full border rounded px-3 py-2"
            placeholder={
              mode === 'admin'
                ? 'Email or username'
                : 'Sailor username (e.g. JoseMendes115)'
            }
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
            disabled={loading || (mode === 'sailor' && !qsId)}
          />
          <input
            type="password"
            className="w-full border rounded px-3 py-2"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            disabled={loading || (mode === 'sailor' && !qsId)}
          />
          <button
            type="submit"
            className="w-full bg-blue-600 text-white rounded py-2 disabled:opacity-50"
            disabled={
              loading || (mode === 'sailor' && !qsId) || email.trim() === '' || password.trim() === ''
            }
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
