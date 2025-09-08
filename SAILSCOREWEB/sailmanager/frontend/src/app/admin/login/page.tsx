'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiGet, apiPostJson } from '@/lib/api';

type TokenRes = { access_token: string };

export default function AdminLoginPage() {
  const router = useRouter();
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
      // ⚠️ sem regatta_id (modo ADMIN)
      const { access_token } = await apiPostJson<TokenRes>('/auth/login', {
        email,
        password,
      });

      const me = await apiGet('/auth/me', access_token);
      if ((me as any)?.role !== 'admin') {
        throw new Error('Esta conta não é admin.');
      }

      login(access_token, me as any);

      // respeita redirect pendente (guardado pelo api.ts quando apanha 401)
      const after = sessionStorage.getItem('postLoginRedirect');
      if (after) {
        sessionStorage.removeItem('postLoginRedirect');
        router.replace(after);
      } else {
        router.replace('/admin');
      }
    } catch (err: any) {
      setError(err?.message || 'Falha ao iniciar sessão.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-md bg-white rounded border p-6">
        <h1 className="text-xl font-semibold mb-4">Entrar — Admin</h1>

        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            className="w-full border rounded px-3 py-2"
            placeholder="Email do admin"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
            disabled={loading}
          />
          <input
            type="password"
            className="w-full border rounded px-3 py-2"
            placeholder="Palavra-passe"
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
            {loading ? 'A entrar…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
