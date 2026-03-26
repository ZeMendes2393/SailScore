'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { RegattaCalendar } from '@/components/regatta-calendar/RegattaCalendar';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { useAdminOrg, withOrg } from '@/lib/useAdminOrg';
import { apiGet } from '@/lib/api';

interface Regatta {
  id: number;
  name: string;
  location: string;
  start_date: string;
  end_date: string;
  online_entry_open?: boolean;
  class_names?: string[];
}

export default function ManageRegattasPage() {
  const [regattas, setRegattas] = useState<Regatta[]>([]);
  const { token } = useAuth();
  const { orgSlug } = useAdminOrg();

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const data = await apiGet<Regatta[]>(withOrg('/regattas/', orgSlug), token);
        setRegattas(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error fetching regattas:', err);
      }
    })();
  }, [token, orgSlug]);

  const regattaLinkSuffix = orgSlug ? `?org=${encodeURIComponent(orgSlug)}` : '';
  const backHref = withOrg('/admin', orgSlug);

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />

      {/* Main content */}
      <main className="flex-1 p-10 bg-gray-50">
        <div className="mb-4">
          <Link href={backHref} className="text-sm text-blue-600 hover:underline">
            ← Back to Dashboard
          </Link>
        </div>
        <h1 className="text-3xl font-bold mb-6">Regattas</h1>

        <RegattaCalendar
          regattas={regattas}
          regattaLinkPrefix="/admin/manage-regattas"
          regattaLinkSuffix={regattaLinkSuffix}
          labels={{
            noRegattas: 'No regattas in this month.',
            viewButton: 'View Info',
            addRegatta: 'Add Regatta',
            statusOpen: 'Registrations open',
            statusClosed: 'Registrations closed',
          }}
        />
      </main>
    </div>
  );
}
