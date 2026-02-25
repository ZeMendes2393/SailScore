'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

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

export default function NewsDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [item, setItem] = useState<NewsItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/news/${id}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Not found');
        const data = (await res.json()) as NewsItem;
        setItem(data);
      } catch (err) {
        setError('Notícia não encontrada.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const formatDate = (s: string) => {
    try {
      return new Date(s).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return s;
    }
  };

  const imageSrc = (url: string | null) => {
    if (!url) return null;
    return url.startsWith('http') ? url : `${API_BASE}${url}`;
  };

  if (loading) {
    return (
      <div className="container-page py-8">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="container-page py-8">
        <p className="text-red-600">{error ?? 'Not found.'}</p>
        <Link href="/news" className="mt-4 inline-block text-blue-600 hover:underline">← Back to News</Link>
      </div>
    );
  }

  return (
    <article className="container-page py-8 max-w-3xl">
      <Link href="/news" className="text-sm text-blue-600 hover:underline mb-6 inline-block">
        ← Back to News
      </Link>

      <header className="mb-6">
        <p className="flex items-center gap-1.5 text-sm text-red-600 font-medium mb-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          {formatDate(item.published_at)}
        </p>
        {item.category && (
          <p className="flex items-center gap-1.5 text-sm text-gray-500 mb-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
            {item.category}
          </p>
        )}
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">{item.title}</h1>
      </header>

      {item.image_url && (
        <div className="aspect-video rounded-xl overflow-hidden bg-gray-200 mb-8">
          <img
            src={imageSrc(item.image_url) ?? ''}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {item.body ? (
        <div
          className="prose prose-lg max-w-none text-gray-700"
          dangerouslySetInnerHTML={{ __html: item.body }}
        />
      ) : item.excerpt ? (
        <p className="text-lg text-gray-700">{item.excerpt}</p>
      ) : null}
    </article>
  );
}
