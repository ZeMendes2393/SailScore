'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiGet, apiPostJson } from '@/lib/api';

type TokenRes = { access_token: string };

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgSlug = searchParams.get('org')?.trim() || '';
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const body: { email: string; password: string; org?: string } = { email, password };
      if (orgSlug) body.org = orgSlug;

      const { access_token } = await apiPostJson<TokenRes>('/auth/login', body);

      if (typeof window !== 'undefined') {
        localStorage.setItem('token', access_token);
      }

      const me = await apiGet('/auth/me', access_token);
      const r = (me as { role?: string })?.role;
      if (r !== 'admin' && r !== 'platform_admin') {
        throw new Error('This account is not an administrator.');
      }

      login(access_token, me as any);

      const after =
        typeof window !== 'undefined' ? sessionStorage.getItem('postLoginRedirect') : null;
      if (after) {
        sessionStorage.removeItem('postLoginRedirect');
        router.replace(after);
      }
      // Sem postLoginRedirect: AuthContext já redireciona para /admin?org=… quando aplicável
    } catch (err: any) {
      setError(err?.message || 'Sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-md bg-white rounded border p-6">
        <h1 className="text-xl font-semibold mb-4">Sign in — Admin</h1>
        {!orgSlug && (
          <p className="text-sm text-gray-500 mb-3">
            Platform login (global management). For a club admin, use a link with{' '}
            <code className="bg-gray-100 px-1 rounded">?org=club-slug</code>.
          </p>
        )}

        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            className="w-full border rounded px-3 py-2"
            placeholder="Admin email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
            disabled={loading}
          />
          <input
            type="password"
            className="w-full border rounded px-3 py-2"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            disabled={loading}
          />
          <button
            type="submit"
            className="w-full bg-blue-600 text-white rounded py-2 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[40vh] flex items-center justify-center text-gray-500">Loading…</div>}>
      <AdminLoginForm />
    </Suspense>
  );
}
