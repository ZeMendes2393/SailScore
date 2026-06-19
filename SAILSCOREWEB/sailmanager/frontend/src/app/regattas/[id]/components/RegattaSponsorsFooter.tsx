'use client';

import { useEffect, useState } from 'react';
import SponsorsFooterSection, { type SponsorItem } from '@/components/sponsors/SponsorsFooterSection';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://127.0.0.1:8000';

export default function RegattaSponsorsFooter({ regattaId }: { regattaId: number }) {
  const [sponsors, setSponsors] = useState<SponsorItem[]>([]);

  useEffect(() => {
    if (!regattaId) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/regattas/${regattaId}/sponsors`, { cache: 'no-store' });
        if (res.ok) {
          const data = (await res.json()) as SponsorItem[];
          setSponsors(Array.isArray(data) ? data : []);
        }
      } catch {
        setSponsors([]);
      }
    })();
  }, [regattaId]);

  return (
    <SponsorsFooterSection
      sponsors={sponsors}
      imageClassName="max-h-16 sm:max-h-24 md:max-h-32 w-auto max-w-[min(100%,220px)] sm:max-w-[280px] object-contain"
    />
  );
}
