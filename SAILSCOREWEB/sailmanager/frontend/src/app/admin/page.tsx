'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { RegattaCalendar } from '@/components/regatta-calendar/RegattaCalendar';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { useAdminOrg, withOrg, resolveAdminOrgSlugForApi } from '@/lib/useAdminOrg';
import { apiGet } from '@/lib/api';
import {
  canAccessOrganizationManagement,
  hrefOrganizationsPage,
} from '@/lib/organizationManagementAccess';

interface Regatta {
  id: number;
  name: string;
  location: string;
  start_date: string;
  end_date: string;
  online_entry_open?: boolean;
  class_names?: string[];
}

export default function AdminPage() {
  const [regattas, setRegattas] = useState<Regatta[]>([]);
  const { token, user } = useAuth();
  const { orgSlug, isPlatformAdmin } = useAdminOrg();
  const searchParams = useSearchParams();
  const showOrganizationManagement = canAccessOrganizationManagement(user, isPlatformAdmin, orgSlug);
  const organizationsHref = hrefOrganizationsPage(user, isPlatformAdmin, orgSlug, withOrg);

  const orgForLinks = useMemo(
    () => orgSlug ?? searchParams.get('org')?.trim() ?? null,
    [orgSlug, searchParams?.toString()]
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      const effective = resolveAdminOrgSlugForApi(orgSlug, searchParams);
      try {
        const data = await apiGet<Regatta[]>(withOrg('/regattas/', effective), token);
        if (!cancelled) setRegattas(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error fetching regattas:', err);
        if (!cancelled) setRegattas([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, orgSlug, searchParams?.toString()]);

  const regattaLinkSuffix = orgForLinks ? `?org=${encodeURIComponent(orgForLinks)}` : '';

  return (
    <div className="flex min-h-screen bg-gray-100">
      <AdminSidebar />

      <main className="flex-1 px-6 sm:px-8 py-10 bg-gray-100">
        <h1 className="text-5xl font-bold tracking-tight text-gray-900 mb-8">Calendar</h1>

        {showOrganizationManagement && (
          <div className="mb-8 max-w-6xl rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/90 to-white px-5 py-4 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Organizations</h2>
                <p className="mt-1 max-w-2xl text-sm text-gray-600">
                  Create clubs (public sites at <code className="rounded bg-gray-100 px-1 text-xs">/o/your-slug</code>), assign org admins,
                  and manage each club&apos;s settings from one place.
                </p>
              </div>
              <Link
                href={organizationsHref}
                className="inline-flex shrink-0 items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Manage organizations
              </Link>
            </div>
          </div>
        )}

        <div className="mb-6 max-w-6xl">
          <RegattaCalendar
            regattas={regattas}
            regattaLinkPrefix="/admin/manage-regattas"
            regattaLinkSuffix={regattaLinkSuffix}
            uiVariant="admin"
            labels={{
              noRegattas: 'No regattas in this month.',
              viewButton: 'View Info',
              addRegatta: 'Add Regatta',
              statusOpen: 'Registrations open',
              statusClosed: 'Registrations closed',
            }}
          />
        </div>
      </main>
    </div>
  );
}
