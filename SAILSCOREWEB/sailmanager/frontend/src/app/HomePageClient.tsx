'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';

import GlobalSponsorsFooter from '@/components/GlobalSponsorsFooter';

interface Regatta {
  id: number;
  name: string;
  location: string;
  start_date: string;
  end_date: string;
  online_entry_open?: boolean;
  class_names?: string[];
  listing_logo_url?: string | null;
}

interface NewsItem {
  id: number;
  title: string;
  published_at: string;
  excerpt: string | null;
  body: string | null;
  image_url: string | null;
  category: string | null;
  created_at: string;
  updated_at: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://127.0.0.1:8000';

export type HomeDesign = {
  home_images: { url: string; position_x?: number; position_y?: number }[];
  hero_title: string | null;
  hero_subtitle: string | null;
};

const orgParam = (slug: string | null | undefined) =>
  slug ? `?org=${encodeURIComponent(slug)}` : '';

export default function HomePageClient({
  initialHomeDesign,
  orgSlug,
}: {
  initialHomeDesign?: HomeDesign | null;
  orgSlug?: string | null;
}) {
  const [regattas, setRegattas] = useState<Regatta[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [featuredRegattas, setFeaturedRegattas] = useState<Regatta[]>([]);
  const [homeImages, setHomeImages] = useState<{ url: string; position_x?: number; position_y?: number }[]>(
    initialHomeDesign?.home_images?.slice(0, 3).map((img) => ({
      url: img.url?.startsWith('http') ? img.url : `${API_BASE}${img.url}`,
      position_x: Math.max(0, Math.min(100, img.position_x ?? 50)),
      position_y: Math.max(0, Math.min(100, img.position_y ?? 50)),
    })) ?? []
  );
  const [heroTitle, setHeroTitle] = useState<string | null>(initialHomeDesign?.hero_title ?? null);
  const [heroSubtitle, setHeroSubtitle] = useState<string | null>(initialHomeDesign?.hero_subtitle ?? null);
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/regattas/${orgParam(orgSlug)}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as Regatta[];
        setRegattas(data);
      } catch (err) {
        console.error('Erro ao buscar regatas:', err);
      }
    })();
  }, [orgSlug]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/news/${orgParam(orgSlug)}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as NewsItem[];
        setNews(Array.isArray(data) ? data.slice(0, 6) : []);
      } catch (err) {
        console.error('Erro ao buscar news:', err);
      }
    })();
  }, [orgSlug]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/design/featured-regattas${orgParam(orgSlug)}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as Regatta[];
        setFeaturedRegattas(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Erro ao buscar regatas em destaque:', err);
      }
    })();
  }, [orgSlug]);

  useEffect(() => {
    // SSR já enviou design (/) ou /o/[slug]) — não refetch no cliente (evita flash ~100ms).
    if (initialHomeDesign != null) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/design/homepage${orgParam(orgSlug)}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as {
          home_images: { url: string; position_x?: number; position_y?: number }[];
          hero_title?: string | null;
          hero_subtitle?: string | null;
        };
        const hi = data?.home_images ?? [];
        setHomeImages(
          Array.isArray(hi)
            ? hi.slice(0, 3).map((img) => ({
                url: img.url?.startsWith('http') ? img.url : `${API_BASE}${img.url}`,
                position_x: Math.max(0, Math.min(100, img.position_x ?? 50)),
                position_y: Math.max(0, Math.min(100, img.position_y ?? 50)),
              }))
            : []
        );
        setHeroTitle(data?.hero_title ?? null);
        setHeroSubtitle(data?.hero_subtitle ?? null);
      } catch (err) {
        console.error('Erro ao buscar imagens da homepage:', err);
      }
    })();
  }, [initialHomeDesign, orgSlug]);

  const formatNewsDate = (s: string) => {
    try {
      return new Date(s).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' });
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

  const newsImageSrc = (url: string | null) => {
    if (!url) return null;
    return url.startsWith('http') ? url : `${API_BASE}${url}`;
  };

  const logoUrl = (url: string | null | undefined) =>
    !url ? null : url.startsWith('http') ? url : `${API_BASE}${url}`;

  const formatRegattaDate = (start: string, end: string) => {
    try {
      const s = new Date(start);
      const e = new Date(end);
      const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
      if (s.getTime() === e.getTime()) return s.toLocaleDateString('pt-PT', opts);
      return `${s.toLocaleDateString('pt-PT', opts)} – ${e.toLocaleDateString('pt-PT', opts)}`;
    } catch {
      return `${start} – ${end}`;
    }
  };

  const upcomingRegattas = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return regattas
      .filter((r) => r.start_date >= today)
      .sort((a, b) => a.start_date.localeCompare(b.start_date))
      .slice(0, 3);
  }, [regattas]);

  useEffect(() => {
    if (homeImages.length <= 1) return;
    const t = setInterval(() => {
      setActiveSlide((i) => (i + 1) % homeImages.length);
    }, 5000);
    return () => clearInterval(t);
  }, [homeImages.length]);

  const heroBgStyle =
    homeImages[activeSlide]
      ? {
          backgroundImage: `url(${homeImages[activeSlide].url})`,
          backgroundSize: 'cover' as const,
          backgroundRepeat: 'no-repeat' as const,
          backgroundPosition: `${homeImages[activeSlide].position_x}% ${homeImages[activeSlide].position_y}%`,
        }
      : undefined;

  return (
    <>
      <section
        className="relative w-full min-h-[70vh] md:min-h-[80vh] -mt-28 pt-28 flex flex-col items-center justify-center text-center py-24 md:py-32 text-white overflow-hidden"
        style={{
          ...(heroBgStyle ?? {
            background: 'linear-gradient(135deg, #0c4a6e 0%, #0369a1 50%, #0ea5e9 100%)',
          }),
        }}
      >
        <div
          className={`absolute inset-0 ${
            homeImages.length > 0
              ? 'bg-black/40'
              : 'bg-gradient-to-b from-blue-900/50 via-blue-800/60 to-blue-900/85'
          }`}
        />
        {homeImages.length > 1 && (
          <div className="absolute bottom-4 left-0 right-0 z-20 flex justify-center gap-2">
            {homeImages.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Slide ${i + 1}`}
                onClick={() => setActiveSlide(i)}
                className={`w-2.5 h-2.5 rounded-full transition ${
                  i === activeSlide ? 'bg-white scale-125' : 'bg-white/50 hover:bg-white/80'
                }`}
              />
            ))}
          </div>
        )}
        <div className="relative z-10 max-w-3xl mx-auto px-4">
          <h1 className="text-7xl md:text-8xl font-bold mb-4 tracking-tight drop-shadow-lg">
            {heroTitle?.trim() || 'Regatta Management & Results'}
          </h1>
          <p className="text-3xl md:text-4xl text-white/95 drop-shadow">
            {heroSubtitle?.trim() || 'Track, participate and follow the world of sailing competitions.'}
          </p>
        </div>
      </section>

      <section className="py-16 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-screen-2xl mx-auto px-2 lg:px-3">
          {featuredRegattas.length > 0 ? (
            <>
              <h2 className="text-2xl md:text-3xl font-bold mb-8 text-gray-900">Featured regattas</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {featuredRegattas.map((r) => (
                  <Link
                    key={r.id}
                    href={`/regattas/${r.id}${orgParam(orgSlug)}`}
                    className="group flex gap-4 bg-white border border-gray-100 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-gray-200 transition-all text-left"
                  >
                    {r.listing_logo_url && logoUrl(r.listing_logo_url) && (
                      <div className="shrink-0 w-32 h-32 rounded-lg overflow-hidden bg-gray-100 border border-gray-100">
                        <img
                          src={logoUrl(r.listing_logo_url)!}
                          alt=""
                          className="w-full h-full object-contain"
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors mb-1">
                        {r.name}
                      </h3>
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <span aria-hidden>📍</span> {r.location}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        {formatRegattaDate(r.start_date, r.end_date)}
                      </p>
                      {r.class_names && r.class_names.length > 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          Classes: {r.class_names.join(' • ')}
                        </p>
                      )}
                      <span className="inline-block mt-3 text-sm text-blue-600 font-medium group-hover:underline">
                        View →
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
              <div className="mt-8 text-center">
                <Link href={`/calendar${orgParam(orgSlug)}`} className="text-blue-600 font-medium hover:underline">
                  View full calendar →
                </Link>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-2xl md:text-3xl font-bold mb-8 text-gray-900">Upcoming regattas</h2>
              {upcomingRegattas.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {upcomingRegattas.map((r) => (
                      <Link
                        key={r.id}
                        href={`/regattas/${r.id}${orgParam(orgSlug)}`}
                        className="group flex gap-4 bg-white border border-gray-100 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-gray-200 transition-all text-left"
                      >
                        {r.listing_logo_url && logoUrl(r.listing_logo_url) && (
                          <div className="shrink-0 w-32 h-32 rounded-lg overflow-hidden bg-gray-100 border border-gray-100">
                            <img
                              src={logoUrl(r.listing_logo_url)!}
                              alt=""
                              className="w-full h-full object-contain"
                              onError={(e) => (e.currentTarget.style.display = 'none')}
                            />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors mb-1">
                            {r.name}
                          </h3>
                          <p className="text-sm text-gray-600 flex items-center gap-1">
                            <span aria-hidden>📍</span> {r.location}
                          </p>
                          <p className="text-sm text-gray-500 mt-1">
                            {formatRegattaDate(r.start_date, r.end_date)}
                          </p>
                          <p className="text-xs mt-2 font-medium">
                            {r.online_entry_open !== false ? (
                              <span className="text-emerald-600">Entry open</span>
                            ) : (
                              <span className="text-gray-500">Entry closed</span>
                            )}
                          </p>
                          <span className="inline-block mt-3 text-sm text-blue-600 font-medium group-hover:underline">
                            View →
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                  <div className="mt-8 text-center">
                    <Link href={`/calendar${orgParam(orgSlug)}`} className="text-blue-600 font-medium hover:underline">
                    View full calendar →
                    </Link>
                  </div>
                </>
              ) : (
                <p className="text-gray-600">
                  No upcoming regattas. Check the{' '}
                  <Link href={`/calendar${orgParam(orgSlug)}`} className="text-blue-600 hover:underline">
                    calendar
                  </Link>
                  .
                </p>
              )}
            </>
          )}
        </div>
      </section>

      {news.length > 0 && (
        <section className="py-16 bg-white w-full">
          <div className="max-w-screen-2xl mx-auto px-2 lg:px-3">
            <h2 className="text-3xl md:text-4xl font-bold mb-8 text-gray-900">News</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {news.map((item) => (
                <Link
                  key={item.id}
                  href={orgSlug ? `/o/${orgSlug}/news/${item.id}` : `/news/${item.id}`}
                  className="group bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-gray-200 transition-all"
                >
                  <div className="aspect-[16/10] bg-gray-200 overflow-hidden">
                    {item.image_url ? (
                      <img
                        src={newsImageSrc(item.image_url) ?? ''}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="flex items-center gap-1.5 text-sm text-red-600 font-medium mb-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      {formatNewsDate(item.published_at)}
                    </p>
                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                      {item.title}
                    </h3>
                    {bodyToSnippet(item.body, 140) && (
                      <p className="text-base text-gray-600 mt-1 line-clamp-2">
                        {bodyToSnippet(item.body, 140)}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
            <div className="mt-8 text-center">
              <Link href={orgSlug ? `/o/${orgSlug}/news` : '/news'} className="text-blue-600 font-semibold text-lg hover:underline">
                View all news →
              </Link>
            </div>
          </div>
        </section>
      )}

      <GlobalSponsorsFooter orgSlug={orgSlug} />
    </>
  );
}
