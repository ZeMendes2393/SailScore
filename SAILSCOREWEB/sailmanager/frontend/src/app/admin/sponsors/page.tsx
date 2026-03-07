'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { apiGet, apiSend, apiUpload, apiDelete, BASE_URL } from '@/lib/api';

type Sponsor = {
  id: number;
  regatta_id: number | null;
  category: string;
  image_url: string;
  link_url: string | null;
  sort_order: number;
};

export default function AdminSponsorsPage() {
  const { token, logout } = useAuth();
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [newCategory, setNewCategory] = useState('');
  const [useNewCategory, setUseNewCategory] = useState(false);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [addToAllRegattas, setAddToAllRegattas] = useState(true);

  const fetchSponsors = async () => {
    try {
      const data = await apiGet<Sponsor[]>('/sponsors');
      setSponsors(Array.isArray(data) ? data : []);
    } catch {
      setSponsors([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      return await apiGet<string[]>('/sponsors/categories');
    } catch {
      return [];
    }
  };

  useEffect(() => {
    fetchSponsors();
  }, []);

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('Formato inválido. Use JPG, PNG ou WebP.');
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
      alert(err instanceof Error ? err.message : 'Erro no upload.');
    } finally {
      setUploadingImage(false);
    }
  };

  const existingCategories = [...new Set(sponsors.map((s) => s.category).filter(Boolean))].sort();
  const effectiveCategory =
    useNewCategory || existingCategories.length === 0 ? newCategory.trim() : selectedCategory.trim();

  const handleAddSponsor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !effectiveCategory || !newImageUrl) {
      alert('Escolha ou crie uma categoria e faça upload de uma imagem.');
      return;
    }
    setSaving(true);
    try {
      await apiSend(
        '/sponsors',
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
      if (useNewCategory) setNewCategory('');
      fetchSponsors();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao adicionar.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSponsor = async (sponsorId: number) => {
    if (!token || !confirm('Remover este patrocinador? Ele deixará de aparecer na homepage, calendário, news e em todas as regatas.'))
      return;
    setSaving(true);
    try {
      await apiDelete(`/sponsors/${sponsorId}`, token);
      fetchSponsors();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao remover.');
    } finally {
      setSaving(false);
    }
  };

  const imageSrc = (url: string) => (url.startsWith('http') ? url : `${BASE_URL}${url}`);
  const byCategory = sponsors.reduce<Record<string, Sponsor[]>>((acc, s) => {
    const cat = s.category || 'Outros';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

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
          <Link href="/admin/news" className="hover:underline">
            News
          </Link>
          <Link href="/admin/manage-users" className="hover:underline">
            Users
          </Link>
          <Link href="/admin/manage-protests" className="hover:underline">
            Protests
          </Link>
          <Link href="/admin/design" className="hover:underline">
            Design
          </Link>
          <Link href="/admin/sponsors" className="hover:underline font-semibold text-blue-600">
            Sponsors
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
            ← Voltar ao Dashboard
          </Link>
        </div>
        <h1 className="text-3xl font-bold mb-2">Sponsors</h1>
        <p className="text-gray-600 mb-8">
          Patrocinadores adicionados aqui aparecem na <strong>homepage</strong>, no <strong>calendário</strong>, em <strong>news</strong> e em <strong>todas as regatas</strong>. Para patrocinadores apenas de uma regata, use a secção Sponsors dentro de cada regata.
        </p>

        <div className="max-w-3xl space-y-8">
          <form
            onSubmit={handleAddSponsor}
            className="border rounded-lg p-6 bg-white shadow-sm space-y-4"
          >
            <h2 className="text-xl font-semibold text-gray-800">Adicionar patrocinador global</h2>

            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <input
                type="checkbox"
                id="addToAllRegattas"
                checked={addToAllRegattas}
                onChange={(e) => setAddToAllRegattas(e.target.checked)}
                className="rounded border-gray-300"
              />
              <label htmlFor="addToAllRegattas" className="text-sm font-medium text-gray-800">
                Adicionar a todas as regatas (aparece na homepage, calendário, news e em cada regata)
              </label>
            </div>
            <p className="text-xs text-gray-500">
              Os patrocinadores criados nesta página estão sempre &quot;em todas as regatas&quot;.
            </p>

            <div>
              <label className="block text-sm font-medium mb-1">Categoria</label>
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
                      <option value="">— Escolher categoria —</option>
                      {existingCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      <option value="__new__">➕ Nova categoria</option>
                    </select>
                  </div>
                )}
                {(useNewCategory || existingCategories.length === 0) && (
                  <input
                    type="text"
                    className="w-full border rounded px-3 py-2"
                    placeholder="ex: Patrocinadores Oficiais, Parceiros"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    onFocus={() => setUseNewCategory(true)}
                  />
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Logo (imagem)</label>
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
                    Remover
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Link (URL) — opcional</label>
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
              {saving ? 'A guardar…' : 'Adicionar'}
            </button>
          </form>

          {loading ? (
            <p className="text-gray-500">A carregar…</p>
          ) : sponsors.length > 0 ? (
            <div className="border rounded-lg p-6 bg-white shadow-sm">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Patrocinadores globais</h2>
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
            <p className="text-gray-500">Ainda não há patrocinadores globais. Adicione um acima.</p>
          )}
        </div>
      </main>
    </div>
  );
}
