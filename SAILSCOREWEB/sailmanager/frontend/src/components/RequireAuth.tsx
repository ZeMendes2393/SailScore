'use client';

import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { parseRegattaId } from '@/utils/parseRegattaId';
import { buildSessionExpiredLoginUrl } from '@/lib/sessionExpiryLogin';

export default function RequireAuth({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: string[];
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const qs = useSearchParams();

  // ⚠️ NUNCA converter "" com Number('')
  const qsId = parseRegattaId(qs); // -> number | null
  const orgQs = qs.get('org')?.trim();

  useEffect(() => {
    // não redirecionar enquanto a sessão está a carregar
    if (loading) return;

    // sem sessão → login (se houver regattaId válido, mantém-no no URL)
    if (!user) {
      if ((pathname || '').startsWith('/admin')) {
        router.replace(buildSessionExpiredLoginUrl());
        return;
      }
      // /dashboard sem ?regattaId= é comum para regatista (ID só no token). /login sem regattaId = login admin.
      if (pathname === '/dashboard' || pathname?.startsWith('/dashboard/')) {
        router.replace(qsId ? `/login?regattaId=${qsId}` : '/');
        return;
      }
      const to = qsId ? `/login?regattaId=${qsId}` : '/login';
      router.replace(to);
      return;
    }

    // role não autorizado (admin aceita também platform_admin)
    if (roles) {
      const ok = roles.some((r) => {
        if (user.role === r) return true;
        if (r === 'admin' && user.role === 'platform_admin') return true;
        return false;
      });
      if (!ok) {
        router.replace('/');
        return;
      }
    }
  }, [loading, user, roles, router, qsId, orgQs, pathname]);

  if (loading || !user) {
    return <div className="p-6 text-gray-500">Checking session…</div>;
  }

  return <>{children}</>;
}
