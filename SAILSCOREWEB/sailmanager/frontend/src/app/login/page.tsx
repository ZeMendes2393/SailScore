'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiGet, apiPostJson } from '@/lib/api';
import { parseRegattaId } from '@/utils/parseRegattaId';
import { isAdminRole } from '@/lib/roles';
import { getStoredSailorOrgSlugForLogin } from '@/lib/sessionExpiryLogin';

type TokenRes = { access_token: string };

type RegattaLite = { id: number; name: string; organization_slug?: string | null };

function dashboardUrlWithOrg(regattaId: number | string, org: string | null | undefined): string {
  const p = new URLSearchParams({ regattaId: String(regattaId) });
  const o = org?.trim();
  if (o) p.set('org', o);
  return `/dashboard?${p.toString()}`;
}

export default function LoginPage() {
  const router = useRouter();
  const qs = useSearchParams();
  const { user, login, logout } = useAuth();

  // se houver ?regattaId= => modo "sailor"; caso contrário => "admin"
  const qsId = parseRegattaId(qs); // number | null
  const orgFromQs = qs.get('org')?.trim() || null;
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
        router.replace(
          rid ? dashboardUrlWithOrg(rid, orgFromQs) : orgFromQs ? `/dashboard?org=${encodeURIComponent(orgFromQs)}` : '/dashboard'
        );
      } else if (user.role === 'scorer') {
        const scorerRegattaId = user.current_regatta_id ?? undefined;
        if (scorerRegattaId) {
          router.replace(
            orgFromQs
              ? `/scorer/manage-regattas/${scorerRegattaId}?org=${encodeURIComponent(orgFromQs)}`
              : `/scorer/manage-regattas/${scorerRegattaId}`
          );
        } else {
          router.replace(orgFromQs ? `/dashboard/scorer?org=${encodeURIComponent(orgFromQs)}` : '/dashboard/scorer');
        }
      }
      return;
    }

    // Modo sailor:
    // - Se já é regatista, pode ser redirecionado logo para o dashboard da regata.
    // - Se a sessão atual é de admin, NÃO fazemos redirect automático,
    //   para permitir que o utilizador troque para a Sailor Account.
    if (mode === 'sailor' && (user.role === 'regatista' || user.role === 'jury')) {
      const rid = user.current_regatta_id ?? qsId ?? undefined;
      router.replace(
        rid ? dashboardUrlWithOrg(rid, orgFromQs) : orgFromQs ? `/dashboard?org=${encodeURIComponent(orgFromQs)}` : '/dashboard'
      );
    } else if (mode === 'sailor' && user.role === 'scorer') {
      const scorerRegattaId = user.current_regatta_id ?? qsId ?? undefined;
      if (scorerRegattaId) {
        router.replace(
          orgFromQs
            ? `/scorer/manage-regattas/${scorerRegattaId}?org=${encodeURIComponent(orgFromQs)}`
            : `/scorer/manage-regattas/${scorerRegattaId}`
        );
      } else {
        router.replace(orgFromQs ? `/dashboard/scorer?org=${encodeURIComponent(orgFromQs)}` : '/dashboard/scorer');
      }
    }
  }, [user, router, qsId, mode, orgFromQs]);

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

  /** Expiração em scorer/sailor sem ?org=: recoloca org para manter branding de header/footer. */
  useEffect(() => {
    if (orgFromQs) return;
    const reason = qs.get('reason')?.trim();
    const after = typeof window !== 'undefined' ? sessionStorage.getItem('postLoginRedirect') || '' : '';
    const isSailorExpiredFlow =
      Boolean(qsId) ||
      (reason === 'expired' &&
        (after.startsWith('/dashboard') || after.startsWith('/scorer')));
    if (!isSailorExpiredFlow) return;
    const storedOrg = getStoredSailorOrgSlugForLogin();
    if (!storedOrg) return;
    const p = new URLSearchParams(qs.toString());
    p.set('org', storedOrg);
    router.replace(`/login?${p.toString()}`);
  }, [orgFromQs, qs, qsId, router]);

  /** Sem ?org= na URL: obtém slug da regata e faz replace (refresh mantém branding via ?org=). */
  useEffect(() => {
    if (mode !== 'sailor' || !qsId || orgFromQs) return;
    let cancelled = false;
    apiGet<RegattaLite>(`/regattas/${qsId}`)
      .then((r) => {
        const slug = r?.organization_slug?.trim();
        if (cancelled || !slug) return;
        const p = new URLSearchParams(qs.toString());
        p.set('org', slug);
        router.replace(`/login?${p.toString()}`);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [mode, qsId, orgFromQs, qs, router]);

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
      if (orgFromQs) body.org = orgFromQs;
      if (mode === 'sailor') {
        if (!qsId) throw new Error('Invalid regatta in URL.');
        body.regatta_id = qsId;
      }

      const { access_token } = await apiPostJson<TokenRes>('/auth/login', body);

      // perfil
      const me = await apiGet('/auth/me', access_token);

      // guarda sessão e redireciona (AuthContext.login; pós-login: postLoginRedirect tem prioridade)
      login(access_token, me as any);

      const after = sessionStorage.getItem('postLoginRedirect');
      if (after) {
        router.replace(after);
        sessionStorage.removeItem('postLoginRedirect');
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
  const relogUrl = useMemo(() => {
    if (mode === 'sailor' && qsId) {
      const p = new URLSearchParams({ regattaId: String(qsId), force: '1' });
      if (orgFromQs) p.set('org', orgFromQs);
      return `/login?${p.toString()}`;
    }
    return '/login?force=1';
  }, [mode, qsId, orgFromQs]);

  return (
    <div className="min-h-[72vh] flex items-center justify-center px-4 py-10 bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-7 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 mb-1">{title}</h1>
        <p className="text-sm text-slate-500 mb-6">
          Enter your credentials to continue.
        </p>

        {/* Só mostra erro de regata quando realmente estamos em modo sailor sem regattaId */}
        {mode === 'sailor' && !qsId && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Invalid regatta in URL.
          </div>
        )}

        {user && (
          <div className="mb-5 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <span className="text-slate-600">
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
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-white transition-colors"
            >
              Sign in with another account
            </button>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-lg font-medium text-slate-700">
              {mode === 'admin' ? 'Email or username' : 'Sailor/Staff username'}
            </span>
            <input
              type="text"
              className="login-input w-full border border-slate-300 rounded-lg px-3 py-2.5 text-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
              placeholder={
                mode === 'admin'
                  ? 'Email or username'
                  : 'e.g. AlexSailor22'
              }
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              disabled={loading || (mode === 'sailor' && !qsId)}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-lg font-medium text-slate-700">Password</span>
            <input
              type="password"
              className="login-input w-full border border-slate-300 rounded-lg px-3 py-2.5 text-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={loading || (mode === 'sailor' && !qsId)}
            />
          </label>
          <button
            type="submit"
            className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
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
