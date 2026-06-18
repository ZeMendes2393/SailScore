import { getServerApiBaseUrl } from '@/lib/api';
import { DEFAULT_LOCALE, isSupportedLocale, type AppLocale } from './config';

const API = getServerApiBaseUrl();

export async function fetchOrgDefaultLocale(orgSlug: string): Promise<AppLocale> {
  try {
    const res = await fetch(`${API}/organizations/by-slug/${encodeURIComponent(orgSlug)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return DEFAULT_LOCALE;
    const data = (await res.json()) as { default_locale?: string };
    return isSupportedLocale(data.default_locale) ? data.default_locale : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function orgSlugFromPathname(pathname: string): string | null {
  const m = /^\/o\/([^/]+)/.exec(pathname);
  return m?.[1] ?? null;
}

async function orgSlugFromRegattaId(regattaId: string): Promise<string | null> {
  try {
    const res = await fetch(`${API}/regattas/${regattaId}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as { organization_slug?: string | null };
    return data.organization_slug?.trim() || null;
  } catch {
    return null;
  }
}

/** Locale when the visitor has not saved a personal preference (cookie). */
export async function resolveLocaleWithoutCookie(
  pathname: string,
  orgSlugHint: string | null
): Promise<AppLocale> {
  const orgFromPath = orgSlugFromPathname(pathname);
  if (orgFromPath) return fetchOrgDefaultLocale(orgFromPath);
  if (orgSlugHint) return fetchOrgDefaultLocale(orgSlugHint);

  const regattaMatch = /^\/regattas\/(\d+)/.exec(pathname);
  if (regattaMatch) {
    const slug = await orgSlugFromRegattaId(regattaMatch[1]);
    if (slug) return fetchOrgDefaultLocale(slug);
  }

  const adminRegattaMatch = /^\/admin\/manage-regattas\/(\d+)/.exec(pathname);
  if (adminRegattaMatch) {
    const slug = await orgSlugFromRegattaId(adminRegattaMatch[1]);
    if (slug) return fetchOrgDefaultLocale(slug);
  }

  const defaultOrg = process.env.NEXT_PUBLIC_DEFAULT_ORG_SLUG?.trim();
  if (defaultOrg && (pathname === '/' || pathname.startsWith('/calendar'))) {
    return fetchOrgDefaultLocale(defaultOrg);
  }

  return DEFAULT_LOCALE;
}
