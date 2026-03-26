'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { apiGet, apiDelete } from '@/lib/api';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { useAdminOrg, withOrg } from '@/lib/useAdminOrg';

export type NewsItem = {
  id: number;
  title: string;
  published_at: string;
  excerpt: string | null;
  body: string | null;
  image_url: string | null;
  category: string | null;
  created_at: string;
  updated_at: string;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://127.0.0.1:8000';

export default function AdminNewsPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { token } = useAuth();
  const { orgSlug } = useAdminOrg();

  const fetchNews = async () => {
    try {
      const data = await apiGet<NewsItem[]>(withOrg('/news/', orgSlug), token ?? undefined);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load news:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchNews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, orgSlug]);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this news item?')) return;
    try {
      await apiDelete(withOrg(`/news/${id}`, orgSlug), token ?? undefined);
      setItems((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error('Failed to delete news item:', err);
      alert('Failed to delete news item.');
    }
  };

  const formatDate = (s: string) => {
    try {
      const d = new Date(s);
      return d.toLocaleDateString('en-GB', {
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
    const text = body
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) return null;
    if (text.length <= maxLen) return text;
    return `${text.slice(0, maxLen - 1)}…`;
  };

  const imageSrc = (url: string | null) => {
    if (!url) return null;
    return url.startsWith('http') ? url : `${API_BASE}${url}`;
  };

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />

      <main className="flex-1 p-10 bg-gray-50">
        <div className="mb-4">
          <Link href={withOrg('/admin', orgSlug)} className="text-sm text-blue-600 hover:underline">
            ← Back to dashboard
          </Link>
        </div>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">News</h1>
          <Link
            href={withOrg('/admin/news/new', orgSlug)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Add news
          </Link>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading news…</p>
        ) : items.length === 0 ? (
          <div className="bg-white border rounded-lg p-8 text-center text-gray-500">
            There are no news items yet. Click &quot;Add news&quot; to create the first one.
          </div>
        ) : (
          <ul className="space-y-4">
            {items.map((n) => (
              <li
                key={n.id}
                className="bg-white border rounded-lg p-4 flex items-start justify-between gap-4 shadow-sm"
              >
                <div className="flex-1 min-w-0">
                  {n.image_url && (
                    <img
                      src={imageSrc(n.image_url) ?? ''}
                      alt=""
                      className="w-24 h-24 object-cover rounded mb-2"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  )}
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-xs text-gray-500">{formatDate(n.published_at)}</span>
                  </div>
                  <h2 className="font-semibold text-gray-900 truncate">{n.title}</h2>
                  {bodyToSnippet(n.body, 140) && (
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {bodyToSnippet(n.body, 140)}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={withOrg(`/admin/news/${n.id}/edit`, orgSlug)}
                    className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(n.id)}
                    className="px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}