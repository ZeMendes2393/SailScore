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

  const navItems = useMemo(() => {
    if (orgSlug) {
      const cal = `/calendar?org=${encodeURIComponent(orgSlug)}`;
      return [
        { href: `/o/${orgSlug}`, label: 'Home' },
        { href: cal, label: 'Calendar' },
        { href: '/results', label: 'Results' },
        { href: `/o/${orgSlug}/news`, label: 'News' },
      ];
    }
    return [
      { href: '/', label: 'Home' },
      { href: '/calendar', label: 'Calendar' },
      { href: '/results', label: 'Results' },
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
      if (href === '/results') return pathname.startsWith('/results');
    }
    return pathname === href;
  };

  const logoUrl = design?.club_logo_url?.trim();
  const logoLink = design?.club_logo_link?.trim();
  const homeHref = orgSlug ? `/o/${orgSlug}` : '/';

  const brandFallback = orgDisplayName || 'SailScore';

  // Com orgSlug: só mostrar logo após mount para evitar hydration mismatch (servidor vs cliente)
  const showLogo = logoUrl && (!orgSlug || mounted);
  const showExternalLink = logoLink && (!orgSlug || mounted);

  const logoContent = showLogo ? (
    <img
      src={logoUrl.startsWith('http') ? logoUrl : `${BASE_URL}${logoUrl}`}
      alt="Club logo"
      className="h-full max-h-20 w-auto object-contain drop-shadow-sm"
      onError={(e) => (e.currentTarget.style.display = 'none')}
    />
  ) : (
    <span className="text-xl font-bold tracking-tight">{brandFallback}</span>
  );

  return (
    <header className="sticky top-0 z-50 bg-gradient-to-r from-blue-700/35 to-sky-600/35 text-white shadow-lg backdrop-blur-md">
      <div className="w-full h-28 flex items-center justify-between px-4 sm:px-6 gap-4">
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
              className="text-2xl md:text-3xl font-bold tracking-tight uppercase hover:opacity-90 transition-opacity"
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
                <span className="text-xs font-semibold uppercase tracking-wide text-white/80">
                  Sailor account
                </span>
                <span className="text-sm text-white">
                  {user?.email || (user as any)?.username || (user as any)?.name || 'Signed in'}
                </span>
              </div>
            ) : (
              <>
                <Link
                  href={adminHomeHref}
                  className="inline-block px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white font-medium text-lg transition shadow-sm"
                >
                  Dashboard
                </Link>
                <Link
                  href={adminHomeHref}
                  className="inline-block px-4 py-2 rounded-lg hover:bg-white/20 text-white font-medium text-lg transition"
                >
                  Admin Account
                </Link>
                <button
                  onClick={() => logout({ redirectTo: orgSlug ? `/o/${orgSlug}` : '/' })}
                  className="inline-block px-4 py-2 rounded-lg hover:bg-white/20 text-white font-medium text-lg transition"
                >
                  Sign out
                </button>
              </>
            )
          ) : (
            <>
              <nav className="flex items-center gap-2 text-lg font-medium">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-4 py-2 rounded-lg transition ${
                      isNavActive(item.href) ? 'bg-white/25 text-white' : 'hover:bg-white/15 text-white/95'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <Link
                href={orgSlug ? `/admin/login?org=${encodeURIComponent(orgSlug)}` : '/admin/login'}
                className="inline-block px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white font-medium text-lg transition shadow-sm"
              >
                Admin Account
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
