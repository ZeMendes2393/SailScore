'use client';

import { Suspense, useEffect, useLayoutEffect, useState } from 'react';
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
  const [resolvedOrgSlug, setResolvedOrgSlug] = useState<string | null>(() =>
    orgFromQuery ?? DEFAULT_PUBLIC_ORG_SLUG ?? null
  );
  /** Sem ?org= nem env: ler sessionStorage em useLayoutEffect antes do 1.º paint — evita flash do “site sem org”. */
  const [storageChecked, setStorageChecked] = useState(
    () => !!(orgFromQuery || DEFAULT_PUBLIC_ORG_SLUG)
  );
  const [regattas, setRegattas] = useState<Regatta[]>([]);

  useLayoutEffect(() => {
    if (orgFromQuery || DEFAULT_PUBLIC_ORG_SLUG) {
      setResolvedOrgSlug(orgFromQuery ?? DEFAULT_PUBLIC_ORG_SLUG ?? null);
      setStorageChecked(true);
      return;
    }
    try {
      const fromStore = sessionStorage.getItem(LAST_ORG_KEY)?.trim() || null;
      setResolvedOrgSlug(fromStore);
    } catch {
      setResolvedOrgSlug(null);
    } finally {
      setStorageChecked(true);
    }
  }, [orgFromQuery]);

  useEffect(() => {
    if (!storageChecked) return;
    if (resolvedOrgSlug && !orgFromQuery) {
      router.replace(`/calendar?org=${encodeURIComponent(resolvedOrgSlug)}`, { scroll: false });
    }
  }, [storageChecked, resolvedOrgSlug, orgFromQuery, router]);

  useEffect(() => {
    if (!storageChecked) return;
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
  }, [storageChecked, resolvedOrgSlug]);

  const regattaLinkSuffix =
    resolvedOrgSlug != null && resolvedOrgSlug !== ''
      ? `?org=${encodeURIComponent(resolvedOrgSlug)}`
      : '';

  if (!storageChecked) {
    return (
      <div className="py-8" aria-busy="true" aria-live="polite">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Calendar</h1>
          <p className="text-gray-600 mt-2">Browse regattas by month and year.</p>
        </div>
        <div className="max-w-4xl rounded-xl border border-gray-100 bg-white p-8 shadow-sm">
          <div className="h-8 w-48 animate-pulse rounded bg-gray-200 mb-6" />
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-md bg-gray-100" />
            ))}
          </div>
          <p className="mt-6 text-sm text-gray-500">Loading…</p>
        </div>
      </div>
    );
  }

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

      <GlobalSponsorsFooter orgSlug={resolvedOrgSlug} />
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<div className="py-8 text-gray-500">Loading…</div>}>
      <CalendarContent />
    </Suspense>
  );
}
