'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useScrollHideHeader } from '@/hooks/useScrollHideHeader';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useTranslations } from 'next-intl';
import {
  headerNavLinkStyle,
  headerSurfaceStyle,
  resolveHeaderTheme,
} from '@/lib/headerTheme';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://127.0.0.1:8000';

/** Hero full-bleed no desktop; no mobile o spacer do header trata do offset. */
export const REGATTA_HERO_HEADER_PT = '';

type RegattaHeaderProps = {
  regattaId: number;
  /** Se já vier da página (evita GET extra). */
  organizationSlug?: string | null;
  /** Hero full-bleed: sem spacer (evita faixa branca entre header e imagem). */
  overlayHero?: boolean;
};

type HeaderDesign = {
  club_logo_url?: string | null;
  header_background_color?: string | null;
};

export default function RegattaHeader({
  regattaId,
  organizationSlug: organizationSlugProp,
  overlayHero = false,
}: RegattaHeaderProps) {
  const pathname = usePathname();
  const base = `/regattas/${regattaId}`;
  const isHome = pathname === base || pathname === `${base}/`;
  const isEntry = pathname.includes('/entry');
  const isNotice = pathname.includes('/notice');
  const isForm = pathname.includes('/form');
  const isResults = pathname.includes('/results');

  const [organizationSlug, setOrganizationSlug] = useState<string | null>(
    organizationSlugProp !== undefined ? organizationSlugProp ?? null : null
  );
  const [orgDisplayName, setOrgDisplayName] = useState<string | null>(null);
  const [headerDesign, setHeaderDesign] = useState<HeaderDesign | null>(null);
  const [logoFailed, setLogoFailed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (organizationSlugProp !== undefined) {
      setOrganizationSlug(organizationSlugProp ?? null);
      return;
    }
    let cancelled = false;
    fetch(`${API_BASE}/regattas/${regattaId}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { organization_slug?: string | null } | null) => {
        if (cancelled || !d) return;
        const s = d.organization_slug?.trim();
        setOrganizationSlug(s || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [regattaId, organizationSlugProp]);

  useEffect(() => {
    if (!organizationSlug) {
      setOrgDisplayName(null);
      setHeaderDesign(null);
      return;
    }
    let cancelled = false;
    const encoded = encodeURIComponent(organizationSlug);

    fetch(`${API_BASE}/organizations/by-slug/${encoded}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { name?: string | null } | null) => {
        if (cancelled || !d) return;
        const name = d.name?.trim();
        setOrgDisplayName(name || null);
      })
      .catch(() => {});

    fetch(`${API_BASE}/design/header?org=${encoded}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: HeaderDesign | null) => {
        if (cancelled) return;
        setHeaderDesign(d);
      })
      .catch(() => {
        if (cancelled) return;
        setHeaderDesign(null);
      });

    return () => {
      cancelled = true;
    };
  }, [organizationSlug]);

  useEffect(() => {
    setLogoFailed(false);
  }, [headerDesign?.club_logo_url]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const sailorAccountHref = useMemo(() => {
    const p = new URLSearchParams({ regattaId: String(regattaId) });
    if (organizationSlug) p.set('org', organizationSlug);
    return `/login?${p.toString()}`;
  }, [regattaId, organizationSlug]);

  const navLinkClass = 'px-4 py-2.5 rounded-xl transition text-base sm:text-lg header-themed-nav-link';

  const logoUrl = headerDesign?.club_logo_url?.trim();
  const headerTheme = resolveHeaderTheme(headerDesign?.header_background_color);
  const brandText = orgDisplayName || organizationSlug || 'Regattas';
  const brandHref = organizationSlug ? `/o/${organizationSlug}` : '/';
  const { hidden: headerHidden } = useScrollHideHeader({ forceVisible: mobileMenuOpen });
  const t = useTranslations('regattaNav');

  return (
    <>
    <header
      className={`app-site-header regatta-site-header header-themed w-full shadow-md backdrop-blur-md supports-[backdrop-filter]:backdrop-blur-md${headerHidden ? ' is-hidden' : ''}`}
      style={
        {
          '--app-header-height': '4.5rem',
          ...headerSurfaceStyle(headerTheme),
          '--header-pill-hover': headerTheme.pillHover,
        } as CSSProperties
      }
    >
      <div className="w-full h-[4.5rem] md:min-h-[5.25rem] md:h-auto md:py-3 flex flex-nowrap items-center justify-between gap-2 px-3 sm:px-4 max-md:overflow-hidden md:gap-3">
        <Link href={brandHref} className="shrink-0 min-w-0 max-w-[42%] md:max-w-[36%] hover:opacity-90 transition-opacity">
          {logoUrl && !logoFailed ? (
            <img
              src={logoUrl.startsWith('http') ? logoUrl : `${API_BASE}${logoUrl}`}
              alt={brandText}
              className="max-h-11 sm:max-h-14 md:max-h-[3.75rem] w-auto max-w-full object-contain object-left"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <span className="text-lg sm:text-2xl md:text-3xl font-bold tracking-wide truncate block" style={{ color: headerTheme.color }}>
              {brandText}
            </span>
          )}
        </Link>
        <nav className="max-md:hidden md:flex items-center gap-2 md:gap-3 text-lg sm:text-xl font-semibold flex-wrap justify-end min-w-0 ml-auto">
          <Link href={base} className={navLinkClass} style={headerNavLinkStyle(headerTheme, isHome)} title={t('homeTitle')}>
            {t('home')}
          </Link>
          <Link href={`${base}/form`} className={navLinkClass} style={headerNavLinkStyle(headerTheme, isForm)}>
            {t('onlineEntry')}
          </Link>
          <Link href={`${base}/entry`} className={navLinkClass} style={headerNavLinkStyle(headerTheme, isEntry)}>
            {t('entryList')}
          </Link>
          <Link href={`${base}/notice`} className={navLinkClass} style={headerNavLinkStyle(headerTheme, isNotice)}>
            {t('noticeBoard')}
          </Link>
          <Link href={`${base}/results`} className={navLinkClass} style={headerNavLinkStyle(headerTheme, isResults)}>
            {t('results')}
          </Link>
        </nav>
        <div className="max-md:hidden md:flex items-center gap-2 shrink-0">
          <LanguageSwitcher theme={headerTheme.langSwitcherTheme} className="shrink-0" />
          <Link
            href={sailorAccountHref}
            className="inline-flex shrink-0 px-5 py-2.5 rounded-xl text-base sm:text-lg font-semibold header-themed-nav-link"
            style={{ backgroundColor: headerTheme.pillSolid, color: headerTheme.color }}
          >
            {t('sailorAccount')}
          </Link>
        </div>
        <div className="max-md:flex md:hidden ml-auto shrink-0 flex items-center gap-2">
          <LanguageSwitcher theme={headerTheme.langSwitcherTheme} />
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="inline-flex items-center justify-center rounded-xl w-11 h-11 transition header-themed-menu-btn"
            style={{ backgroundColor: headerTheme.pillSolid, color: headerTheme.color }}
            aria-label={mobileMenuOpen ? t('closeMenu') : t('openMenu')}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-regatta-nav"
          >
            {mobileMenuOpen ? (
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              >
                <path d="M6 6l12 12M18 6l-12 12" />
              </svg>
            ) : (
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              >
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
    {mobileMenuOpen && (
      <>
        <button
          type="button"
          className="regatta-mobile-menu-backdrop md:hidden"
          aria-label={t('closeMenu')}
          onClick={() => setMobileMenuOpen(false)}
        />
        <div
          id="mobile-regatta-nav"
          className="regatta-mobile-menu-panel md:hidden border-t backdrop-blur-md px-3 pb-4 shadow-lg"
          style={{ borderColor: headerTheme.borderColor, background: headerTheme.mobilePanelBg }}
        >
          <nav className="flex flex-col gap-2 py-3 text-base font-semibold">
            <div className="flex justify-end pb-1">
              <LanguageSwitcher theme={headerTheme.langSwitcherTheme} />
            </div>
            <Link href={base} className={navLinkClass} style={headerNavLinkStyle(headerTheme, isHome)} title={t('homeTitle')}>
              {t('home')}
            </Link>
            <Link href={`${base}/form`} className={navLinkClass} style={headerNavLinkStyle(headerTheme, isForm)}>
              {t('onlineEntry')}
            </Link>
            <Link href={`${base}/entry`} className={navLinkClass} style={headerNavLinkStyle(headerTheme, isEntry)}>
              {t('entryList')}
            </Link>
            <Link href={`${base}/notice`} className={navLinkClass} style={headerNavLinkStyle(headerTheme, isNotice)}>
              {t('noticeBoard')}
            </Link>
            <Link href={`${base}/results`} className={navLinkClass} style={headerNavLinkStyle(headerTheme, isResults)}>
              {t('results')}
            </Link>
            <Link
              href={sailorAccountHref}
              className="w-full px-4 py-2.5 rounded-xl text-base font-semibold text-center transition header-themed-nav-link"
              style={{ backgroundColor: headerTheme.pillSolid, color: headerTheme.color }}
            >
              {t('sailorAccount')}
            </Link>
          </nav>
        </div>
      </>
    )}
    <div
      className={`app-site-header-spacer max-md:block ${overlayHero ? 'md:hidden' : ''}`}
      style={{ '--app-header-height': '4.5rem' } as CSSProperties}
      aria-hidden
    />
    </>
  );
}
