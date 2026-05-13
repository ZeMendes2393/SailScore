'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { apiGet, apiSend, apiUpload, apiDelete, BASE_URL } from '@/lib/api';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { useAdminOrg, withOrg } from '@/lib/useAdminOrg';
import notify from '@/lib/notify';
import { useConfirm } from '@/components/ConfirmDialog';

type Sponsor = {
  id: number;
  regatta_id: number | null;
  category: string;
  image_url: string;
  link_url: string | null;
  sort_order: number;
};

export default function AdminSponsorsPage() {
  const { token } = useAuth();
  const { orgSlug } = useAdminOrg();
  const confirm = useConfirm();
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [newCategory, setNewCategory] = useState('');
  const [useNewCategory, setUseNewCategory] = useState(false);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState('');

  const fetchSponsors = async () => {
    try {
      const data = await apiGet<Sponsor[]>(withOrg('/sponsors', orgSlug), token ?? undefined);
      setSponsors(Array.isArray(data) ? data : []);
    } catch {
      setSponsors([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSponsors();
  }, [orgSlug, token]);

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      notify.warning('Invalid format. Use JPG, PNG or WebP.');
      return;
    }
    setUploadingImage(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const data = await apiUpload<{ url: string }>('/uploads/sponsors', form, token);
      setNewImageUrl(data.url);
      e.target.value = '';
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : 'Error uploading image.');
    } finally {
      setUploadingImage(false);
    }
  };

  const existingCategories = [...new Set(sponsors.map((s) => s.category).filter(Boolean))].sort();
  const hasExistingCategories = existingCategories.length > 0;
  const effectiveCategory = !hasExistingCategories
    ? newCategory.trim()
    : useNewCategory
      ? newCategory.trim()
      : selectedCategory.trim();

  const handleAddSponsor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !effectiveCategory || !newImageUrl) {
      notify.warning('Choose or create a category and upload an image.');
      return;
    }
    setSaving(true);
    try {
      await apiSend(
        withOrg('/sponsors', orgSlug),
        'POST',
        {
          category: effectiveCategory,
          image_url: newImageUrl,
          link_url: newLinkUrl.trim() || null,
          sort_order: sponsors.length,
        },
        token
      );
      setNewLinkUrl('');
      setNewImageUrl('');
      setNewCategory('');
      setUseNewCategory(false);
      setSelectedCategory(effectiveCategory);
      fetchSponsors();
      notify.success('Sponsor added.');
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : 'Error adding sponsor.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSponsor = async (sponsorId: number) => {
    if (!token) return;
    const ok = await confirm({
      title: 'Remove this sponsor?',
      description: 'The sponsor will no longer appear on the homepage, calendar, news and all regattas.',
      tone: 'danger',
      confirmLabel: 'Remove sponsor',
    });
    if (!ok) return;
    setSaving(true);
    try {
      await apiDelete(withOrg(`/sponsors/${sponsorId}`, orgSlug), token);
      fetchSponsors();
      notify.success('Sponsor removed.');
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : 'Error removing sponsor.');
    } finally {
      setSaving(false);
    }
  };

  const imageSrc = (url: string) => (url.startsWith('http') ? url : `${BASE_URL}${url}`);
  const byCategory = sponsors.reduce<Record<string, Sponsor[]>>((acc, s) => {
    const cat = s.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />

      <main className="flex-1 px-4 sm:px-6 py-8 bg-gray-50">
        <div className="mb-4">
          <Link href={withOrg('/admin', orgSlug)} className="text-sm text-blue-600 hover:underline">
            ← Back to Dashboard
          </Link>
        </div>
        <h1 className="text-3xl font-bold mb-2">Sponsors</h1>
        <p className="text-gray-600 mb-8">
          Sponsors added here appear on the <strong>homepage</strong>, <strong>calendar</strong>, <strong>news</strong> and in <strong>all regattas</strong>. For regatta-specific sponsors only, use the Sponsors section within each regatta.
        </p>

        <div className="max-w-3xl space-y-8">
          <form
            onSubmit={handleAddSponsor}
            className="border rounded-lg p-6 bg-white shadow-sm space-y-4"
          >
            <h2 className="text-xl font-semibold text-gray-800">Add global sponsor</h2>

            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              {!hasExistingCategories ? (
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  placeholder="e.g. Official sponsors, Partners"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                />
              ) : (
                <div className="space-y-3">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="globalSponsorCategoryMode"
                      className="mt-1"
                      checked={!useNewCategory}
                      onChange={() => {
                        setUseNewCategory(false);
                        setNewCategory('');
                      }}
                    />
                    <span className="flex-1 space-y-2">
                      <span className="block text-sm text-gray-800">Existing category</span>
                      {!useNewCategory && (
                        <select
                          className="w-full border rounded px-3 py-2"
                          value={selectedCategory}
                          onChange={(e) => setSelectedCategory(e.target.value)}
                        >
                          <option value="">— Choose category —</option>
                          {existingCategories.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      )}
                    </span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="globalSponsorCategoryMode"
                      className="mt-1"
                      checked={useNewCategory}
                      onChange={() => {
                        setUseNewCategory(true);
                        setSelectedCategory('');
                      }}
                    />
                    <span className="flex-1 space-y-2">
                      <span className="block text-sm text-gray-800">New category</span>
                      {useNewCategory && (
                        <input
                          type="text"
                          className="w-full border rounded px-3 py-2"
                          placeholder="e.g. Official sponsors, Partners"
                          value={newCategory}
                          onChange={(e) => setNewCategory(e.target.value)}
                        />
                      )}
                    </span>
                  </label>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Logo (image)</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleUploadImage}
                disabled={uploadingImage}
                className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700"
              />
              {newImageUrl && (
                <div className="mt-2 flex items-center gap-3">
                  <img
                    src={imageSrc(newImageUrl)}
                    alt="Preview"
                    className="h-12 object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => setNewImageUrl('')}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Link (URL) — optional</label>
              <input
                type="url"
                className="w-full border rounded px-3 py-2"
                placeholder="https://..."
                value={newLinkUrl}
                onChange={(e) => setNewLinkUrl(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={saving || !effectiveCategory || !newImageUrl}
              className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Add'}
            </button>
          </form>

          {loading ? (
            <p className="text-gray-500">Loading…</p>
          ) : sponsors.length > 0 ? (
            <div className="border rounded-lg p-6 bg-white shadow-sm">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Global sponsors</h2>
              <div className="space-y-8">
                {Object.entries(byCategory).map(([category, items]) => (
                  <div key={category}>
                    <h3 className="text-sm font-semibold text-blue-700 uppercase tracking-wider mb-2">
                      {category}
                    </h3>
                    <div className="flex flex-wrap gap-4">
                      {items.map((s) => (
                        <div
                          key={s.id}
                          className="relative group border rounded p-3 bg-gray-50"
                        >
                          <img
                            src={imageSrc(s.image_url)}
                            alt={category}
                            className="max-h-16 max-w-[120px] object-contain"
                          />
                          {s.link_url && (
                            <p
                              className="text-xs text-gray-500 mt-1 truncate max-w-[120px]"
                              title={s.link_url}
                            >
                              → {s.link_url}
                            </p>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteSponsor(s.id)}
                            disabled={saving}
                            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs opacity-0 group-hover:opacity-100 transition"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-gray-500">No global sponsors yet. Add one above.</p>
          )}
        </div>
      </main>
    </div>
  );
}
