/**
 * URLs de login após expirar sessão (JWT ou 401).
 * Preserva ?org= para admins (especialmente platform_admin) não caírem no login global sem org.
 */

const ADMIN_ORG_STORAGE_KEY = 'adminOrgSlug';
const SAILOR_ORG_STORAGE_KEY = 'sailorOrgSlug';

function setOrgStorage(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function getOrgStorage(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const fromSession = sessionStorage.getItem(key)?.trim();
    if (fromSession) return fromSession;
  } catch {
    /* ignore */
  }
  try {
    return localStorage.getItem(key)?.trim() || null;
  } catch {
    return null;
  }
}

function clearOrgStorage(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Grava org atual quando o admin navega com ?org= (chamar de um efeito no cliente). */
export function persistAdminOrgFromUrl(pathname: string, search: string): void {
  if (typeof window === 'undefined') return;
  if (!pathname.startsWith('/admin')) return;
  const org = new URLSearchParams(search).get('org')?.trim();
  if (org) {
    setOrgStorage(ADMIN_ORG_STORAGE_KEY, org);
  }
}

/** Admin de organização: grava slug para o login pós-expiração (nem sempre há ?org= na URL). */
export function persistAdminOrgFromUser(organizationSlug: string | null | undefined): void {
  if (typeof window === 'undefined') return;
  const s = organizationSlug?.trim();
  if (!s) return;
  setOrgStorage(ADMIN_ORG_STORAGE_KEY, s);
}

/** Grava org quando o regatista navega em /dashboard com ?org= */
export function persistSailorOrgFromUrl(pathname: string, search: string): void {
  if (typeof window === 'undefined') return;
  if (!pathname.startsWith('/dashboard') && !pathname.startsWith('/scorer')) return;
  const org = new URLSearchParams(search).get('org')?.trim();
  if (org) {
    setOrgStorage(SAILOR_ORG_STORAGE_KEY, org);
  }
}

/** Regatista / jury: grava slug para login pós-expiração (URL pode ainda não ter ?org=). */
export function persistSailorOrgFromUser(organizationSlug: string | null | undefined): void {
  if (typeof window === 'undefined') return;
  const s = organizationSlug?.trim();
  if (!s) return;
  setOrgStorage(SAILOR_ORG_STORAGE_KEY, s);
}

function getStoredSailorOrgSlug(): string | null {
  return getOrgStorage(SAILOR_ORG_STORAGE_KEY);
}

/** Fallback para página de login quando fluxo sailor/scorer perde ?org=. */
export function getStoredSailorOrgSlugForLogin(): string | null {
  return getStoredSailorOrgSlug();
}

/** Após logout do regatista para não misturar com próxima sessão. */
export function clearStoredSailorOrgSlug(): void {
  clearOrgStorage(SAILOR_ORG_STORAGE_KEY);
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
  return getOrgStorage(ADMIN_ORG_STORAGE_KEY);
}

/** Após sign-out (especialmente regatista) para não reutilizar org de sessão admin anterior. */
export function clearStoredAdminOrgSlug(): void {
  clearOrgStorage(ADMIN_ORG_STORAGE_KEY);
}

/**
 * URL para onde redirecionar quando a sessão expira (client-side).
 */
export function buildSessionExpiredLoginUrl(roleHint?: string | null): string {
  if (typeof window === 'undefined') return '/login?reason=expired';

  const pathname = window.location.pathname;
  const params = new URLSearchParams(window.location.search);
  const reason = 'reason=expired';
  const normalizedRole = (roleHint || '').trim().toLowerCase();
  const forceSailorLogin =
    normalizedRole === 'regatista' ||
    normalizedRole === 'jury' ||
    normalizedRole === 'scorer';

  let org = getOrgSlugFromCurrentLocation();
  if (!org && pathname.startsWith('/admin')) {
    org = getStoredAdminOrgSlug();
  }

  if (pathname.startsWith('/admin') && !forceSailorLogin) {
    let url = `/admin/login?${reason}`;
    if (org) url += `&org=${encodeURIComponent(org)}`;
    return url;
  }

  // Sessão expirada de conta sailor/staff em URL /admin/... (ex: scorer em rota antiga):
  // forçar login sailor/scorer para não cair no admin login.
  if (forceSailorLogin) {
    const regattaFromPath =
      pathname.match(/\/manage-regattas\/(\d+)/)?.[1] || params.get('regattaId');
    const sailorOrg =
      params.get('org')?.trim() ||
      getStoredSailorOrgSlug() ||
      getStoredAdminOrgSlug() ||
      getOrgSlugFromCurrentLocation();
    const p = new URLSearchParams({ reason: 'expired' });
    if (regattaFromPath) p.set('regattaId', regattaFromPath);
    if (sailorOrg) p.set('org', sailorOrg);
    return `/login?${p.toString()}`;
  }

  // Regatista: /dashboard muitas vezes sem ?regattaId= (ID no token). Preservar org (URL ou última org guardada).
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
    const regattaId = params.get('regattaId');
    const orgFromQs = params.get('org')?.trim();
    const sailorOrg =
      orgFromQs || getStoredSailorOrgSlug() || getOrgSlugFromCurrentLocation();
    if (regattaId) {
      const p = new URLSearchParams({ reason: 'expired', regattaId });
      if (sailorOrg) p.set('org', sailorOrg);
      return `/login?${p.toString()}`;
    }
    if (sailorOrg) {
      return `/login?${reason}&org=${encodeURIComponent(sailorOrg)}`;
    }
    return `/login?${reason}`;
  }

  if (pathname === '/scorer' || pathname.startsWith('/scorer/')) {
    const regattaMatch = pathname.match(/^\/scorer\/manage-regattas\/(\d+)/);
    const sailorOrg =
      params.get('org')?.trim() ||
      getStoredSailorOrgSlug() ||
      getStoredAdminOrgSlug() ||
      getOrgSlugFromCurrentLocation();
    const p = new URLSearchParams({ reason: 'expired' });
    if (regattaMatch?.[1]) p.set('regattaId', regattaMatch[1]);
    if (sailorOrg) p.set('org', sailorOrg);
    return `/login?${p.toString()}`;
  }

  let url = `/login?${reason}`;
  const regattaId = params.get('regattaId');
  const orgLogin =
    params.get('org')?.trim() ||
    getStoredSailorOrgSlug() ||
    getStoredAdminOrgSlug() ||
    getOrgSlugFromCurrentLocation();
  if (regattaId) url += `&regattaId=${encodeURIComponent(regattaId)}`;
  if (orgLogin) url += `&org=${encodeURIComponent(orgLogin)}`;
  return url;
}
