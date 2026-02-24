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

export default function HomePage() {
  const [regattas, setRegattas] = useState<Regatta[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/regattas/`, { cache: 'no-store' });
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as Regatta[];
        setRegattas(data);
      } catch (err) {
        console.error('Erro ao buscar regatas:', err);
      }
    })();
  }, []);

  return (
    <>
      {/* HERO */}
      <section className="relative w-full text-center py-28 bg-[url('/waves.jpg')] bg-cover bg-center text-white">
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-blue-900/80" />
        <div className="relative z-10">
          <h1 className="text-5xl font-extrabold mb-4 drop-shadow-lg">Regatta Management & Results</h1>
          <p className="text-lg opacity-90 drop-shadow">
            Track, participate and follow the world of sailing competitions.
          </p>
        </div>
      </section>

      {/* Regattas Calendar */}
      <section className="bg-gray-50 py-16">
        <div className="container-page">
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
      </section>
    </>
  );
}
