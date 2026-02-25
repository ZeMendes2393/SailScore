'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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

interface NewsItem {
  id: number;
  title: string;
  published_at: string;
  excerpt: string | null;
  body: string | null;
  image_url: string | null;
  category: string | null;
  created_at: string;
  updated_at: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://127.0.0.1:8000';

export default function HomePage() {
  const [regattas, setRegattas] = useState<Regatta[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);

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

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/news/`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as NewsItem[];
        setNews(Array.isArray(data) ? data.slice(0, 6) : []);
      } catch (err) {
        console.error('Erro ao buscar news:', err);
      }
    })();
  }, []);

  const formatNewsDate = (s: string) => {
    try {
      return new Date(s).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return s;
    }
  };

  const newsImageSrc = (url: string | null) => {
    if (!url) return null;
    return url.startsWith('http') ? url : `${API_BASE}${url}`;
  };

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

      {/* News */}
      {news.length > 0 && (
        <section className="bg-white py-16 border-t">
          <div className="container-page">
            <h2 className="text-3xl font-bold mb-8 text-gray-900">News</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {news.map((item) => (
                <Link
                  key={item.id}
                  href={`/news/${item.id}`}
                  className="group bg-white border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="aspect-[16/10] bg-gray-200 overflow-hidden">
                    {item.image_url ? (
                      <img
                        src={newsImageSrc(item.image_url) ?? ''}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="flex items-center gap-1.5 text-xs text-red-600 font-medium mb-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      {formatNewsDate(item.published_at)}
                    </p>
                    {item.category && (
                      <p className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                        {item.category}
                      </p>
                    )}
                    <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                      {item.title}
                    </h3>
                    {item.excerpt && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{item.excerpt}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
            <div className="mt-8 text-center">
              <Link href="/news" className="text-blue-600 font-medium hover:underline">
                View all news →
              </Link>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
