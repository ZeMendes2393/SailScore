'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import RequireAuth from '@/components/RequireAuth';
import { useAuth } from '@/context/AuthContext';
import { useAdminOrg, withOrg } from '@/lib/useAdminOrg';
import { useRouter } from 'next/navigation';
import AdminOverallResultsClient from '../results/components/AdminOverallResultsClient';

export default function Page() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { orgSlug } = useAdminOrg();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id; // robusto c/ catch de array
  const regattaId = Number(id);

  useEffect(() => {
    if (user?.role !== 'scorer') return;
    const scorerRegattaId = user.current_regatta_id;
    if (!scorerRegattaId) return;
    if (scorerRegattaId !== regattaId) {
      router.replace(withOrg(`/scorer/manage-regattas/${scorerRegattaId}/overall`, orgSlug));
    }
  }, [user?.role, user?.current_regatta_id, regattaId, router, orgSlug]);

  return (
    <RequireAuth roles={['admin', 'scorer']}>
      <AdminOverallResultsClient regattaId={regattaId} />
    </RequireAuth>
  );
}
