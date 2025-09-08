'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

interface Regatta {
  id: number;
  name: string;
  location: string;
  start_date: string;
  end_date: string;
  status?: string;
}

export default function AdminPage() {
  const [regattas, setRegattas] = useState<Regatta[]>([]);
  const { logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/regattas/', { cache: 'no-store' });
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

        <div className="bg-white shadow rounded p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Regatta Management</h2>
            <Link
              href="/admin/create-regatta"
              className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700"
            >
              Add Regatta
            </Link>
          </div>

          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2">Name</th>
                <th>Dates</th>
                <th>Location</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {regattas.map((regatta) => (
                <tr key={regatta.id} className="border-b">
                  <td className="py-2 font-medium">{regatta.name}</td>
                  <td>{regatta.start_date} – {regatta.end_date}</td>
                  <td>{regatta.location}</td>
                  <td>
                    <span className="bg-blue-200 text-blue-800 px-2 py-1 rounded text-xs">
                      {regatta.status || 'Scheduled'}
                    </span>
                  </td>
                  <td className="text-right">
                    <Link
                      href={`/admin/manage-regattas/${regatta.id}`}
                      className="text-sm bg-gray-800 text-white px-3 py-1 rounded hover:bg-gray-700"
                    >
                      Ver Info
                    </Link>
                  </td>
                </tr>
              ))}

              {regattas.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500">
                    Ainda não existem regatas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
