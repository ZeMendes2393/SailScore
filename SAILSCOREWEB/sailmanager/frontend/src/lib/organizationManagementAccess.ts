import { isSuperAdminOrganizationManager } from '@/lib/superAdmin';

/**
 * Quem pode abrir a página de criação/gestão de organizações (alinhado com admin/organizations).
 */
export function canAccessOrganizationManagement(
  user: { role?: string; email?: string } | null | undefined,
  isPlatformAdmin: boolean,
  orgSlug: string | null
): boolean {
  if (!user) return false;
  const isGlobalPlatformAdmin = isPlatformAdmin && !orgSlug;
  const isProvisionalExampleOrgAdmin = user.role === 'admin' && orgSlug === 'example-sailing-club';
  const isDedicatedSuperOrgAdmin = isSuperAdminOrganizationManager(user.email);
  return isGlobalPlatformAdmin || isProvisionalExampleOrgAdmin || isDedicatedSuperOrgAdmin;
}

/** Mesma regra que o item "Organizations" na sidebar (URL sem ?org= para super-admins). */
export function hrefOrganizationsPage(
  user: { email?: string } | null | undefined,
  isPlatformAdmin: boolean,
  orgSlug: string | null,
  withOrg: (path: string, slug: string | null) => string
): string {
  if (isSuperAdminOrganizationManager(user?.email)) {
    return '/admin/organizations';
  }
  if (isPlatformAdmin && !orgSlug) {
    return '/admin/organizations';
  }
  return withOrg('/admin/organizations', orgSlug);
}
