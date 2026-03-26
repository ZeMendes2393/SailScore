'use client';

import { Suspense, useEffect } from 'react';
import ContentContainer from '@/components/ContentContainer';
import MainHeader from '@/components/MainHeader';
import GlobalFooter from '@/components/GlobalFooter';
import { usePathname, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';

export type HeaderDesign = { club_logo_url: string | null; club_logo_link: string | null };

/** Org slug from path only - SSR-safe, no useSearchParams */
function orgSlugFromPathname(pathname: string | null): string | null {
  const m = pathname?.match(/^\/o\/([^/]+)/);
  return m?.[1] ?? null;
}

/** Slug da organização (usa searchParams e user - requer Suspense) */
function useOrgSlugWithParams(pathname: string | null): string | null {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  return useMemo(() => {
    const fromPath = orgSlugFromPathname(pathname);
    if (fromPath) return fromPath;
    if (pathname?.startsWith('/admin')) {
      const fromQs = searchParams?.get('org')?.trim();
      if (fromQs) return fromQs;
      if (user?.role === 'admin' && (user as { organization_slug?: string }).organization_slug) {
        return (user as { organization_slug: string }).organization_slug;
      }
    }
    if (pathname?.startsWith('/calendar')) {
      const calOrg = searchParams?.get('org')?.trim();
      if (calOrg) return calOrg;
      const defCal = process.env.NEXT_PUBLIC_DEFAULT_ORG_SLUG?.trim();
      if (defCal) return defCal;
    }
    return null;
  }, [pathname, searchParams, user?.role, (user as { organization_slug?: string })?.organization_slug]);
}

export function useOrgSlugFromPath(): string | null {
  const pathname = usePathname();
  return useOrgSlugWithParams(pathname);
}

type FooterDesign = Record<string, unknown> | null;

const LAST_ORG_KEY = 'ss_last_org_slug';

/** `/` ou `/o/slug` (homepage pública da org) — sem ContentContainer para hero full-bleed */
function isPublicHomePage(pathname: string | null | undefined): boolean {
  if (!pathname || pathname === '/') return true;
  return /^\/o\/[^/]+\/?$/.test(pathname);
}

function ClientLayoutInner({
  headerDesign,
  footerDesign,
  serverOrgSlug,
  children,
  pathname,
}: {
  headerDesign: HeaderDesign | null;
  footerDesign?: FooterDesign;
  serverOrgSlug?: string | null;
  children: React.ReactNode;
  pathname: string | null;
}) {
  const orgSlug = useOrgSlugWithParams(pathname);
  /** Servidor já resolve org em `/`, `/calendar`, `/regattas/:id`; o menu precisa do mesmo slug que o footer. */
  const orgSlugForHeader = orgSlug ?? serverOrgSlug ?? null;

  useEffect(() => {
    const m = pathname?.match(/^\/o\/([^/]+)/);
    if (m?.[1]) {
      try {
        sessionStorage.setItem(LAST_ORG_KEY, m[1]);
      } catch {
        /* ignore */
      }
    }
  }, [pathname]);

  const showMainHeader = !pathname?.match(/^\/regattas\/\d+(?:\/|$)/);
  const homeRoute = isPublicHomePage(pathname);
  const useContentContainer =
    !homeRoute &&
    !pathname?.match(/^\/admin(\/|$)/) &&
    !pathname?.match(/^\/login(\/|$)/) &&
    !pathname?.match(/^\/register(\/|$)/) &&
    !pathname?.match(/^\/dashboard(\/|$)/) &&
    !pathname?.match(/^\/accept-invite(\/|$)/) &&
    !pathname?.match(/^\/regattas\/\d+/);

  // Layout já carrega o design correto (default ou org consoante o path) → evitar flash
  const headerForOrg = headerDesign;

  return (
    <>
      {showMainHeader && (
        <MainHeader
          key={orgSlugForHeader ?? 'default'}
          initialDesign={headerForOrg}
          orgSlug={orgSlugForHeader}
        />
      )}
      <main className={`flex-1 w-full ${homeRoute ? 'pt-0 pb-8' : 'py-8'}`}>
        {useContentContainer ? <ContentContainer>{children}</ContentContainer> : children}
      </main>
      <GlobalFooter
          orgSlug={orgSlug}
          initialFooter={footerDesign}
          serverOrgSlug={serverOrgSlug}
        />
    </>
  );
}

export default function ClientLayout({
  headerDesign,
  footerDesign = null,
  serverOrgSlug = null,
  children,
}: {
  headerDesign: HeaderDesign | null;
  footerDesign?: FooterDesign;
  serverOrgSlug?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const orgSlugFallback = orgSlugFromPathname(pathname) ?? serverOrgSlug;
  const showMainHeader = !pathname?.match(/^\/regattas\/\d+(?:\/|$)/);
  const homeRoute = isPublicHomePage(pathname);
  const useContentContainer =
    !homeRoute &&
    !pathname?.match(/^\/admin(\/|$)/) &&
    !pathname?.match(/^\/login(\/|$)/) &&
    !pathname?.match(/^\/register(\/|$)/) &&
    !pathname?.match(/^\/dashboard(\/|$)/) &&
    !pathname?.match(/^\/accept-invite(\/|$)/) &&
    !pathname?.match(/^\/regattas\/\d+/);

  const fallbackContent = (
    <>
      {showMainHeader && (
        <MainHeader
          key={orgSlugFallback ?? 'default'}
          initialDesign={headerDesign}
          orgSlug={orgSlugFallback}
        />
      )}
      <main className={`flex-1 w-full ${homeRoute ? 'pt-0 pb-8' : 'py-8'}`}>
        {useContentContainer ? <ContentContainer>{children}</ContentContainer> : children}
      </main>
      <GlobalFooter orgSlug={orgSlugFallback} initialFooter={footerDesign} serverOrgSlug={serverOrgSlug} />
    </>
  );

  return (
    <Suspense fallback={fallbackContent}>
      <ClientLayoutInner
        headerDesign={headerDesign}
        footerDesign={footerDesign}
        serverOrgSlug={serverOrgSlug}
        pathname={pathname}
      >
        {children}
      </ClientLayoutInner>
    </Suspense>
  );
}
