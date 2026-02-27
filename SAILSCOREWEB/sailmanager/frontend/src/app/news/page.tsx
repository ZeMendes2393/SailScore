'use client';

import { useEffect, useMemo, useState } from 'react';
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

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://127.0.0.1:8000';

const PAGE_SIZE = 12;

export default function NewsListPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const imageSrc = (url: string | null) => {
    if (!url) return null;
    return url.startsWith('http') ? url : `${API_BASE}${url}`;
  };

  const formatDate = (s: string) => {
    try {
      return new Date(s).toLocaleDateString('pt-PT', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return s;
    }
  };

  const fetchPage = async (offset: number) => {
    const res = await fetch(`${API_BASE}/news/?limit=${PAGE_SIZE}&offset=${offset}`, {
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(await res.text());
    const data = (await res.json()) as NewsItem[];
    return Array.isArray(data) ? data : [];
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const first = await fetchPage(0);
        setNews(first);
        setHasMore(first.length === PAGE_SIZE);
      } catch (err) {
        console.error(err);
        setNews([]);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = await fetchPage(news.length);
      setNews((prev) => [...prev, ...next]);
      setHasMore(next.length === PAGE_SIZE);
    } catch (err) {
      console.error(err);
      // mantém o que já tens
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  };

  const featured = useMemo(() => (news.length > 0 ? news[0] : null), [news]);
  const rest = useMemo(() => (news.length > 1 ? news.slice(1) : []), [news]);

  return (
    <div className="container-page py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">News</h1>
        <p className="text-gray-600 mt-2">
          Updates, announcements and regatta highlights.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white border rounded-xl overflow-hidden shadow-sm">
              <div className="aspect-[16/10] bg-gray-200 animate-pulse" />
              <div className="p-4 space-y-2">
                <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
                <div className="h-5 w-3/4 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-2/3 bg-gray-200 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : news.length === 0 ? (
        <p className="text-gray-500">No news yet.</p>
      ) : (
        <>
          {/* Featured */}
          {featured && (
            <Link
              href={`/news/${featured.id}`}
              className="group block mb-10 bg-white border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="grid grid-cols-1 md:grid-cols-2">
                <div className="aspect-[16/10] md:aspect-auto bg-gray-200 overflow-hidden">
                  {featured.image_url ? (
                    <img
                      src={imageSrc(featured.image_url) ?? ''}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <svg className="w-20 h-20" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                      </svg>
                    </div>
                  )}
                </div>

                <div className="p-6 md:p-8">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="text-xs text-gray-500">{formatDate(featured.published_at)}</span>
                    {featured.category && (
                      <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-gray-600">
                        {featured.category}
                      </span>
                    )}
                  </div>

                  <h2 className="text-2xl md:text-3xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {featured.title}
                  </h2>

                  {(featured.excerpt || '').trim() && (
                    <p className="text-gray-600 mt-3 line-clamp-3">{featured.excerpt}</p>
                  )}

                  <div className="mt-5 inline-flex items-center text-blue-600 font-medium">
                    Read more <span className="ml-2">→</span>
                  </div>
                </div>
              </div>
            </Link>
          )}

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {rest.map((item) => (
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
                      <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                      </svg>
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-xs text-gray-500">{formatDate(item.published_at)}</span>
                    {item.category && (
                      <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-gray-600">
                        {item.category}
                      </span>
                    )}
                  </div>

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

          {/* Load more */}
          <div className="mt-10 flex justify-center">
            {hasMore ? (
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            ) : (
              <p className="text-sm text-gray-500">You’re all caught up.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}