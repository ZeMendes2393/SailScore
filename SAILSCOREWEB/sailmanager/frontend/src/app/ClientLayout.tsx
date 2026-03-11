'use client';

import ContentContainer from '@/components/ContentContainer';
import MainHeader from '@/components/MainHeader';
import GlobalFooter from '@/components/GlobalFooter';
import { usePathname } from 'next/navigation';

export type HeaderDesign = { club_logo_url: string | null; club_logo_link: string | null };

export default function ClientLayout({
  headerDesign,
  children,
}: {
  headerDesign: HeaderDesign | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const showMainHeader = !pathname?.match(/^\/regattas\/\d+(?:\/|$)/);
  const useContentContainer =
    pathname !== '/' &&
    !pathname?.match(/^\/admin(\/|$)/) &&
    !pathname?.match(/^\/login(\/|$)/) &&
    !pathname?.match(/^\/register(\/|$)/) &&
    !pathname?.match(/^\/dashboard(\/|$)/) &&
    !pathname?.match(/^\/accept-invite(\/|$)/) &&
    !pathname?.match(/^\/regattas\/\d+/);

  return (
    <>
      {showMainHeader && <MainHeader initialDesign={headerDesign} />}
      <main className={`flex-1 w-full ${pathname === '/' ? 'pt-0 pb-8' : 'py-8'}`}>
        {useContentContainer ? <ContentContainer>{children}</ContentContainer> : children}
      </main>
      <GlobalFooter />
    </>
  );
}
