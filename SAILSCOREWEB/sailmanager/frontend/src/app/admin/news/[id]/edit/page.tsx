'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiGet, apiPatch } from '@/lib/api';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://127.0.0.1:8000';

export default function EditNewsPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);

  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [publishedAt, setPublishedAt] = useState('');
  const [category, setCategory] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [body, setBody] = useState('');

  const resolvedImage = imageUrl
    ? imageUrl.startsWith('http')
      ? imageUrl
      : `${API_BASE}${imageUrl}`
    : '';

  useEffect(() => {
    if (!id || isNaN(id)) {
      setLoading(false);
      return;
    }
    if (!token) return;

    (async () => {
      try {
        const item = await apiGet<{
          title: string;
          published_at: string;
          category: string | null;
          excerpt: string | null;
          image_url: string | null;
          body: string | null;
        }>(`/news/${id}`, token ?? undefined);

        setTitle(item.title ?? '');
        setPublishedAt(item.published_at ? item.published_at.slice(0, 10) : '');
        setCategory(item.category ?? '');
        setExcerpt(item.excerpt ?? '');
        setImageUrl(item.image_url ?? '');
        setBody(item.body ?? '');
      } catch (err) {
        console.error(err);
        setError('Notícia não encontrada.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('O título é obrigatório.');
      return;
    }

    setSaving(true);
    try {
      await apiPatch(
        `/news/${id}`,
        {
          title: title.trim(),
          published_at: publishedAt ? `${publishedAt}T12:00:00Z` : undefined,
          category: category.trim() || undefined,
          excerpt: excerpt.trim() || undefined,
          image_url: imageUrl.trim() || undefined,
          body: body.trim() || undefined,
        },
        token ?? undefined
      );
      router.push('/admin/news');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao guardar.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">A carregar…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-white border-r p-6 space-y-4 shadow-sm">
        <h2 className="text-xl font-bold mb-6">ADMIN DASHBOARD</h2>
        <nav className="flex flex-col space-y-2">
          <Link href="/admin" className="hover:underline">Dashboard</Link>
          <Link href="/admin/manage-regattas" className="hover:underline">Regattas</Link>
          <Link href="/admin/news" className="hover:underline font-semibold text-blue-600">News</Link>
          <Link href="/admin/manage-users" className="hover:underline">Users</Link>
          <Link href="/admin/manage-protests" className="hover:underline">Protests</Link>
          <Link href="/admin/design" className="hover:underline">Design</Link>
          <Link href="/admin/settings" className="hover:underline">Settings</Link>
        </nav>
        <Link href="/admin/news" className="mt-6 inline-block text-sm text-blue-600 hover:underline">
          ← News
        </Link>
      </aside>

      <main className="flex-1 p-10 bg-gray-50 overflow-auto">
        <div className="mb-4">
          <Link href="/admin/news" className="text-sm text-blue-600 hover:underline">
            ← Back to News
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-6">Edit news</h1>

        <form onSubmit={handleSubmit} className="max-w-2xl space-y-6 bg-white border rounded-lg p-6 shadow-sm">
          {error && (
            <div className="p-3 rounded bg-red-50 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Excerpt (for card listing)</label>
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              rows={3}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
            {imageUrl && (
              <div className="mt-2">
                <img
                  src={resolvedImage}
                  alt="Preview"
                  className="max-h-40 rounded object-cover border"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Body (HTML allowed)</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              className="w-full border rounded px-3 py-2 font-mono text-sm"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <Link href="/admin/news" className="px-4 py-2 border rounded hover:bg-gray-50">
              Cancel
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}