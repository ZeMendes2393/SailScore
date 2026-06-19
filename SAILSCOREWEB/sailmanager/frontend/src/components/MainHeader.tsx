'use client';

import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { apiGet, apiAssetUrl } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { isAdminRole } from '@/lib/roles';
import { useAdminOrg, withOrg } from '@/lib/useAdminOrg';
import { useScrollHideHeader } from '@/hooks/useScrollHideHeader';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useTranslations } from 'next-intl';
import {
  headerNavLinkStyle,
  headerSurfaceStyle,
  resolveHeaderTheme,
} from '@/lib/headerTheme';

type HeaderDesign = {
  club_logo_url: string | null;
  club_logo_link: string | null;
  header_background_color?: string | null;
};

export default function MainHeader({
  initialDesign = null,
  orgSlug = null,
}: {
  initialDesign?: HeaderDesign | null;
  orgSlug?: string | null;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { orgSlug: adminOrgSlug } = useAdminOrg();
  const isLoggedIn = !!user;
  const isSailor = user?.role === 'regatista';
  const adminHomeHref =
    isLoggedIn && !isSailor && user && isAdminRole(user.role)
      ? withOrg('/admin', adminOrgSlug)
      : '/admin';
  const [design, setDesign] = useState<HeaderDesign | null>(initialDesign ?? null);
  const [orgDisplayName, setOrgDisplayName] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { hidden: headerHidden } = useScrollHideHeader({ forceVisible: mobileMenuOpen });
  const t = useTranslations('nav');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (orgSlug) {
      if (initialDesign) {
        setDesign(initialDesign);
      } else {
        const q = `?org=${encodeURIComponent(orgSlug)}`;
        apiGet<HeaderDesign>(`/design/header${q}`)
          .then((d) => setDesign(d))
          .catch(() => setDesign(null));
      }
      apiGet<{ name: string }>(`/organizations/by-slug/${encodeURIComponent(orgSlug)}`)
        .then((o) => setOrgDisplayName(o.name?.trim() || null))
        .catch(() => setOrgDisplayName(null));
      return;
    }
    if (initialDesign) {
      setDesign(initialDesign);
      return;
    }
    apiGet<HeaderDesign>('/design/header')
      .then((d) => setDesign(d))
      .catch(() => setDesign(null));
  }, [orgSlug, initialDesign]);

  useEffect(() => {
    setLogoFailed(false);
  }, [design?.club_logo_url]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const navItems = useMemo(() => {
    if (orgSlug) {
      const cal = `/calendar?org=${encodeURIComponent(orgSlug)}`;
      return [
        { href: `/o/${orgSlug}`, label: t('home') },
        { href: cal, label: t('calendar') },
        { href: `/o/${orgSlug}/news`, label: t('news') },
      ];
    }
    return [
      { href: '/', label: t('home') },
      { href: '/calendar', label: t('calendar') },
      { href: '/news', label: t('news') },
    ];
  }, [orgSlug, t]);

  const isNavActive = (href: string) => {
    if (!pathname) return false;
    if (orgSlug) {
      if (href === `/o/${orgSlug}`) return pathname === href || pathname === `/o/${orgSlug}/`;
      if (href.includes('/news')) return pathname.startsWith(`/o/${orgSlug}/news`);
      if (href.startsWith('/calendar')) {
        return pathname.startsWith('/calendar');
      }
    }
    return pathname === href;
  };

  const logoUrl = design?.club_logo_url?.trim();
  const logoLink = design?.club_logo_link?.trim();
  const headerTheme = resolveHeaderTheme(design?.header_background_color);
  const homeHref = orgSlug ? `/o/${orgSlug}` : '/';

  const brandFallback = orgDisplayName || 'SailScore';

  /** Com design já vindo do layout (SSR), podemos mostrar logo logo — evita logo “invisível” por h-full/altura 0. */
  const hasInitialLogo = !!(initialDesign?.club_logo_url?.trim());
  const hasInitialLogoLink = !!(initialDesign?.club_logo_link?.trim());
  const showLogo =
    !!logoUrl && (!orgSlug || mounted || hasInitialLogo);
  const showExternalLink = !!logoLink && (!orgSlug || mounted || hasInitialLogoLink);

  const logoContent =
    showLogo && !logoFailed ? (
      <img
        src={apiAssetUrl(logoUrl!)}
        alt={t('clubLogoAlt')}
        className="max-h-[3rem] md:max-h-[3.75rem] w-auto h-auto object-contain object-left drop-shadow-sm"
        onError={() => setLogoFailed(true)}
      />
    ) : (
      <span className="text-lg md:text-xl font-bold tracking-tight">{brandFallback}</span>
    );

  return (
    <>
    <header
      className={`app-site-header header-themed shadow-lg backdrop-blur-md supports-[backdrop-filter]:backdrop-blur-md${headerHidden ? ' is-hidden' : ''}`}
      style={
        {
          ...headerSurfaceStyle(headerTheme),
          '--header-pill-hover': headerTheme.pillHover,
        } as CSSProperties
      }
      suppressHydrationWarning
    >
      <div className="w-full min-h-[4.25rem] md:min-h-[5rem] py-2 sm:py-2.5 flex items-center justify-between px-3 sm:px-4 gap-2 md:gap-3 flex-wrap">
        <div className="flex items-center gap-4 shrink-0">
          {showExternalLink ? (
            <Link
              href={logoLink!}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-90 transition-opacity"
            >
              {logoContent}
            </Link>
          ) : (
            <Link href={homeHref} className="hover:opacity-90 transition-opacity">
              {logoContent}
            </Link>
          )}
        </div>

        <div className="hidden md:flex items-center gap-2 ml-auto">
          <LanguageSwitcher theme={headerTheme.langSwitcherTheme} className="shrink-0" />
          {isLoggedIn ? (
            isSailor ? (
              <div className="flex flex-col items-end text-right">
                <span className="text-base font-semibold uppercase tracking-wide" style={{ color: headerTheme.colorMuted }}>
                  {t('sailorAccountLabel')}
                </span>
                <span className="text-lg" style={{ color: headerTheme.color }}>
                  {user?.email || (user as any)?.username || (user as any)?.name || t('signedIn')}
                </span>
              </div>
            ) : (
              <>
                <Link
                  href={adminHomeHref}
                  className="inline-block px-5 py-2.5 rounded-xl font-semibold text-base transition shadow-sm header-themed-nav-link"
                  style={{ backgroundColor: headerTheme.pillSolid, color: headerTheme.color }}
                >
                  {t('dashboard')}
                </Link>
                <button
                  onClick={() => logout({ redirectTo: orgSlug ? `/o/${orgSlug}` : '/' })}
                  className="inline-block px-5 py-2.5 rounded-xl font-semibold text-base transition header-themed-nav-link"
                  style={{ color: headerTheme.color }}
                >
                  {t('signOut')}
                </button>
              </>
            )
          ) : (
            <>
              <nav className="flex items-center gap-2 text-base md:text-lg font-semibold">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="px-5 py-2.5 rounded-xl transition header-themed-nav-link"
                    style={headerNavLinkStyle(headerTheme, isNavActive(item.href))}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </>
          )}
        </div>

        <div className="md:hidden ml-auto flex items-center gap-2">
          <LanguageSwitcher theme={headerTheme.langSwitcherTheme} className="shrink-0" />
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="inline-flex items-center justify-center rounded-xl px-3 py-2 transition header-themed-menu-btn"
            style={{ backgroundColor: headerTheme.pillSolid, color: headerTheme.color }}
            aria-label={mobileMenuOpen ? t('closeMenu') : t('openMenu')}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-main-nav"
          >
            <span className="text-lg font-semibold leading-none">{mobileMenuOpen ? 'X' : 'Menu'}</span>
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div
          id="mobile-main-nav"
          className="md:hidden border-t backdrop-blur-md px-3 pb-3"
          style={{ borderColor: headerTheme.borderColor, background: headerTheme.mobilePanelBg }}
        >
          <div className="pt-3 pb-1 flex justify-end">
            <LanguageSwitcher theme={headerTheme.langSwitcherTheme} />
          </div>
          {isLoggedIn ? (
            isSailor ? (
              <div className="py-3" style={{ color: headerTheme.colorMuted }}>
                <p className="text-sm uppercase tracking-wide font-semibold" style={{ color: headerTheme.colorMuted }}>
                  {t('sailorAccountLabel')}
                </p>
                <p className="text-base mt-1 break-all" style={{ color: headerTheme.color }}>
                  {user?.email || (user as any)?.username || (user as any)?.name || t('signedIn')}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 py-3">
                <Link
                  href={adminHomeHref}
                  className="w-full px-4 py-2.5 rounded-xl font-semibold text-base transition text-center header-themed-nav-link"
                  style={{ backgroundColor: headerTheme.pillSolid, color: headerTheme.color }}
                >
                  {t('dashboard')}
                </Link>
                <button
                  onClick={() => logout({ redirectTo: orgSlug ? `/o/${orgSlug}` : '/' })}
                  className="w-full px-4 py-2.5 rounded-xl font-semibold text-base transition header-themed-nav-link"
                  style={{ color: headerTheme.color }}
                >
                  {t('signOut')}
                </button>
              </div>
            )
          ) : (
            <nav className="flex flex-col gap-2 py-3 text-base font-semibold">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="w-full px-4 py-2.5 rounded-xl transition header-themed-nav-link"
                  style={headerNavLinkStyle(headerTheme, isNavActive(item.href))}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
        </div>
      )}
    </header>
    <div className="app-site-header-spacer" aria-hidden />
    </>
  );
}
