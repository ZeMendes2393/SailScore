'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { isAdminRole } from '@/lib/roles';

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

    if (isOrgAdmin && (user as { organization_slug?: string }).organization_slug) {
      return {
        orgSlug: (user as { organization_slug: string }).organization_slug,
        isOrgAdmin: true,
        isPlatformAdmin: false,
      };
    }
    if (isPlatformAdmin) {
      const fromQs = searchParams?.get('org')?.trim();
      return {
        orgSlug: fromQs || null,
        isOrgAdmin: false,
        isPlatformAdmin: true,
      };
    }
    return { orgSlug: null, isOrgAdmin: false, isPlatformAdmin: false };
  }, [user?.role, (user as { organization_slug?: string })?.organization_slug, searchParams]);
}

/** Appends ?org=slug to path when slug is provided. Handles existing query params. */
export function withOrg(path: string, orgSlug: string | null): string {
  if (!orgSlug) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}org=${encodeURIComponent(orgSlug)}`;
}
