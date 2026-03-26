'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RegattaCalendar } from '@/components/regatta-calendar/RegattaCalendar';
import GlobalSponsorsFooter from '@/components/GlobalSponsorsFooter';

const LAST_ORG_KEY = 'ss_last_org_slug';

interface Regatta {
  id: number;
  name: string;
  location: string;
  start_date: string;
  end_date: string;
  online_entry_open?: boolean;
  class_names?: string[];
  listing_logo_url?: string | null;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://127.0.0.1:8000';

/** Deploy por clube; o middleware também redireciona /calendar → ?org= quando está definido. */
const DEFAULT_PUBLIC_ORG_SLUG = process.env.NEXT_PUBLIC_DEFAULT_ORG_SLUG?.trim() || null;

function CalendarContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgFromQuery = searchParams.get('org')?.trim() || null;
  /** undefined = ainda a resolver (redirect com sessionStorage); null = sem âmbito → API default */
  const [resolvedOrgSlug, setResolvedOrgSlug] = useState<string | null | undefined>(undefined);
  const [regattas, setRegattas] = useState<Regatta[]>([]);

  useEffect(() => {
    let resolved = orgFromQuery ?? DEFAULT_PUBLIC_ORG_SLUG ?? null;
    if (!resolved) {
      try {
        resolved = sessionStorage.getItem(LAST_ORG_KEY)?.trim() || null;
      } catch {
        resolved = null;
      }
    }
    if (resolved && !orgFromQuery) {
      router.replace(`/calendar?org=${encodeURIComponent(resolved)}`, { scroll: false });
      return;
    }
    setResolvedOrgSlug(resolved);
  }, [orgFromQuery, router]);

  useEffect(() => {
    if (resolvedOrgSlug === undefined) return;
    (async () => {
      try {
        const q = resolvedOrgSlug ? `?org=${encodeURIComponent(resolvedOrgSlug)}` : '';
        const res = await fetch(`${API_BASE}/regattas/${q}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as Regatta[];
        setRegattas(data);
      } catch (err) {
        console.error('Failed to fetch regattas:', err);
      }
    })();
  }, [resolvedOrgSlug]);

  const regattaLinkSuffix =
    resolvedOrgSlug != null && resolvedOrgSlug !== ''
      ? `?org=${encodeURIComponent(resolvedOrgSlug)}`
      : '';

  const sponsorsOrg = resolvedOrgSlug === undefined ? null : resolvedOrgSlug;

  return (
    <div className="py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Calendar</h1>
        <p className="text-gray-600 mt-2">Browse regattas by month and year.</p>
      </div>

      <div className="max-w-4xl">
        <RegattaCalendar
          regattas={regattas}
          regattaLinkPrefix="/regattas"
          regattaLinkSuffix={regattaLinkSuffix}
          labels={{
            noRegattas: 'No regattas in this month.',
            viewButton: 'View',
            statusOpen: 'Registrations open',
            statusClosed: 'Registrations closed',
          }}
        />
      </div>

      <GlobalSponsorsFooter orgSlug={sponsorsOrg} />
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<div className="py-8 text-gray-500">A carregar…</div>}>
      <CalendarContent />
    </Suspense>
  );
}
