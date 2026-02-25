'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiGet, apiPostJson } from '@/lib/api';
import { parseRegattaId } from '@/utils/parseRegattaId';

type TokenRes = { access_token: string };

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

    if (user.role === 'admin') {
      router.replace('/admin');
    } else if (user.role === 'regatista') {
      const rid = user.current_regatta_id ?? qsId ?? undefined;
      router.replace(rid ? `/dashboard?regattaId=${rid}` : '/dashboard');
    }
  }, [user, router, qsId]);

  const title = useMemo(
    () =>
      mode === 'sailor'
        ? `Entrar — Regata #${qsId ?? '—'}`
        : 'Entrar — Admin',
    [mode, qsId]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // corpo do login: inclui regatta_id apenas no modo sailor
      const body: any = { email, password };
      if (mode === 'sailor') {
        if (!qsId) throw new Error('Regata inválida no URL.');
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
      if ((me as any).role === 'admin') {
        router.replace('/admin');
      } else {
        const rid =
          (me as any).current_regatta_id ??
          qsId ??
          process.env.NEXT_PUBLIC_CURRENT_REGATTA_ID ??
          '';
        router.replace(rid ? `/dashboard?regattaId=${rid}` : '/dashboard');
      }
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
          <div className="mb-3 text-sm text-red-600">Regata inválida no URL.</div>
        )}

        {user && (
          <div className="mb-4 flex items-center justify-between gap-3 text-sm">
            <span className="text-gray-600">
              Sessão atual:{' '}
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
              Entrar com outra conta
            </button>
          </div>
        )}

        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type={mode === 'admin' ? 'email' : 'text'}
            className="w-full border rounded px-3 py-2"
            placeholder={
              mode === 'admin'
                ? 'Email do admin'
                : 'Sailor username (ex.: JoseMendes115)'
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
            placeholder="Palavra-passe"
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
            {loading ? 'A entrar…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
