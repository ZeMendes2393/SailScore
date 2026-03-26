/** Admin de organização (website) ou admin global da plataforma. */
export function isAdminRole(role?: string | null): boolean {
  return role === 'admin' || role === 'platform_admin';
}
