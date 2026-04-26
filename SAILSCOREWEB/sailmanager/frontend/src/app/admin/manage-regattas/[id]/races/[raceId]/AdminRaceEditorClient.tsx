'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import RequireAuth from '@/components/RequireAuth';
import { useAuth } from '@/context/AuthContext';
import { apiGet } from '@/lib/api';
import { useAdminOrg, withOrg } from '@/lib/useAdminOrg';
import RaceResultsManager from '../../results/components/RaceResultsManager';

export default function AdminRaceEditorClient({
  regattaId,
  raceId,
}: {
  regattaId: number;
  raceId: number;
}) {
  const { orgSlug } = useAdminOrg();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { token, user } = useAuth();
  const didSyncOrgQs = useRef(false);
  const manageRegattaBasePath = user?.role === 'scorer' ? '/scorer/manage-regattas' : '/admin/manage-regattas';

  /** Garante ?org= na URL (middleware + ClientLayout) alinhados com a regata — evita header/footer “base” após refresh sem query. */
  useEffect(() => {
    if (!token) return;
    if (didSyncOrgQs.current) return;
    if (searchParams.get('org')?.trim()) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiGet<{ organization_slug?: string | null }>(
          `/regattas/${regattaId}`,
          token ?? undefined
        );
        const slug = data?.organization_slug?.trim();
        if (cancelled || !slug) return;
        didSyncOrgQs.current = true;
        const p = new URLSearchParams(searchParams.toString());
        p.set('org', slug);
        router.replace(`${pathname}?${p.toString()}`);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [regattaId, token, pathname, router, searchParams]);

  return (
    <RequireAuth roles={['admin', 'scorer']}>
      <div className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Edit Race</h2>
          <Link
            href={withOrg(`${manageRegattaBasePath}/${regattaId}/overall`, orgSlug)}
            className="text-sm underline underline-offset-2"
          >
            ← Back
          </Link>
        </div>

        <RaceResultsManager
          regattaId={regattaId}
          newlyCreatedRace={null}
          hideInnerTabs={false}
          initialRaceId={raceId}
        />
      </div>
    </RequireAuth>
  );
}
