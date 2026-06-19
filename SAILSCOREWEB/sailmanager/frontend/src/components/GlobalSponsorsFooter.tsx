'use client';

import { useEffect, useState } from 'react';
import SponsorsFooterSection, { type SponsorItem } from '@/components/sponsors/SponsorsFooterSection';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://127.0.0.1:8000';

/** Sponsors globais da organização: aparecem na homepage, calendar, news. */
export default function GlobalSponsorsFooter({ orgSlug }: { orgSlug?: string | null }) {
  const [sponsors, setSponsors] = useState<SponsorItem[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const qs = orgSlug ? `?org=${encodeURIComponent(orgSlug)}` : '';
        const res = await fetch(`${API_BASE}/sponsors${qs}`, { cache: 'no-store' });
        if (res.ok) {
          const data = (await res.json()) as SponsorItem[];
          setSponsors(Array.isArray(data) ? data : []);
        }
      } catch {
        setSponsors([]);
      }
    })();
  }, [orgSlug]);

  return <SponsorsFooterSection sponsors={sponsors} />;
}
