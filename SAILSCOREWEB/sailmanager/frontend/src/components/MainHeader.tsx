'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { apiGet, BASE_URL } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { isAdminRole } from '@/lib/roles';
import { useAdminOrg, withOrg } from '@/lib/useAdminOrg';

type HeaderDesign = { club_logo_url: string | null; club_logo_link: string | null };

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

  const navItems = useMemo(() => {
    if (orgSlug) {
      const cal = `/calendar?org=${encodeURIComponent(orgSlug)}`;
      return [
        { href: `/o/${orgSlug}`, label: 'Home' },
        { href: cal, label: 'Calendar' },
        { href: `/o/${orgSlug}/news`, label: 'News' },
      ];
    }
    return [
      { href: '/', label: 'Home' },
      { href: '/calendar', label: 'Calendar' },
      { href: '/news', label: 'News' },
    ];
  }, [orgSlug]);

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
        src={logoUrl!.startsWith('http') ? logoUrl! : `${BASE_URL}${logoUrl}`}
        alt="Club logo"
        className="max-h-[6rem] w-auto h-auto object-contain object-left drop-shadow-sm"
        onError={() => setLogoFailed(true)}
      />
    ) : (
      <span className="text-2xl md:text-3xl font-bold tracking-tight">{brandFallback}</span>
    );

  return (
    <header
      className="sticky top-0 z-50 bg-gradient-to-r from-blue-700/35 to-sky-600/35 text-white shadow-lg backdrop-blur-md"
      suppressHydrationWarning
    >
      <div className="w-full min-h-[8rem] py-3 sm:py-4 flex items-center justify-between px-3 sm:px-4 gap-4 flex-wrap">
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
          {!isLoggedIn && (
            <Link
              href={homeHref}
              className="text-3xl md:text-4xl font-bold tracking-tight uppercase hover:opacity-90 transition-opacity"
              prefetch={false}
            >
              Regattas
            </Link>
          )}
        </div>

        <div className="hidden md:flex items-center gap-2 ml-auto">
          {isLoggedIn ? (
            isSailor ? (
              <div className="flex flex-col items-end text-right">
                <span className="text-base font-semibold uppercase tracking-wide text-white/85">
                  Sailor account
                </span>
                <span className="text-lg text-white">
                  {user?.email || (user as any)?.username || (user as any)?.name || 'Signed in'}
                </span>
              </div>
            ) : (
              <>
                <Link
                  href={adminHomeHref}
                  className="inline-block px-5 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-semibold text-base transition shadow-sm"
                >
                  Dashboard
                </Link>
                <button
                  onClick={() => logout({ redirectTo: orgSlug ? `/o/${orgSlug}` : '/' })}
                  className="inline-block px-5 py-2.5 rounded-xl hover:bg-white/20 text-white font-semibold text-base transition"
                >
                  Sign out
                </button>
              </>
            )
          ) : (
            <>
              <nav className="flex items-center gap-2 text-xl font-semibold">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-5 py-2.5 rounded-xl transition ${
                      isNavActive(item.href) ? 'bg-white/25 text-white' : 'hover:bg-white/15 text-white/95'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
