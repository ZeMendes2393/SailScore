'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
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

export default function AdminPage() {
  const [regattas, setRegattas] = useState<Regatta[]>([]);
  const { logout } = useAuth();
  const router = useRouter();

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

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r p-6 space-y-4 shadow-sm">
        <h2 className="text-xl font-bold mb-6">ADMIN DASHBOARD</h2>
        <nav className="flex flex-col space-y-2">
          <Link href="/admin" className="hover:underline">Dashboard</Link>
          <Link href="/admin/manage-regattas" className="hover:underline">Regattas</Link>
          <Link href="/admin/news" className="hover:underline">News</Link>
          <Link href="/admin/manage-users" className="hover:underline">Users</Link>
          <Link href="/admin/manage-protests" className="hover:underline">Protests</Link>
          <Link href="/admin/settings" className="hover:underline">Settings</Link>
        </nav>

        <button onClick={handleLogout} className="mt-6 text-sm text-red-600 hover:underline">
          Terminar sessão
        </button>
      </aside>

      {/* Conteúdo principal */}
      <main className="flex-1 p-10 bg-gray-50">
        <h1 className="text-3xl font-bold mb-6">Overview</h1>

        <div className="mb-6">
          <RegattaCalendar
            regattas={regattas}
            regattaLinkPrefix="/admin/manage-regattas"
            addRegattaHref="/admin/create-regatta"
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
