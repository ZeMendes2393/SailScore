'use client';

import { useParams } from 'next/navigation';
import RegattaSponsorsFooter from './components/RegattaSponsorsFooter';

export default function RegattaLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const id = params?.id as string | undefined;
  const regattaId = id && /^\d+$/.test(id) ? Number(id) : 0;

  return (
    <>
      {children}
      {regattaId > 0 && <RegattaSponsorsFooter regattaId={regattaId} />}
    </>
  );
}
