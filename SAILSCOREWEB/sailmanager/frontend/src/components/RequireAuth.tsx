'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { parseRegattaId } from '@/utils/parseRegattaId';

export default function RequireAuth({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: string[];
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const qs = useSearchParams();

  // ⚠️ NUNCA converter "" com Number('')
  const qsId = parseRegattaId(qs); // -> number | null

  useEffect(() => {
    // não redirecionar enquanto a sessão está a carregar
    if (loading) return;

    // sem sessão → login (se houver regattaId válido, mantém-no no URL)
    if (!user) {
      const to = qsId ? `/login?regattaId=${qsId}` : '/login';
      router.replace(to);
      return;
    }

    // role não autorizado
    if (roles && !roles.includes(user.role)) {
      router.replace('/'); // (ou '/admin')
      return;
    }
  }, [loading, user, roles, router, qsId]);

  if (loading || !user) {
    return <div className="p-6 text-gray-500">A verificar sessão…</div>;
  }

  return <>{children}</>;
}
