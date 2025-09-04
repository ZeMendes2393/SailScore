'use client';

import { ReactNode, useEffect, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

type Props = {
  children: ReactNode;
  roles?: string[];           // ex.: ['admin'] ou ['admin','regatista']
  redirectTo?: string;        // default: '/login'
};

export default function RequireAuth({ children, roles, redirectTo = '/login' }: Props) {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const roleAllowed = useMemo(() => {
    if (!roles || roles.length === 0) return true;
    if (!user?.role) return false;
    return roles.includes(user.role);
  }, [roles, user?.role]);

  useEffect(() => {
    if (loading) return;

    // sem sessão → vai para login e guarda a rota para voltar depois
    if (!token || !user) {
      try { sessionStorage.setItem('postLoginRedirect', pathname); } catch {}
      router.replace(`${redirectTo}?reason=expired`);
      return;
    }

    // sessão ok mas sem permissão → leva para dashboard (ou 403 se tiveres)
    if (!roleAllowed) {
      router.replace('/dashboard');
    }
  }, [loading, token, user, roleAllowed, pathname, redirectTo, router]);

  // enquanto hidrata ou redireciona, não pisca a UI
  if (loading || !token || !user || !roleAllowed) {
    return null; // (ou um spinner)
  }

  return <>{children}</>;
}
