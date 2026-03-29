'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';

/** Org slug for admin context. Org admin: always their org. Platform admin: from ?org= or null. */
export function useAdminOrg(): {
  orgSlug: string | null;
  isOrgAdmin: boolean;
  isPlatformAdmin: boolean;
} {
  const searchParams = useSearchParams();
  const { user } = useAuth();

  return useMemo(() => {
    const isOrgAdmin = user?.role === 'admin';
    const isPlatformAdmin = user?.role === 'platform_admin';
    const orgFromQs = searchParams?.get('org')?.trim() || null;

    if (isOrgAdmin && (user as { organization_slug?: string }).organization_slug) {
      return {
        orgSlug: (user as { organization_slug: string }).organization_slug,
        isOrgAdmin: true,
        isPlatformAdmin: false,
      };
    }
    if (isPlatformAdmin) {
      return {
        orgSlug: orgFromQs || null,
        isOrgAdmin: false,
        isPlatformAdmin: true,
      };
    }
    // Auth still loading or role not yet known: keep ?org= on links so navigation does not drop org
    // (platform_admin was previously only reading org after user loaded, so sidebar hrefs were wrong).
    if (orgFromQs) {
      return {
        orgSlug: orgFromQs,
        isOrgAdmin: false,
        isPlatformAdmin: false,
      };
    }
    return { orgSlug: null, isOrgAdmin: false, isPlatformAdmin: false };
  }, [user?.role, (user as { organization_slug?: string })?.organization_slug, searchParams?.toString()]);
}

/**
 * Slug para pedidos API em /admin quando `useAdminOrg` ou `useSearchParams` ainda não refletem o URL
 * (novo separador, 1.º paint). Usar dentro de useEffect, não para decisões de markup que exijam SSR=idêntico.
 */
export function resolveAdminOrgSlugForApi(
  orgFromHook: string | null,
  searchParams: Pick<URLSearchParams, 'get'> | null
): string | null {
  const fromQs = searchParams?.get('org')?.trim() || null;
  if (orgFromHook) return orgFromHook;
  if (fromQs) return fromQs;
  if (typeof window !== 'undefined') {
    return new URLSearchParams(window.location.search).get('org')?.trim() || null;
  }
  return null;
}

/** Appends ?org=slug to path when slug is provided. Handles existing query params. */
export function withOrg(path: string, orgSlug: string | null): string {
  if (!orgSlug) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}org=${encodeURIComponent(orgSlug)}`;
}
