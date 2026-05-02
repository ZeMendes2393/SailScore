'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { apiGet, apiSend, apiUpload, BASE_URL } from '@/lib/api';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { useAdminOrg, withOrg } from '@/lib/useAdminOrg';

type Regatta = { id: number; name: string; location: string; start_date: string; end_date: string };
type HomeImageItem = { url: string; position_x?: number; position_y?: number };
type HomepageDesign = {
  home_images: HomeImageItem[];
  hero_title?: string | null;
  hero_subtitle?: string | null;
  club_logo_url?: string | null;
  club_logo_link?: string | null;
};

type FooterDesign = {
  footer_site_name: string | null;
  footer_tagline: string | null;
  footer_contact_email: string | null;
  footer_phone: string | null;
  footer_address: string | null;
  footer_instagram_url: string | null;
  footer_facebook_url: string | null;
  footer_show_privacy_policy: boolean;
  footer_show_terms_of_service: boolean;
  footer_show_cookie_policy: boolean;
  footer_privacy_policy_text: string | null;
  footer_terms_of_service_text: string | null;
  footer_cookie_policy_text: string | null;
};

export default function AdminDesignPage() {
  const { token } = useAuth();
  const { orgSlug } = useAdminOrg();
  const [regattas, setRegattas] = useState<Regatta[]>([]);
  const [featuredIds, setFeaturedIds] = useState<number[]>([0, 0, 0]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [homeImages, setHomeImages] = useState<HomeImageItem[]>([]);
  const [savingHome, setSavingHome] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [heroTitle, setHeroTitle] = useState('');
  const [heroSubtitle, setHeroSubtitle] = useState('');

  const [clubLogoUrl, setClubLogoUrl] = useState('');
  const [clubLogoLink, setClubLogoLink] = useState('');
  const [savingHeader, setSavingHeader] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [footerDesign, setFooterDesign] = useState<FooterDesign | null>(null);
  const [savingFooter, setSavingFooter] = useState(false);

  const [openSections, setOpenSections] = useState<{
    featured: boolean;
    homeImages: boolean;
    header: boolean;
    footer: boolean;
  }>({
    featured: false,
    homeImages: false,
    header: false,
    footer: false,
  });

  const toggleSection = (key: 'featured' | 'homeImages' | 'header' | 'footer') => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    (async () => {
      try {
        const [regattaList, ids, homepage, footer] = await Promise.all([
          apiGet<Regatta[]>(withOrg('/regattas/', orgSlug), token ?? undefined),
          apiGet<number[]>(withOrg('/design/featured-regattas/ids', orgSlug)).catch(() => []),
          apiGet<HomepageDesign>(withOrg('/design/homepage', orgSlug)).catch(
            (): HomepageDesign => ({ home_images: [] }),
          ),
          apiGet<FooterDesign>(withOrg('/design/footer', orgSlug)).catch(
            () =>
              ({
                footer_site_name: null,
                footer_tagline: null,
                footer_contact_email: null,
                footer_phone: null,
                footer_address: null,
                footer_instagram_url: null,
                footer_facebook_url: null,
                footer_show_privacy_policy: true,
                footer_show_terms_of_service: true,
                footer_show_cookie_policy: true,
                footer_privacy_policy_text: null,
                footer_terms_of_service_text: null,
                footer_cookie_policy_text: null,
              } as FooterDesign),
          ),
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
        setClubLogoUrl(homepage?.club_logo_url ?? '');
        setClubLogoLink(homepage?.club_logo_link ?? '');
        setFooterDesign(footer);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [orgSlug, token]);

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const ids = featuredIds.filter((id) => id > 0);
      await apiSend(withOrg('/design/featured-regattas', orgSlug), 'PUT', { regatta_ids: ids }, token);
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
        withOrg('/design/homepage', orgSlug),
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

  const handleUploadClubLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('Invalid format. Use JPG, PNG or WebP.');
      return;
    }
    setUploadingLogo(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const data = await apiUpload<{ url: string }>('/uploads/header', form, token);
      setClubLogoUrl(data.url);
      e.target.value = '';
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error uploading image.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSaveHeader = async () => {
    if (!token) return;
    setSavingHeader(true);
    try {
      await apiSend(
        withOrg('/design/homepage', orgSlug),
        'PUT',
        {
          club_logo_url: clubLogoUrl.trim() || null,
          club_logo_link: clubLogoLink.trim() || null,
        },
        token
      );
      alert('Header club logo and link saved.');
    } catch (e) {
      console.error(e);
      alert('Error saving.');
    } finally {
      setSavingHeader(false);
    }
  };

  const handleSaveFooter = async () => {
    if (!token || !footerDesign) return;
    setSavingFooter(true);
    try {
      await apiSend(
        withOrg('/design/footer', orgSlug),
        'PUT',
        {
          ...footerDesign,
        },
        token,
      );
      alert('Footer design saved.');
    } catch (e) {
      console.error(e);
      alert('Error saving footer design.');
    } finally {
      setSavingFooter(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />

      <main className="flex-1 px-4 sm:px-6 py-8 bg-gray-50">
        <div className="mb-4">
          <Link href={withOrg('/admin', orgSlug)} className="text-sm text-blue-600 hover:underline">
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
                  Choose up to 3 regattas to feature on the homepage (e.g. past editions or key events). They appear in a &quot;Featured regattas&quot; section. Set the order: 1st, 2nd and 3rd slot. If you leave all slots empty, the homepage will show upcoming regattas instead.
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
                  Choose up to 3 main images for the homepage banner. These images are shown at the top of the homepage in a rotating carousel. You can also set the title and subtitle that appear over the images. Click an image to define its focal point.
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
                  <div className="rounded border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                    Upload area: add up to <span className="font-semibold">3 homepage images</span> here.
                  </div>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleUploadHomeImage}
                    disabled={uploadingImage || homeImages.length >= 3}
                    className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 file:font-medium hover:file:bg-blue-100 disabled:opacity-60"
                  />
                  <p className="text-xs text-gray-600">
                    Focal point tip: click on the image preview where you want the center to be.
                  </p>
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

          {/* Section: Header / Club logo */}
          <div className="border-t">
            <button
              type="button"
              onClick={() => toggleSection('header')}
              className="w-full flex items-center gap-2 px-8 py-4 text-left hover:bg-gray-50 transition"
            >
              <h2 className="text-xl font-semibold text-gray-900">Header / Club logo</h2>
              <svg
                className={`w-5 h-5 text-gray-500 shrink-0 transition-transform ${openSections.header ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {openSections.header && (
              <div className="px-8 pb-8 pt-2 border-t bg-gray-50/50">
                <p className="text-sm text-gray-500 mb-4">
                  Club logo shown in the top-left of the header. You can add an optional link so clicking the logo opens a URL (e.g. your club website).
                </p>
                <div className="border rounded-lg p-5 bg-gray-50 space-y-4 max-w-xl">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Club logo image</label>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleUploadClubLogo}
                      disabled={uploadingLogo}
                      className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 file:font-medium hover:file:bg-blue-100 disabled:opacity-60"
                    />
                    {clubLogoUrl && (
                      <div className="flex items-center gap-3 mt-2">
                        <img
                          src={clubLogoUrl.startsWith('http') ? clubLogoUrl : `${BASE_URL}${clubLogoUrl}`}
                          alt="Club logo"
                          className="h-12 w-auto object-contain border rounded bg-white p-1"
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                        <button
                          type="button"
                          onClick={() => setClubLogoUrl('')}
                          className="text-sm text-red-600 hover:underline"
                        >
                          Remove logo
                        </button>
                      </div>
                    )}
                    {!clubLogoUrl && (
                      <p className="text-xs text-gray-500">If no logo is set, &quot;SailScore&quot; text is shown.</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Optional link URL</label>
                    <input
                      type="url"
                      value={clubLogoLink}
                      onChange={(e) => setClubLogoLink(e.target.value)}
                      placeholder="https://your-club-website.com"
                      className="w-full border rounded px-3 py-2 text-gray-900"
                    />
                    <p className="text-xs text-gray-500">Leave empty if the logo should not be clickable.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveHeader}
                    disabled={savingHeader}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingHeader ? 'Saving…' : 'Save header'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Section: Footer */}
          <div className="border-t">
            <button
              type="button"
              onClick={() => toggleSection('footer')}
              className="w-full flex items-center gap-2 px-8 py-4 text-left hover:bg-gray-50 transition"
            >
              <h2 className="text-xl font-semibold text-gray-900">Footer</h2>
              <svg
                className={`w-5 h-5 text-gray-500 shrink-0 transition-transform ${
                  openSections.footer ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {openSections.footer && (
              <div className="px-8 pb-8 pt-2 border-t bg-gray-50/50">
                {!footerDesign ? (
                  <p className="text-gray-500">Loading footer design…</p>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <h3 className="text-lg font-semibold text-gray-900">Brand</h3>
                        <div className="space-y-1">
                          <label className="block text-sm font-medium text-gray-700">Club name</label>
                          <input
                            type="text"
                            value={footerDesign.footer_site_name ?? ''}
                            onChange={(e) =>
                              setFooterDesign((prev) =>
                                prev ? { ...prev, footer_site_name: e.target.value } : prev,
                              )
                            }
                            className="w-full border rounded px-3 py-2 text-gray-900"
                            placeholder="e.g. Clube de Vela XYZ"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-sm font-medium text-gray-700">
                            Tagline / short description
                          </label>
                          <input
                            type="text"
                            value={footerDesign.footer_tagline ?? ''}
                            onChange={(e) =>
                              setFooterDesign((prev) =>
                                prev ? { ...prev, footer_tagline: e.target.value } : prev,
                              )
                            }
                            className="w-full border rounded px-3 py-2 text-gray-900"
                            placeholder="e.g. Regatta management & live results."
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h3 className="text-lg font-semibold text-gray-900">Contact</h3>
                        <div className="space-y-1">
                          <label className="block text-sm font-medium text-gray-700">Contact email</label>
                          <input
                            type="email"
                            value={footerDesign.footer_contact_email ?? ''}
                            onChange={(e) =>
                              setFooterDesign((prev) =>
                                prev ? { ...prev, footer_contact_email: e.target.value } : prev,
                              )
                            }
                            className="w-full border rounded px-3 py-2 text-gray-900"
                            placeholder="e.g. info@clubexyz.pt"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-sm font-medium text-gray-700">Phone (optional)</label>
                          <input
                            type="text"
                            value={footerDesign.footer_phone ?? ''}
                            onChange={(e) =>
                              setFooterDesign((prev) =>
                                prev ? { ...prev, footer_phone: e.target.value } : prev,
                              )
                            }
                            className="w-full border rounded px-3 py-2 text-gray-900"
                            placeholder="+351 ..."
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-sm font-medium text-gray-700">Address</label>
                          <textarea
                            value={footerDesign.footer_address ?? ''}
                            onChange={(e) =>
                              setFooterDesign((prev) =>
                                prev ? { ...prev, footer_address: e.target.value } : prev,
                              )
                            }
                            className="w-full border rounded px-3 py-2 text-gray-900 min-h-[70px]"
                            placeholder="Street, city, country"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-sm font-medium text-gray-700">
                            Instagram URL (optional)
                          </label>
                          <input
                            type="url"
                            value={footerDesign.footer_instagram_url ?? ''}
                            onChange={(e) =>
                              setFooterDesign((prev) =>
                                prev ? { ...prev, footer_instagram_url: e.target.value } : prev,
                              )
                            }
                            className="w-full border rounded px-3 py-2 text-gray-900"
                            placeholder="https://instagram.com/..."
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-sm font-medium text-gray-700">
                            Facebook URL (optional)
                          </label>
                          <input
                            type="url"
                            value={footerDesign.footer_facebook_url ?? ''}
                            onChange={(e) =>
                              setFooterDesign((prev) =>
                                prev ? { ...prev, footer_facebook_url: e.target.value } : prev,
                              )
                            }
                            className="w-full border rounded px-3 py-2 text-gray-900"
                            placeholder="https://facebook.com/..."
                          />
                        </div>
                      </div>
                    </div>

                    <hr className="border-gray-200" />

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-900">Legal links & texts</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                          <label className="inline-flex items-center gap-2 text-sm text-gray-800">
                            <input
                              type="checkbox"
                              checked={footerDesign.footer_show_privacy_policy}
                              onChange={(e) =>
                                setFooterDesign((prev) =>
                                  prev
                                    ? { ...prev, footer_show_privacy_policy: e.target.checked }
                                    : prev,
                                )
                              }
                            />
                            Show Privacy Policy link
                          </label>
                          <textarea
                            value={footerDesign.footer_privacy_policy_text ?? ''}
                            onChange={(e) =>
                              setFooterDesign((prev) =>
                                prev ? { ...prev, footer_privacy_policy_text: e.target.value } : prev,
                              )
                            }
                            className="w-full border rounded px-3 py-2 text-gray-900 min-h-[120px] text-sm"
                            placeholder="Privacy Policy text shown in the modal."
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="inline-flex items-center gap-2 text-sm text-gray-800">
                            <input
                              type="checkbox"
                              checked={footerDesign.footer_show_terms_of_service}
                              onChange={(e) =>
                                setFooterDesign((prev) =>
                                  prev
                                    ? { ...prev, footer_show_terms_of_service: e.target.checked }
                                    : prev,
                                )
                              }
                            />
                            Show Terms of Service link
                          </label>
                          <textarea
                            value={footerDesign.footer_terms_of_service_text ?? ''}
                            onChange={(e) =>
                              setFooterDesign((prev) =>
                                prev ? { ...prev, footer_terms_of_service_text: e.target.value } : prev,
                              )
                            }
                            className="w-full border rounded px-3 py-2 text-gray-900 min-h-[120px] text-sm"
                            placeholder="Terms of Service text shown in the modal."
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="inline-flex items-center gap-2 text-sm text-gray-800">
                            <input
                              type="checkbox"
                              checked={footerDesign.footer_show_cookie_policy}
                              onChange={(e) =>
                                setFooterDesign((prev) =>
                                  prev
                                    ? { ...prev, footer_show_cookie_policy: e.target.checked }
                                    : prev,
                                )
                              }
                            />
                            Show Cookie Policy link
                          </label>
                          <textarea
                            value={footerDesign.footer_cookie_policy_text ?? ''}
                            onChange={(e) =>
                              setFooterDesign((prev) =>
                                prev ? { ...prev, footer_cookie_policy_text: e.target.value } : prev,
                              )
                            }
                            className="w-full border rounded px-3 py-2 text-gray-900 min-h-[120px] text-sm"
                            placeholder="Cookie Policy text shown in the modal."
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleSaveFooter}
                      disabled={savingFooter}
                      className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {savingFooter ? 'Saving…' : 'Save footer design'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
