'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type RegattaHeaderProps = {
  regattaId: number;
};

export default function RegattaHeader({ regattaId }: RegattaHeaderProps) {
  const pathname = usePathname();
  const base = `/regattas/${regattaId}`;
  const isHome = pathname === base || pathname === `${base}/`;
  const isEntry = pathname.includes('/entry');
  const isNotice = pathname.includes('/notice');
  const isForm = pathname.includes('/form');
  const isResults = pathname.includes('/results');

  const linkClass = (active: boolean) =>
    `px-3 py-1 rounded-md transition ${active ? 'bg-white/20' : 'hover:bg-white/10'}`;

  return (
    <header
      className="sticky top-0 z-50 w-full bg-gradient-to-r from-blue-700/85 to-sky-600/85 text-white shadow-md backdrop-blur-md"
    >
      <div className="w-full h-24 flex items-center justify-between px-4 sm:px-6">
        <Link href="/" className="text-lg font-bold tracking-wide shrink-0">
          SailScore
        </Link>
        <nav className="flex items-center gap-2 md:gap-4 text-sm font-medium flex-wrap justify-center">
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
          href={`/login?regattaId=${regattaId}`}
          className="shrink-0 px-3 py-1 rounded bg-white/20 hover:bg-white/30 text-white text-sm"
        >
          Sailor account
        </Link>
      </div>
    </header>
  );
}
