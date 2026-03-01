'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { apiGet, apiSend, apiUpload, BASE_URL } from '@/lib/api';

type Regatta = { id: number; name: string; location: string; start_date: string; end_date: string };
type HomeImageItem = { url: string; position_x?: number; position_y?: number };

export default function AdminDesignPage() {
  const { token, logout } = useAuth();
  const [regattas, setRegattas] = useState<Regatta[]>([]);
  const [featuredIds, setFeaturedIds] = useState<number[]>([0, 0, 0]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [homeImages, setHomeImages] = useState<HomeImageItem[]>([]);
  const [savingHome, setSavingHome] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [heroTitle, setHeroTitle] = useState('');
  const [heroSubtitle, setHeroSubtitle] = useState('');

  const [openSections, setOpenSections] = useState<{ featured: boolean; homeImages: boolean }>({
    featured: true,
    homeImages: true,
  });

  const toggleSection = (key: 'featured' | 'homeImages') => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    (async () => {
      try {
        const [regattaList, ids, homepage] = await Promise.all([
          apiGet<Regatta[]>('/regattas/'),
          apiGet<number[]>('/design/featured-regattas/ids').catch(() => []),
          apiGet<{ home_images: HomeImageItem[]; hero_title?: string | null; hero_subtitle?: string | null }>('/design/homepage').catch(() => ({ home_images: [] })),
        ]);
        setRegattas(Array.isArray(regattaList) ? regattaList : []);
        if (Array.isArray(ids) && ids.length >= 3) {
          setFeaturedIds([ids[0], ids[1], ids[2]]);
        } else if (Array.isArray(ids) && ids.length > 0) {
          setFeaturedIds([...ids, ...Array(3 - ids.length).fill(0)]);
        }
        const hi = homepage?.home_images ?? [];
        setHomeImages(
          Array.isArray(hi)
            ? hi.slice(0, 3).map((img: unknown) => {
                const o = img && typeof img === 'object' && 'url' in img ? (img as HomeImageItem) : { url: String(img), position_x: 50, position_y: 50 };
                return {
                  url: o.url,
                  position_x: typeof o.position_x === 'number' ? o.position_x : 50,
                  position_y: typeof o.position_y === 'number' ? o.position_y : 50,
                };
              })
            : []
        );
        setHeroTitle(homepage?.hero_title ?? '');
        setHeroSubtitle(homepage?.hero_subtitle ?? '');
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const ids = featuredIds.filter((id) => id > 0);
      await apiSend('/design/featured-regattas', 'PUT', { regatta_ids: ids }, token);
      alert('Featured regattas saved.');
    } catch (e) {
      console.error(e);
      alert('Error saving.');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadHomeImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token || homeImages.length >= 3) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('Invalid format. Use JPG, PNG or WebP.');
      return;
    }
    setUploadingImage(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const data = await apiUpload<{ url: string }>('/uploads/homepage', form, token);
      setHomeImages((prev) => [...prev, { url: data.url, position_x: 50, position_y: 50 }]);
      e.target.value = '';
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error uploading image.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveHomeImage = (index: number) => {
    setHomeImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSetFocalPoint = (index: number, position_x: number, position_y: number) => {
    setHomeImages((prev) =>
      prev.map((img, i) =>
        i === index ? { ...img, position_x: Math.round(position_x), position_y: Math.round(position_y) } : img
      )
    );
  };

  const handleSaveHomeImages = async () => {
    if (!token) return;
    setSavingHome(true);
    try {
      await apiSend(
        '/design/homepage',
        'PUT',
        {
          home_images: homeImages.slice(0, 3),
          hero_title: heroTitle.trim() || null,
          hero_subtitle: heroSubtitle.trim() || null,
        },
        token
      );
      alert('Homepage images and hero text saved.');
    } catch (e) {
      console.error(e);
      alert('Error saving.');
    } finally {
      setSavingHome(false);
    }
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
          <Link href="/admin/news" className="hover:underline">
            News
          </Link>
          <Link href="/admin/manage-users" className="hover:underline">
            Users
          </Link>
          <Link href="/admin/manage-protests" className="hover:underline">
            Protests
          </Link>
          <Link href="/admin/design" className="hover:underline font-semibold text-blue-600">
            Design
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
          Log out
        </button>
      </aside>

      <main className="flex-1 p-10 bg-gray-50">
        <div className="mb-4">
          <Link href="/admin" className="text-sm text-blue-600 hover:underline">
            ← Back to Dashboard
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-6">Design</h1>
        <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
          <p className="text-gray-600 p-8 pb-0">
            Global design settings. Open each section to edit.
          </p>

          {/* Section: Featured regattas */}
          <div className="border-t">
            <button
              type="button"
              onClick={() => toggleSection('featured')}
              className="w-full flex items-center gap-2 px-8 py-4 text-left hover:bg-gray-50 transition"
            >
              <h2 className="text-xl font-semibold text-gray-900">Featured regattas on homepage</h2>
              <svg
                className={`w-5 h-5 text-gray-500 shrink-0 transition-transform ${openSections.featured ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {openSections.featured && (
              <div className="px-8 pb-8 pt-2 border-t bg-gray-50/50">
                <p className="text-sm text-gray-500 mb-4">
                  When there are no upcoming regattas, the homepage shows up to 3 regattas you choose here (e.g. past editions). Set the order: 1st, 2nd and 3rd slot.
                </p>
                {loading ? (
                  <p className="text-gray-500">Loading…</p>
                ) : (
                  <div className="space-y-4">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="flex items-center gap-3">
                        <label className="w-8 text-gray-600 font-medium">{i + 1}.</label>
                        <select
                          className="border rounded px-3 py-2 min-w-[280px]"
                          value={featuredIds[i] || ''}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setFeaturedIds((prev) => {
                              const next = [...prev];
                              next[i] = v;
                              return next;
                            });
                          }}
                        >
                          <option value="">— None —</option>
                          {regattas.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name} ({r.start_date})
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving}
                      className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {saving ? 'Saving…' : 'Save featured regattas'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section: Homepage hero images */}
          <div className="border-t">
            <button
              type="button"
              onClick={() => toggleSection('homeImages')}
              className="w-full flex items-center gap-2 px-8 py-4 text-left hover:bg-gray-50 transition"
            >
              <h2 className="text-xl font-semibold text-gray-900">Homepage hero images</h2>
              <svg
                className={`w-5 h-5 text-gray-500 shrink-0 transition-transform ${openSections.homeImages ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {openSections.homeImages && (
              <div className="px-8 pb-8 pt-2 border-t bg-gray-50/50">
                <p className="text-sm text-gray-500 mb-4">
                  Up to 3 images for the SailScore homepage hero (same as regatta pages). Images rotate in a carousel. Click an image to set the focal point. You can also edit the hero title and subtitle shown over the images.
                </p>
                <div className="border rounded-lg p-5 bg-gray-50 space-y-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Hero title</label>
                    <input
                      type="text"
                      value={heroTitle}
                      onChange={(e) => setHeroTitle(e.target.value)}
                      placeholder="e.g. Regatta Management & Results"
                      className="w-full border rounded px-3 py-2 text-gray-900"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Hero subtitle</label>
                    <input
                      type="text"
                      value={heroSubtitle}
                      onChange={(e) => setHeroSubtitle(e.target.value)}
                      placeholder="e.g. Track, participate and follow the world of sailing competitions."
                      className="w-full border rounded px-3 py-2 text-gray-900"
                    />
                  </div>
                  <hr className="border-gray-200" />
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleUploadHomeImage}
                    disabled={uploadingImage || homeImages.length >= 3}
                    className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 file:font-medium hover:file:bg-blue-100 disabled:opacity-60"
                  />
                  {homeImages.length >= 3 && (
                    <p className="text-xs text-amber-700">Maximum 3 images. Remove one to add another.</p>
                  )}
                  <div className="space-y-6">
                    {homeImages.map((img, idx) => (
                      <div key={idx} className="border rounded-lg p-4 bg-white">
                        <p className="text-sm font-medium text-gray-700 mb-2">Image {idx + 1} — click to set focal point</p>
                        <div
                          className="relative aspect-[16/9] rounded overflow-hidden cursor-crosshair border"
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const x = ((e.clientX - rect.left) / rect.width) * 100;
                            const y = ((e.clientY - rect.top) / rect.height) * 100;
                            handleSetFocalPoint(idx, x, y);
                          }}
                        >
                          <img
                            src={img.url.startsWith('http') ? img.url : `${BASE_URL}${img.url}`}
                            alt={`Hero ${idx + 1}`}
                            className="w-full h-full object-cover"
                            style={{
                              objectPosition: `${img.position_x ?? 50}% ${img.position_y ?? 50}%`,
                            }}
                            onError={(e) => (e.currentTarget.style.display = 'none')}
                            draggable={false}
                          />
                          <div
                            className="absolute w-4 h-4 border-2 border-white rounded-full shadow-lg pointer-events-none"
                            style={{
                              left: `${img.position_x ?? 50}%`,
                              top: `${img.position_y ?? 50}%`,
                              transform: 'translate(-50%, -50%)',
                            }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Focal point: {img.position_x ?? 50}% × {img.position_y ?? 50}%
                        </p>
                        <button
                          type="button"
                          onClick={() => handleRemoveHomeImage(idx)}
                          disabled={savingHome}
                          className="mt-2 text-sm text-red-600 hover:underline disabled:opacity-60"
                        >
                          Remove image
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveHomeImages}
                    disabled={savingHome}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingHome ? 'Saving…' : 'Save homepage hero'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
