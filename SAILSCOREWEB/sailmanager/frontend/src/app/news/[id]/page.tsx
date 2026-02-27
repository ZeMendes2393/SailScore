'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Linkify from 'linkify-react';

interface NewsItem {
  id: number;
  title: string;
  published_at: string;
  excerpt: string | null;
  body: string | null; // texto normal
  image_url: string | null;
  category: string | null;
  created_at: string;
  updated_at: string;
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://127.0.0.1:8000';

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
      } catch {
        setError('Notícia não encontrada.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const formatDate = (s: string) => {
    try {
      return new Date(s).toLocaleDateString('pt-PT', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return s;
    }
  };

  const imageSrc = (url: string | null) => {
    if (!url) return null;
    return url.startsWith('http') ? url : `${API_BASE}${url}`;
  };

  const paragraphs = useMemo(() => {
    const text = item?.body?.trim();
    if (!text) return [];
    return text
      .split(/\n\s*\n/g)
      .map((p) => p.trim())
      .filter(Boolean);
  }, [item?.body]);

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
        <Link href="/news" className="mt-4 inline-block text-blue-600 hover:underline">
          ← Back to News
        </Link>
      </div>
    );
  }

  return (
    <article className="container-page py-8 max-w-3xl">
      <Link href="/news" className="text-sm text-blue-600 hover:underline mb-6 inline-block">
        ← Back to News
      </Link>

      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-sm text-gray-500">{formatDate(item.published_at)}</span>
          {item.category && (
            <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-gray-600">
              {item.category}
            </span>
          )}
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">{item.title}</h1>
      </header>

      {/* ✅ Solução 2: imagem sem forçar aspect ratio */}
      {item.image_url && (
        <div className="rounded-2xl overflow-hidden bg-gray-100 border mb-8">
          <img
            src={imageSrc(item.image_url) ?? ''}
            alt=""
            className="w-full h-auto object-contain"
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
        </div>
      )}

      {paragraphs.length > 0 ? (
        <div className="prose prose-lg max-w-none text-gray-700">
          {paragraphs.map((p, idx) => (
            <p key={idx}>
              <Linkify
                options={{
                  target: '_blank',
                  rel: 'noopener noreferrer',
                  attributes: {
                    class: 'text-blue-600 underline hover:text-blue-700',
                  },
                }}
              >
                {p}
              </Linkify>
            </p>
          ))}
        </div>
      ) : item.excerpt ? (
        <p className="text-lg text-gray-700">{item.excerpt}</p>
      ) : null}
    </article>
  );
}