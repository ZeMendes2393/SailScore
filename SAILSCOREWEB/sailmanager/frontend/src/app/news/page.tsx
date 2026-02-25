'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

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

export default function NewsListPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/news/`, { cache: 'no-store' });
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as NewsItem[];
        setNews(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
        setNews([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const formatDate = (s: string) => {
    try {
      return new Date(s).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return s;
    }
  };

  const imageSrc = (url: string | null) => {
    if (!url) return null;
    return url.startsWith('http') ? url : `${API_BASE}${url}`;
  };

  return (
    <div className="container-page py-8">
      <h1 className="text-4xl font-bold text-gray-900 mb-8">News</h1>

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : news.length === 0 ? (
        <p className="text-gray-500">No news yet.</p>
      ) : (
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
                    src={imageSrc(item.image_url) ?? ''}
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
                  {formatDate(item.published_at)}
                </p>
                {item.category && (
                  <p className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                    {item.category}
                  </p>
                )}
                <h2 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                  {item.title}
                </h2>
                {item.excerpt && (
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">{item.excerpt}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
