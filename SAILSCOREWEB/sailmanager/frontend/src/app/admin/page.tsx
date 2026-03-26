'use client';

import { useEffect, useState } from 'react';
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

export default function AdminPage() {
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

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />

      <main className="flex-1 p-10 bg-gray-50">
        <h1 className="text-3xl font-bold mb-6">Calendar</h1>

        <div className="mb-6">
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
        </div>
      </main>
    </div>
  );
}
