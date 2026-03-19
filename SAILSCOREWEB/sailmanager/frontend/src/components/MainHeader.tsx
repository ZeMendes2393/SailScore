'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { apiGet, BASE_URL } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

type HeaderDesign = { club_logo_url: string | null; club_logo_link: string | null };

export default function MainHeader({ initialDesign = null }: { initialDesign?: HeaderDesign | null }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const isLoggedIn = !!user;
  const isSailor = user?.role === 'regatista';
  const isActive = (p: string) => pathname === p;
  const [design, setDesign] = useState<HeaderDesign | null>(initialDesign);

  useEffect(() => {
    if (initialDesign) return; // already have server data
    apiGet<HeaderDesign>('/design/header')
      .then((d) => setDesign(d))
      .catch(() => setDesign(null));
  }, [initialDesign]);

  const logoUrl = design?.club_logo_url?.trim();
  const logoLink = design?.club_logo_link?.trim();

  const logoContent = logoUrl ? (
    <img
      src={logoUrl.startsWith('http') ? logoUrl : `${BASE_URL}${logoUrl}`}
      alt="Club logo"
      className="h-full max-h-20 w-auto object-contain drop-shadow-sm"
      onError={(e) => (e.currentTarget.style.display = 'none')}
    />
  ) : (
    <span className="text-xl font-bold tracking-tight">SailScore</span>
  );

  return (
    <header className="sticky top-0 z-50 bg-gradient-to-r from-blue-700/35 to-sky-600/35 text-white shadow-lg backdrop-blur-md">
      <div className="w-full h-28 flex items-center justify-between px-4 sm:px-6 gap-4">
        <div className="flex items-center gap-4 shrink-0">
          {logoLink ? (
            <Link href={logoLink} target="_blank" rel="noopener noreferrer" className="hover:opacity-90 transition-opacity">
              {logoContent}
            </Link>
          ) : (
            <Link href="/" className="hover:opacity-90 transition-opacity">
              {logoContent}
            </Link>
          )}
          {!isLoggedIn && (
            <Link
              href="/"
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
              // Sailor account: show identity only; page handles Sign out / navigation
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
                  href="/admin"
                  className="inline-block px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white font-medium text-lg transition shadow-sm"
                >
                  Dashboard
                </Link>
                <Link
                  href="/admin"
                  className="inline-block px-4 py-2 rounded-lg hover:bg-white/20 text-white font-medium text-lg transition"
                >
                  Admin Account
                </Link>
                <button
                  onClick={() => logout({ redirectTo: '/' })}
                  className="inline-block px-4 py-2 rounded-lg hover:bg-white/20 text-white font-medium text-lg transition"
                >
                  Sign out
                </button>
              </>
            )
          ) : (
            <>
              <nav className="flex items-center gap-2 text-lg font-medium">
                {[
                  { href: '/', label: 'Home' },
                  { href: '/calendar', label: 'Calendar' },
                  { href: '/results', label: 'Results' },
                  { href: '/news', label: 'News' },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-4 py-2 rounded-lg transition ${
                      isActive(item.href) ? 'bg-white/25 text-white' : 'hover:bg-white/15 text-white/95'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <Link
                href="/admin/login"
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
