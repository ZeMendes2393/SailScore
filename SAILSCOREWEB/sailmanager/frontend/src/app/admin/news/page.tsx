'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { apiGet, apiDelete } from '@/lib/api';

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
  const { token, logout } = useAuth();

  const fetchNews = async () => {
    try {
      const data = await apiGet<NewsItem[]>(`/news/`, token ?? undefined);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Erro ao carregar news:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchNews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleDelete = async (id: number) => {
    if (!confirm('Eliminar esta notícia?')) return;
    try {
      await apiDelete(`/news/${id}`, token ?? undefined);
      setItems((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error('Erro ao eliminar:', err);
      alert('Erro ao eliminar.');
    }
  };

  const formatDate = (s: string) => {
    try {
      const d = new Date(s);
      return d.toLocaleDateString('pt-PT', {
        day: 'numeric',
        month: 'short',
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

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-white border-r p-6 space-y-4 shadow-sm">
        <h2 className="text-xl font-bold mb-6">ADMIN DASHBOARD</h2>
        <nav className="flex flex-col space-y-2">
          <Link href="/admin" className="hover:underline">
            Dashboard
          </Link>
          <Link href="/admin/manage-regattas" className="hover:underline">
            Regattas
          </Link>
          <Link href="/admin/news" className="hover:underline font-semibold text-blue-600">
            News
          </Link>
          <Link href="/admin/manage-users" className="hover:underline">
            Users
          </Link>
          <Link href="/admin/manage-protests" className="hover:underline">
            Protests
          </Link>
          <Link href="/admin/settings" className="hover:underline">
            Settings
          </Link>
        </nav>
        <button
          onClick={() => {
            logout();
            window.location.href = '/';
          }}
          className="mt-6 text-sm text-red-600 hover:underline"
        >
          Terminar sessão
        </button>
      </aside>

      <main className="flex-1 p-10 bg-gray-50">
        <div className="mb-4">
          <Link href="/admin" className="text-sm text-blue-600 hover:underline">
            ← Back to Dashboard
          </Link>
        </div>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">News</h1>
          <Link
            href="/admin/news/new"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Add news
          </Link>
        </div>

        {loading ? (
          <p className="text-gray-500">A carregar…</p>
        ) : items.length === 0 ? (
          <div className="bg-white border rounded-lg p-8 text-center text-gray-500">
            Ainda não há notícias. Clica em &quot;Add news&quot; para criar a primeira.
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
                    {n.category && (
                      <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-gray-600">
                        {n.category}
                      </span>
                    )}
                  </div>
                  <h2 className="font-semibold text-gray-900 truncate">{n.title}</h2>
                  {n.excerpt && <p className="text-sm text-gray-600 mt-1 line-clamp-2">{n.excerpt}</p>}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/admin/news/${n.id}/edit`}
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