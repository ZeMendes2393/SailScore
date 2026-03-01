'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiSend, apiUpload, BASE_URL } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

type Sponsor = {
  id: number;
  regatta_id: number | null;
  category: string;
  image_url: string;
  link_url: string | null;
  sort_order: number;
};

export default function AdminSponsorsManager({ regattaId }: { regattaId: number }) {
  const { token } = useAuth();
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [newCategory, setNewCategory] = useState('');
  const [useNewCategory, setUseNewCategory] = useState(false);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [addToAllEvents, setAddToAllEvents] = useState(false);

  const fetchSponsors = async () => {
    try {
      const data = await apiGet<Sponsor[]>(`/regattas/${regattaId}/sponsors`);
      setSponsors(Array.isArray(data) ? data : []);
    } catch {
      setSponsors([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSponsors();
  }, [regattaId]);

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('Invalid format. Use JPG, PNG or WebP.');
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
      alert(err instanceof Error ? err.message : 'Error uploading image.');
    } finally {
      setUploadingImage(false);
    }
  };

  const existingCategories = [...new Set(sponsors.map((s) => s.category).filter(Boolean))] as string[];
  const effectiveCategory = (useNewCategory || existingCategories.length === 0) ? newCategory.trim() : selectedCategory.trim();

  const handleAddSponsor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !effectiveCategory || !newImageUrl) {
      alert('Choose or create a category and upload an image.');
      return;
    }
    setSaving(true);
    try {
      await apiSend(`/regattas/${regattaId}/sponsors`, 'POST', {
        category: effectiveCategory,
        image_url: newImageUrl,
        link_url: newLinkUrl.trim() || null,
        sort_order: sponsors.length,
      }, token);
      setNewLinkUrl('');
      setNewImageUrl('');
      if (useNewCategory) setNewCategory('');
      fetchSponsors();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error adding.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSponsor = async (sponsorId: number) => {
    if (!token || !confirm('Remove this sponsor?')) return;
    setSaving(true);
    try {
      await apiSend(`/regattas/${regattaId}/sponsors/${sponsorId}`, 'DELETE', undefined, token);
      fetchSponsors();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error removing.');
    } finally {
      setSaving(false);
    }
  };

  const imageSrc = (url: string) =>
    url.startsWith('http') ? url : `${BASE_URL}${url}`;

  const globalSponsors = sponsors.filter((s) => s.regatta_id == null);
  const regattaSponsors = sponsors.filter((s) => s.regatta_id != null);
  const byCategory = (items: Sponsor[]) =>
    items.reduce<Record<string, Sponsor[]>>((acc, s) => {
      const cat = s.category || 'Other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(s);
      return acc;
    }, {});

  if (loading) return <p className="text-gray-500">Loading sponsors…</p>;

  return (
    <div className="p-6 bg-white rounded shadow max-w-3xl space-y-8">
      <h2 className="text-xl font-semibold mb-4">Sponsors and Supporters</h2>
      <p className="text-sm text-gray-600 mb-6">
        Add images of sponsors and supporters that appear on the public page. Each image can have a link (URL) that the click leads to.
      </p>

      <form onSubmit={handleAddSponsor} className="border rounded-lg p-5 bg-gray-50 space-y-4">
        <h3 className="font-semibold text-gray-800">Add new sponsor/supporter</h3>
        <div>
          <label className="block text-sm font-medium mb-1">Category</label>
          <div className="space-y-2">
            {existingCategories.length > 0 && (
              <div className="flex items-center gap-2">
                <select
                  className="flex-1 border rounded px-3 py-2"
                  value={useNewCategory ? '__new__' : selectedCategory}
                  onChange={(e) => {
                    const v = e.target.value;
                    setUseNewCategory(v === '__new__');
                    if (v !== '__new__') setSelectedCategory(v);
                  }}
                >
                  <option value="">— Choose existing category —</option>
                  {existingCategories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  <option value="__new__">➕ New category</option>
                </select>
              </div>
            )}
            {(useNewCategory || existingCategories.length === 0) && (
              <input
                type="text"
                className="w-full border rounded px-3 py-2"
                placeholder="e.g. Official Sponsors, Official Partners, Member of"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onFocus={() => setUseNewCategory(true)}
              />
            )}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Logo image</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleUploadImage}
            disabled={uploadingImage}
            className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700"
          />
          {newImageUrl && (
            <div className="mt-2 flex items-center gap-3">
              <img src={imageSrc(newImageUrl)} alt="Preview" className="h-12 object-contain" />
              <button type="button" onClick={() => setNewImageUrl('')} className="text-sm text-red-600 hover:underline">
                Remove
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="addToAllEvents"
            checked={addToAllEvents}
            onChange={(e) => setAddToAllEvents(e.target.checked)}
            className="rounded border-gray-300"
          />
          <label htmlFor="addToAllEvents" className="text-sm font-medium">
            Add to all events
          </label>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Link (URL) — where the click leads (optional)</label>
          <input
            type="url"
            className="w-full border rounded px-3 py-2"
            placeholder="https://example.com"
            value={newLinkUrl}
            onChange={(e) => setNewLinkUrl(e.target.value)}
          />
        </div>
        <button type="submit" disabled={saving || !effectiveCategory || !newImageUrl} className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60">
          {saving ? 'Saving…' : 'Add'}
        </button>
      </form>

      {sponsors.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-800 mb-4">Existing sponsors</h3>
          <div className="space-y-8">
            {globalSponsors.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-blue-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                  All events
                  <span className="px-1.5 py-0.5 rounded text-xs bg-blue-100 text-blue-800">global</span>
                </h4>
                <div className="space-y-4">
                  {Object.entries(byCategory(globalSponsors)).map(([category, items]) => (
                    <div key={`global-${category}`}>
                      <h5 className="text-xs text-gray-600 mb-1">{category}</h5>
                      <div className="flex flex-wrap gap-4">
                        {items.map((s) => (
                          <div key={s.id} className="relative group border rounded p-3 bg-white">
                            <img src={imageSrc(s.image_url)} alt={category} className="max-h-16 max-w-[120px] object-contain" />
                            {s.link_url && <p className="text-xs text-gray-500 mt-1 truncate max-w-[120px]" title={s.link_url}>→ {s.link_url}</p>}
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
            )}
            {regattaSponsors.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-blue-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                  This regatta
                </h4>
                <div className="space-y-4">
                  {Object.entries(byCategory(regattaSponsors)).map(([category, items]) => (
                    <div key={`regatta-${category}`}>
                      <h5 className="text-xs text-gray-600 mb-1">{category}</h5>
                      <div className="flex flex-wrap gap-4">
                        {items.map((s) => (
                          <div key={s.id} className="relative group border rounded p-3 bg-white">
                            <img src={imageSrc(s.image_url)} alt={category} className="max-h-16 max-w-[120px] object-contain" />
                            {s.link_url && <p className="text-xs text-gray-500 mt-1 truncate max-w-[120px]" title={s.link_url}>→ {s.link_url}</p>}
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
            )}
          </div>
        </div>
      )}
    </div>
  );
}
