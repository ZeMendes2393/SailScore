'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiSend, apiUpload, BASE_URL } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

type Sponsor = {
  id: number;
  regatta_id: number;
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
  const [newCategory, setNewCategory] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState('');

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
      alert(err instanceof Error ? err.message : 'Erro ao enviar imagem.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAddSponsor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newCategory.trim() || !newImageUrl) {
      alert('Preencha a categoria e carregue uma imagem.');
      return;
    }
    setSaving(true);
    try {
      await apiSend(`/regattas/${regattaId}/sponsors`, 'POST', {
        category: newCategory.trim(),
        image_url: newImageUrl,
        link_url: newLinkUrl.trim() || null,
        sort_order: sponsors.length,
      }, token);
      setNewCategory('');
      setNewLinkUrl('');
      setNewImageUrl('');
      fetchSponsors();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao adicionar.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSponsor = async (sponsorId: number) => {
    if (!token || !confirm('Remover este sponsor?')) return;
    setSaving(true);
    try {
      await apiSend(`/regattas/${regattaId}/sponsors/${sponsorId}`, 'DELETE', undefined, token);
      fetchSponsors();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao remover.');
    } finally {
      setSaving(false);
    }
  };

  const imageSrc = (url: string) =>
    url.startsWith('http') ? url : `${BASE_URL}${url}`;

  const byCategory = sponsors.reduce<Record<string, Sponsor[]>>((acc, s) => {
    const cat = s.category || 'Outros';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  if (loading) return <p className="text-gray-500">A carregar sponsors…</p>;

  return (
    <div className="p-6 bg-white rounded shadow max-w-3xl space-y-8">
      <h2 className="text-xl font-semibold mb-4">Patrocinadores e Apoios</h2>
      <p className="text-sm text-gray-600 mb-6">
        Adicione imagens de patrocinadores e apoios que aparecem na página pública. Cada imagem pode ter um link (URL) para onde o clique leva.
      </p>

      <form onSubmit={handleAddSponsor} className="border rounded-lg p-5 bg-gray-50 space-y-4">
        <h3 className="font-semibold text-gray-800">Adicionar novo sponsor/apoio</h3>
        <div>
          <label className="block text-sm font-medium mb-1">Categoria (ex: Patrocinadores Oficiais, Parceiros Oficiais, Membro de)</label>
          <input
            type="text"
            className="w-full border rounded px-3 py-2"
            placeholder="ex: Patrocinadores Oficiais"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Imagem do logótipo</label>
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
                Remover
              </button>
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Link (URL) — para onde o clique leva (opcional)</label>
          <input
            type="url"
            className="w-full border rounded px-3 py-2"
            placeholder="https://exemplo.com"
            value={newLinkUrl}
            onChange={(e) => setNewLinkUrl(e.target.value)}
          />
        </div>
        <button type="submit" disabled={saving || !newCategory.trim() || !newImageUrl} className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60">
          {saving ? 'A guardar…' : 'Adicionar'}
        </button>
      </form>

      {sponsors.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-800 mb-4">Sponsors existentes</h3>
          <div className="space-y-6">
            {Object.entries(byCategory).map(([category, items]) => (
              <div key={category}>
                <h4 className="text-sm font-semibold text-blue-700 uppercase tracking-wider mb-2">{category}</h4>
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
  );
}
