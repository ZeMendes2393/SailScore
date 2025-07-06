"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// Tipos
interface Regatta {
  id: number;
  name: string;
  location: string;
  start_date: string;
  end_date: string;
  status?: string;
}

export default function HomePage() {
  const [regattas, setRegattas] = useState<Regatta[]>([]);

  useEffect(() => {
    const fetchRegattas = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/regattas/");
        const data = await res.json();
        console.log("✅ Regatas:", data);
        setRegattas(data);
      } catch (err) {
        console.error("❌ Erro ao buscar regatas:", err);
      }
    };
    fetchRegattas();
  }, []);

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Barra de navegação */}
      <nav className="flex justify-between items-center px-8 py-4 bg-white shadow-md">
        <div className="text-2xl font-bold text-blue-700">SailScore</div>
        <ul className="flex space-x-6 text-sm font-medium">
          <li><Link href="/">Home</Link></li>
          <li><Link href="/calendar">Calendar</Link></li>
          <li><Link href="/results">Results</Link></li>
          <li><Link href="/news">News</Link></li>
        </ul>
        <Link href="/login">
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow">Sailor Account</button>
        </Link>
      </nav>

      {/* Hero Banner */}
      <section className="text-center py-12 bg-[url('/public/waves.jpg')] bg-cover bg-center">
        <h1 className="text-4xl font-bold text-white drop-shadow mb-4">Regatta Management & Results</h1>
        <p className="text-white text-lg drop-shadow">Track, participate and follow the world of sailing competitions.</p>
      </section>

      {/* Lista de Regatas */}
      <section className="px-8 py-12">
        <div className="bg-white shadow rounded p-6">
          <h2 className="text-xl font-semibold mb-4">Upcoming Regattas</h2>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2">Name</th>
                <th>Dates</th>
                <th>Location</th>
                <th>Status</th>
                <th></th>
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
                      {regatta.status || "Scheduled"}
                    </span>
                  </td>
                  <td>
                    <Link href={`/regattas/${regatta.id}`}>
                      <button className="text-sm bg-gray-800 text-white px-3 py-1 rounded hover:bg-gray-700">
                        More Info
                      </button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
