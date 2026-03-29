'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { isAdminRole } from '@/lib/roles';

/**
 * Regatista/júri: só a regata do token (current_regatta_id), ignorando ?regattaId= na URL.
 * Admin: ?regattaId= ou NEXT_PUBLIC_CURRENT_REGATTA_ID (fluxos de gestão).
 */
export function useDashboardRegattaId(): number | null {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const fromQS = Number(searchParams.get('regattaId') || '');

  return useMemo(() => {
    if (user?.role === 'jury' || user?.role === 'regatista') {
      const rid = user?.current_regatta_id;
      return typeof rid === 'number' && rid > 0 ? rid : null;
    }
    if (isAdminRole(user?.role)) {
      if (Number.isFinite(fromQS) && fromQS > 0) return fromQS;
      const envId = Number(process.env.NEXT_PUBLIC_CURRENT_REGATTA_ID || '');
      return Number.isFinite(envId) && envId > 0 ? envId : null;
    }
    return null;
  }, [user?.role, user?.current_regatta_id, fromQS]);
}
