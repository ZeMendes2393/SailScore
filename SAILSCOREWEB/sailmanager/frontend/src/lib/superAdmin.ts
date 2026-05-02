/**
 * Platform admins listed here can open Organization management even when the admin URL
 * includes ?org=... (otherwise the sidebar hides it until "global" admin with no org).
 */
const SUPER_ADMIN_ORG_MANAGER_EMAILS = new Set(['jose.mendes2691@gmail.com']);

export function isSuperAdminOrganizationManager(email: string | null | undefined): boolean {
  const e = (email || '').trim().toLowerCase();
  return e !== '' && SUPER_ADMIN_ORG_MANAGER_EMAILS.has(e);
}
