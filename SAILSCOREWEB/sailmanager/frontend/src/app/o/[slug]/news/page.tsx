'use client';

import { useParams } from 'next/navigation';
import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';

import GlobalSponsorsFooter from '@/components/GlobalSponsorsFooter';

interface NewsItem {
  id: number;
  title: string;
  published_at: string;
  excerpt: string | null;
  body: string | null;
  image_url: string | null;
  category: string | null;
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://127.0.0.1:8000';
const PAGE_SIZE = 12;

export default function OrgNewsListPage() {
  const params = useParams();
  const slug = typeof params.slug === 'string' ? params.slug : null;
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const orgParam = slug ? `?org=${encodeURIComponent(slug)}` : '';

  const imageSrc = (url: string | null) =>
    url ? (url.startsWith('http') ? url : `${API_BASE}${url}`) : null;

  const formatDate = (s: string) => {
    try {
      return new Date(s).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return s;
    }
  };

  const bodyToSnippet = (body: string | null | undefined, maxLen: number) => {
    if (!body) return null;
    const text = body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text) return null;
    return text.length <= maxLen ? text : `${text.slice(0, maxLen - 1)}…`;
  };

  const fetchPage = async (offset: number) => {
    const qs = orgParam ? `${orgParam}&` : '?';
    const res = await fetch(
      `${API_BASE}/news${qs}limit=${PAGE_SIZE}&offset=${offset}`,
      { cache: 'no-store' }
    );
    if (!res.ok) throw new Error(await res.text());
    const data = (await res.json()) as NewsItem[];
    return Array.isArray(data) ? data : [];
  };

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        setLoading(true);
        const first = await fetchPage(0);
        setNews(first);
        setHasMore(first.length === PAGE_SIZE);
      } catch {
        setNews([]);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore || !slug) return;
    setLoadingMore(true);
    try {
      const next = await fetchPage(news.length);
      setNews((prev) => [...prev, ...next]);
      setHasMore(next.length === PAGE_SIZE);
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  };

  const featured = useMemo(() => (news.length > 0 ? news[0] : null), [news]);
  const rest = useMemo(() => (news.length > 1 ? news.slice(1) : []), [news]);

  if (!slug) {
    return (
      <div className="py-8 container-page">
        <p className="text-gray-500">Organization not specified.</p>
      </div>
    );
  }

  return (
    <div className="py-8">
      <div className="mb-8">
        <Link href={`/o/${slug}`} className="text-sm text-blue-600 hover:underline mb-4 inline-block">
          ← Back to home
        </Link>
        <h1 className="text-4xl font-bold text-gray-900">News</h1>
        <p className="text-gray-600 mt-2">Updates and highlights.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white border rounded-xl overflow-hidden shadow-sm">
              <div className="aspect-[16/10] bg-gray-200 animate-pulse" />
              <div className="p-4 space-y-2">
                <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
                <div className="h-5 w-3/4 bg-gray-200 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : news.length === 0 ? (
        <p className="text-gray-500">No news yet.</p>
      ) : (
        <>
          {featured && (
            <Link
              href={`/o/${slug}/news/${featured.id}`}
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
                        <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="p-6 md:p-8">
                  <span className="text-xs text-gray-500">{formatDate(featured.published_at)}</span>
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-900 group-hover:text-blue-600 mt-3">
                    {featured.title}
                  </h2>
                  {bodyToSnippet(featured.body, 200) && (
                    <p className="text-gray-600 mt-3 line-clamp-3">{bodyToSnippet(featured.body, 200)}</p>
                  )}
                  <div className="mt-5 inline-flex items-center text-blue-600 font-medium">
                    Read more <span className="ml-2">→</span>
                  </div>
                </div>
              </div>
            </Link>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {rest.map((item) => (
              <Link
                key={item.id}
                href={`/o/${slug}/news/${item.id}`}
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
                        <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <span className="text-xs text-gray-500">{formatDate(item.published_at)}</span>
                  <h2 className="font-semibold text-gray-900 mt-2 line-clamp-2 group-hover:text-blue-600">
                    {item.title}
                  </h2>
                  {bodyToSnippet(item.body, 120) && (
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{bodyToSnippet(item.body, 120)}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-10 flex justify-center">
            {hasMore ? (
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            ) : null}
          </div>
        </>
      )}
      <GlobalSponsorsFooter orgSlug={slug} />
    </div>
  );
}
