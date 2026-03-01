'use client';

import { useEffect, useState } from 'react';
import { RegattaCalendar } from '@/components/regatta-calendar/RegattaCalendar';

interface Regatta {
  id: number;
  name: string;
  location: string;
  start_date: string;
  end_date: string;
  online_entry_open?: boolean;
  class_names?: string[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://127.0.0.1:8000';

export default function CalendarPage() {
  const [regattas, setRegattas] = useState<Regatta[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/regattas/`, { cache: 'no-store' });
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as Regatta[];
        setRegattas(data);
      } catch (err) {
        console.error('Failed to fetch regattas:', err);
      }
    })();
  }, []);

  return (
    <div className="py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Calendar</h1>
        <p className="text-gray-600 mt-2">
          Browse regattas by month and year.
        </p>
      </div>

      <div className="max-w-4xl">
        <RegattaCalendar
          regattas={regattas}
          regattaLinkPrefix="/regattas"
          labels={{
            noRegattas: 'No regattas in this month.',
            viewButton: 'View',
            statusOpen: 'Registrations open',
            statusClosed: 'Registrations closed',
          }}
        />
      </div>
    </div>
  );
}
