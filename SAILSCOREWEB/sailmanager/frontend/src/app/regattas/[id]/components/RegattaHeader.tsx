'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://127.0.0.1:8000';

type RegattaHeaderProps = {
  regattaId: number;
  /** Se já vier da página (evita GET extra). */
  organizationSlug?: string | null;
};

export default function RegattaHeader({ regattaId, organizationSlug: organizationSlugProp }: RegattaHeaderProps) {
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

  const sailorAccountHref = useMemo(() => {
    const p = new URLSearchParams({ regattaId: String(regattaId) });
    if (organizationSlug) p.set('org', organizationSlug);
    return `/login?${p.toString()}`;
  }, [regattaId, organizationSlug]);

  const linkClass = (active: boolean) =>
    `px-4 py-2.5 rounded-xl transition text-base sm:text-lg ${active ? 'bg-white/20' : 'hover:bg-white/10'}`;

  return (
    <header
      className="sticky top-0 z-50 w-full bg-gradient-to-r from-blue-700/35 to-sky-600/35 text-white shadow-md backdrop-blur-md"
    >
      <div className="w-full min-h-[8rem] py-3 sm:py-4 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 px-3 sm:px-4">
        <Link href="/" className="text-2xl sm:text-3xl font-bold tracking-wide shrink-0">
          SailScore
        </Link>
        <nav className="flex items-center gap-2 md:gap-4 text-lg sm:text-xl font-semibold flex-wrap justify-end ml-auto">
          <Link href={base} className={linkClass(isHome)} title="Vista principal da regata">
            Home
          </Link>
          <Link href={`${base}/entry`} className={linkClass(isEntry)}>
            Entry List
          </Link>
          <Link href={`${base}/notice`} className={linkClass(isNotice)}>
            Notice Board
          </Link>
          <Link href={`${base}/form`} className={linkClass(isForm)}>
            Online Entry
          </Link>
          <Link href={`${base}/results`} className={linkClass(isResults)}>
            Results
          </Link>
        </nav>
        <Link
          href={sailorAccountHref}
          className="shrink-0 px-5 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-base sm:text-lg font-semibold"
        >
          Sailor account
        </Link>
      </div>
    </header>
  );
}
