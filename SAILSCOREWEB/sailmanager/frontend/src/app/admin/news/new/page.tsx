'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiPost } from '@/lib/api';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { useAdminOrg, withOrg } from '@/lib/useAdminOrg';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://127.0.0.1:8000';

export default function NewNewsPage() {
  const router = useRouter();
  const { token } = useAuth();
  const { orgSlug } = useAdminOrg();

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [publishedAt, setPublishedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [imageUrl, setImageUrl] = useState(''); // "/uploads/news/xxx.jpg"
  const [body, setBody] = useState(''); // texto normal

  const uploadImage = async (file: File) => {
    const form = new FormData();
    form.append('file', file);

    const res = await fetch(`${API_BASE}/uploads/news`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });

    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return data.url as string;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Title is required.');
      return;
    }

    setSaving(true);
    try {
      await apiPost(
        withOrg('/news/', orgSlug),
        {
          title: title.trim(),
          published_at: publishedAt ? `${publishedAt}T12:00:00Z` : undefined,
          image_url: imageUrl || undefined,
          body: body.trim() || undefined,
        },
        token ?? undefined
      );
      router.push(withOrg('/admin/news', orgSlug));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />

      <main className="flex-1 px-4 sm:px-6 py-8 bg-gray-50 overflow-auto">
        <div className="mb-4">
          <Link href={withOrg('/admin/news', orgSlug)} className="text-sm text-blue-600 hover:underline">
            ← Back to News
          </Link>
        </div>
        <h1 className="text-3xl font-bold mb-6">Add news</h1>

        <form onSubmit={handleSubmit} className="max-w-2xl space-y-6 bg-white border rounded-lg p-6 shadow-sm">
          {error && <div className="p-3 rounded bg-red-50 text-red-700 text-sm">{error}</div>}

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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-1">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                lang="en-GB"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>

          {/* ✅ Upload mais claro */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Featured image</label>

            <label className="group flex cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-gray-700 hover:bg-gray-100 hover:border-gray-400 transition">
              <svg
                className="h-6 w-6 text-gray-500 group-hover:text-gray-700 transition"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5 5 5M12 5v11" />
              </svg>

              <div className="text-sm">
                <span className="font-medium">Click to upload</span>
                <span className="text-gray-500"> (PNG, JPG, WebP — max 6MB)</span>
              </div>

              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  setError(null);
                  setUploading(true);
                  try {
                    const url = await uploadImage(file);
                    setImageUrl(url);
                  } catch (err: any) {
                    setError(err?.message ?? 'Upload failed.');
                  } finally {
                    setUploading(false);
                  }
                }}
              />
            </label>

            {uploading && <p className="text-sm text-gray-500 mt-2">Uploading image…</p>}

            {imageUrl && (
              <div className="mt-3">
                <img
                  src={`${API_BASE}${imageUrl}`}
                  alt="Preview"
                  className="max-h-56 w-full rounded-xl object-cover border"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Body (plain text)</label>
            <p className="text-xs text-gray-500 mb-2">
              You can paste links (https://...). They will be clickable automatically on the public site.
            </p>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              className="w-full border rounded px-3 py-2"
              placeholder="Write the news text here..."
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving || uploading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save news'}
            </button>
            <Link href={withOrg('/admin/news', orgSlug)} className="px-4 py-2 border rounded hover:bg-gray-50">
              Cancel
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}