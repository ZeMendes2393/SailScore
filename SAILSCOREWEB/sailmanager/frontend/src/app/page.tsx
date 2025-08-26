"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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
    (async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/regattas/");
        const data = await res.json();
        setRegattas(data);
      } catch (err) {
        console.error("Erro ao buscar regatas:", err);
      }
    })();
  }, []);

  return (
    <>
      {/* HERO full-width */}
      <section className="relative w-full text-center py-28 bg-[url('/waves.jpg')] bg-cover bg-center text-white">
        {/* Overlay azul escuro com gradiente */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-blue-900/80"></div>

        <div className="relative z-10">
          <h1 className="text-5xl font-extrabold mb-4 drop-shadow-lg">
            Regatta Management & Results
          </h1>
          <p className="text-lg opacity-90 drop-shadow">
            Track, participate and follow the world of sailing competitions.
          </p>
        </div>
      </section>

      {/* Secção cinzenta com regatas */}
      <section className="bg-gray-50 py-16">
        <div className="container-page">
          <div className="bg-white shadow rounded-lg p-8">
            <h2 className="text-2xl font-semibold mb-6">Upcoming Regattas</h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b bg-gray-100 text-gray-600">
                    <th className="py-3 px-2">Name</th>
                    <th className="px-2">Dates</th>
                    <th className="px-2">Location</th>
                    <th className="px-2">Status</th>
                    <th className="px-2" />
                  </tr>
                </thead>
                <tbody>
                  {regattas.map((regatta) => (
                    <tr key={regatta.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-2 font-medium">{regatta.name}</td>
                      <td className="px-2">
                        {regatta.start_date} – {regatta.end_date}
                      </td>
                      <td className="px-2">{regatta.location}</td>
                      <td className="px-2">
                        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium">
                          {regatta.status || "Scheduled"}
                        </span>
                      </td>
                      <td className="px-2">
                        <Link href={`/regattas/${regatta.id}`}>
                          <button className="text-xs bg-gray-800 text-white px-3 py-1 rounded hover:bg-gray-700 transition">
                            More Info
                          </button>
                        </Link>
                      </td>
                    </tr>
                  ))}

                  {regattas.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-gray-500">
                        No regattas yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
