// src/context/AuthContext.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE = 'http://localhost:8000';

type BaseUser = {
  email: string;
  role: 'admin' | 'regatista' | string;
  name?: string | null;
  current_regatta_id?: number | null;
  id?: number | null;
};
type SailorUser = BaseUser & { role: 'regatista'; id: number };
export type User = SailorUser | BaseUser;

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: (opts?: { redirectTo?: string }) => void;
  setUser: (user: User | null) => void;
  switchRegatta: (regattaId: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = async (tok: string) => {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${tok}` },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Sessão inválida');
    const me = (await res.json()) as User;
    setUser(me);
    sessionStorage.setItem('user', JSON.stringify(me));
    return me;
  };

  useEffect(() => {
    const storedToken = sessionStorage.getItem('token');
    const storedUser = sessionStorage.getItem('user');
    (async () => {
      try {
        if (!storedToken) {
          setLoading(false);
          return;
        }
        setToken(storedToken);
        if (storedUser) {
          try {
            setUser(JSON.parse(storedUser));
            setLoading(false);
            return;
          } catch {}
        }
        await refreshMe(storedToken);
      } catch {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = (tok: string, usr: User) => {
    sessionStorage.setItem('token', tok);
    sessionStorage.setItem('user', JSON.stringify(usr));
    setToken(tok);
    setUser(usr);
    setLoading(false);

    // Redirect pós-login
    const params = new URLSearchParams(window.location.search);
    const regattaId = params.get('regattaId');
    if (usr.role === 'admin') {
      router.replace('/admin');
    } else {
      if (regattaId) router.replace(`/dashboard?regattaId=${regattaId}`);
      else router.replace('/dashboard');
    }
  };

  const logout = (opts?: { redirectTo?: string }) => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    setToken(null);
    setUser(null);

    // Para onde redirecionar:
    if (opts?.redirectTo) {
      router.replace(opts.redirectTo);
      return;
    }
    // Se estás numa rota /regattas/:id, volta à página dessa regata
    const match = window.location.pathname.match(/^\/regattas\/(\d+)/);
    const to = match ? `/regattas/${match[1]}` : '/';
    router.replace(to);
  };

  const switchRegatta = async (regattaId: number) => {
    const t = sessionStorage.getItem('token') || '';
    if (!t) throw new Error('Sem sessão');

    const res = await fetch(`${API_BASE}/auth/switch-regatta?regatta_id=${regattaId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
    });
    if (!res.ok) throw new Error(await res.text());
    const { access_token } = (await res.json()) as { access_token: string };

    sessionStorage.setItem('token', access_token);
    setToken(access_token);
    await refreshMe(access_token);
  };

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, logout, setUser, switchRegatta }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};

export { AuthContext };
