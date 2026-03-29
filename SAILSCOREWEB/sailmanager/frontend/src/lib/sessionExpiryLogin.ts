/**
 * URLs de login após expirar sessão (JWT ou 401).
 * Preserva ?org= para admins (especialmente platform_admin) não caírem no login global sem org.
 */

const ADMIN_ORG_STORAGE_KEY = 'adminOrgSlug';

/** Grava org atual quando o admin navega com ?org= (chamar de um efeito no cliente). */
export function persistAdminOrgFromUrl(pathname: string, search: string): void {
  if (typeof window === 'undefined') return;
  if (!pathname.startsWith('/admin')) return;
  const org = new URLSearchParams(search).get('org')?.trim();
  if (org) {
    try {
      sessionStorage.setItem(ADMIN_ORG_STORAGE_KEY, org);
    } catch {
      /* ignore */
    }
  }
}

/** Admin de organização: grava slug para o login pós-expiração (nem sempre há ?org= na URL). */
export function persistAdminOrgFromUser(organizationSlug: string | null | undefined): void {
  if (typeof window === 'undefined') return;
  const s = organizationSlug?.trim();
  if (!s) return;
  try {
    sessionStorage.setItem(ADMIN_ORG_STORAGE_KEY, s);
  } catch {
    /* ignore */
  }
}

/**
 * Resolve slug da org a partir da URL atual.
 * - ?org=slug
 * - /o/[slug]/... (site por organização)
 */
export function getOrgSlugFromCurrentLocation(): string | null {
  if (typeof window === 'undefined') return null;
  const fromQs = new URLSearchParams(window.location.search).get('org')?.trim();
  if (fromQs) return fromQs;
  const m = window.location.pathname.match(/^\/o\/([^/]+)/);
  return m?.[1]?.trim() || null;
}

function getStoredAdminOrgSlug(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(ADMIN_ORG_STORAGE_KEY)?.trim() || null;
  } catch {
    return null;
  }
}

/** Após sign-out (especialmente regatista) para não reutilizar org de sessão admin anterior. */
export function clearStoredAdminOrgSlug(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(ADMIN_ORG_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * URL para onde redirecionar quando a sessão expira (client-side).
 */
export function buildSessionExpiredLoginUrl(): string {
  if (typeof window === 'undefined') return '/login?reason=expired';

  const pathname = window.location.pathname;
  const params = new URLSearchParams(window.location.search);
  const reason = 'reason=expired';

  let org = getOrgSlugFromCurrentLocation();
  if (!org && pathname.startsWith('/admin')) {
    org = getStoredAdminOrgSlug();
  }

  if (pathname.startsWith('/admin')) {
    let url = `/admin/login?${reason}`;
    if (org) url += `&org=${encodeURIComponent(org)}`;
    return url;
  }

  // Regatista: /dashboard muitas vezes sem ?regattaId= (ID no token). /login sem regattaId = modo admin.
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
    const regattaId = params.get('regattaId');
    if (regattaId) {
      return `/login?${reason}&regattaId=${encodeURIComponent(regattaId)}`;
    }
    return `/?${reason}`;
  }

  let url = `/login?${reason}`;
  const regattaId = params.get('regattaId');
  if (regattaId) url += `&regattaId=${encodeURIComponent(regattaId)}`;
  return url;
}
