// src/context/AuthContext.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isTokenExpired } from '@/lib/api';
import { isAdminRole } from '@/lib/roles';
import {
  buildSessionExpiredLoginUrl,
  clearStoredAdminOrgSlug,
  clearStoredSailorOrgSlug,
  persistAdminOrgFromUrl,
  persistAdminOrgFromUser,
  persistSailorOrgFromUrl,
  persistSailorOrgFromUser,
} from '@/lib/sessionExpiryLogin';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
const AUTH_LOGOUT_BROADCAST_KEY = 'auth:logoutAt';

type BaseUser = {
  email: string;
  role: 'admin' | 'regatista' | string;
  name?: string | null;
  current_regatta_id?: number | null;
  id?: number | null;
  organization_id?: number | null;
  organization_slug?: string | null;
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
  const pathname = usePathname();

  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const clearLocalSessionState = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    clearStoredAdminOrgSlug();
    clearStoredSailorOrgSlug();
    try {
      localStorage.removeItem('access_token');
      localStorage.removeItem('token');
    } catch {
      /* ignore */
    }
    setToken(null);
    setUser(null);
  };

  const refreshMe = async (tok: string) => {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${tok}` },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Invalid session');
    const me = (await res.json()) as User;
    setUser(me);
    sessionStorage.setItem('user', JSON.stringify(me));
    return me;
  };

  // Lembrar org no admin: ?org= na URL ou slug do admin de organização
  useEffect(() => {
    if (!user || !token || typeof window === 'undefined') return;
    const search = window.location.search;
    persistAdminOrgFromUrl(pathname || '', search);
    persistSailorOrgFromUrl(pathname || '', search);
    if (user.role === 'admin' && (user as { organization_slug?: string }).organization_slug) {
      persistAdminOrgFromUser((user as { organization_slug: string }).organization_slug);
    }
    if (
      (user.role === 'regatista' || user.role === 'jury' || user.role === 'scorer') &&
      (user as BaseUser).organization_slug
    ) {
      persistSailorOrgFromUser((user as BaseUser).organization_slug);
    }
  }, [user, token, pathname]);

  // Verificação periódica: se o token expirou, redireciona logo para login
  // (evita estar a score e só no save descobrir que perdeu a auth)
  useEffect(() => {
    if (!user || !token) return;

    const interval = setInterval(() => {
      const t = sessionStorage.getItem('token');
      if (t && isTokenExpired(t)) {
        let roleHint: string | null = null;
        try {
          const raw = sessionStorage.getItem('user');
          if (raw) {
            const parsed = JSON.parse(raw) as BaseUser;
            roleHint = parsed?.role || null;
            const slug = parsed?.organization_slug?.trim();
            if (slug && (parsed.role === 'regatista' || parsed.role === 'jury' || parsed.role === 'scorer')) {
              persistSailorOrgFromUser(slug);
            }
          }
        } catch {
          /* ignore */
        }
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        setToken(null);
        setUser(null);
        const path = typeof window !== 'undefined' ? window.location.pathname : '';
        const after = path + (typeof window !== 'undefined' ? window.location.search : '');
        sessionStorage.setItem('postLoginRedirect', after);
        router.replace(buildSessionExpiredLoginUrl(roleHint));
      }
    }, 60_000); // cada 60 segundos

    return () => clearInterval(interval);
  }, [user, token, router]);

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

  // Cross-tab logout sync: signing out in one tab must invalidate all open tabs.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== AUTH_LOGOUT_BROADCAST_KEY || !event.newValue) return;
      clearLocalSessionState();
      const path = typeof window !== 'undefined' ? window.location.pathname : '';
      const qs = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const org = qs?.get('org')?.trim();
      const isAdminArea = path.startsWith('/admin');
      const isDashboardArea = path.startsWith('/dashboard') || path.startsWith('/scorer');
      if (isAdminArea || isDashboardArea) {
        if (isAdminArea) {
          window.location.assign(org ? `/admin/login?org=${encodeURIComponent(org)}` : '/admin/login');
        } else {
          window.location.assign(org ? `/login?org=${encodeURIComponent(org)}` : '/login');
        }
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const login = (tok: string, usr: User) => {
    sessionStorage.setItem('token', tok);
    sessionStorage.setItem('user', JSON.stringify(usr));
    // Manter localStorage alinhado com api.ts / login admin (evita JWT velho a “ganhar” nos headers)
    try {
      localStorage.setItem('access_token', tok);
      localStorage.setItem('token', tok);
    } catch {
      /* ignore */
    }
    setToken(tok);
    setUser(usr);
    setLoading(false);

    // Redirect pós-login
    const params = new URLSearchParams(window.location.search);
    const regattaId = params.get('regattaId');
    if (isAdminRole(usr.role)) {
      const orgFromLoginUrl = params.get('org')?.trim();
      const orgFromUser = (usr as BaseUser).organization_slug?.trim();
      const slug = orgFromLoginUrl || orgFromUser || null;
      router.replace(slug ? `/admin?org=${encodeURIComponent(slug)}` : '/admin');
    } else if (usr.role === 'scorer') {
      const org = params.get('org')?.trim();
      const scorerRegattaId = (usr as BaseUser).current_regatta_id;
      if (scorerRegattaId) {
        const p = new URLSearchParams();
        if (org) p.set('org', org);
        const qs = p.toString();
        router.replace(`/scorer/manage-regattas/${scorerRegattaId}${qs ? `?${qs}` : ''}`);
      } else {
        router.replace(org ? `/dashboard/scorer?org=${encodeURIComponent(org)}` : '/dashboard/scorer');
      }
    } else {
      const org = params.get('org')?.trim();
      if (regattaId) {
        const p = new URLSearchParams({ regattaId });
        if (org) p.set('org', org);
        router.replace(`/dashboard?${p.toString()}`);
      } else {
        router.replace(org ? `/dashboard?org=${encodeURIComponent(org)}` : '/dashboard');
      }
    }
  };

  const logout = (opts?: { redirectTo?: string }) => {
    clearLocalSessionState();
    try {
      // Broadcast logout so other tabs clear session immediately.
      localStorage.setItem(AUTH_LOGOUT_BROADCAST_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }

    // Navegação completa evita corrida com RequireAuth no /dashboard sem ?regattaId=
    // (regatista usa current_regatta_id na URL nem sempre) → antes ia para /login = modo admin.
    const to =
      opts?.redirectTo ??
      (() => {
        const match = window.location.pathname.match(/^\/regattas\/(\d+)/);
        return match ? `/regattas/${match[1]}` : '/';
      })();
    window.location.assign(to);
  };

  const switchRegatta = async (regattaId: number) => {
    const t = sessionStorage.getItem('token') || '';
    if (!t) throw new Error('No session');

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
