'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { FileText, List, PenLine, Trophy } from 'lucide-react';

import RegattaHeader, { REGATTA_HERO_HEADER_PT } from './components/RegattaHeader';
import { formatDateRange } from '@/lib/formatDate';

const API_BASE =
  (process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://127.0.0.1:8000');

type HomeImage = { url: string; position_x?: number; position_y?: number };

type Regatta = {
  id: number;
  name: string;
  location: string;
  start_date: string;
  end_date: string;
  class_names?: string[];
  poster_url?: string | null;
  home_images?: HomeImage[] | null;
  organization_slug?: string | null;
};

type NewsItem = {
  id: number;
  title: string;
  published_at: string;
  excerpt: string | null;
  image_url: string | null;
  category: string | null;
};

export default function RegattaHomePage() {
  const t = useTranslations('regattaHome');
  const tNav = useTranslations('regattaNav');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const params = useParams();
  const id = params?.id as string | undefined;
  const regattaId = useMemo(() => {
    const n = Number(id);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [id]);

  const [regatta, setRegatta] = useState<Regatta | null>(null);
  const [classNames, setClassNames] = useState<string[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);

  useEffect(() => {
    if (!regattaId) return;

    (async () => {
      try {
        const url = `${API_BASE}/regattas/${regattaId}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as Regatta;
        setRegatta(data);
        const fromRegatta = (data.class_names ?? []).map((c) => c.trim()).filter(Boolean);
        if (fromRegatta.length > 0) {
          setClassNames(fromRegatta);
        } else {
          try {
            const clsRes = await fetch(`${API_BASE}/regattas/${regattaId}/classes`, { cache: 'no-store' });
            if (clsRes.ok) {
              const cls = (await clsRes.json()) as string[];
              setClassNames(Array.isArray(cls) ? cls.map((c) => c.trim()).filter(Boolean) : []);
            } else {
              setClassNames([]);
            }
          } catch {
            setClassNames([]);
          }
        }

        const newsQs = new URLSearchParams({ limit: '6', offset: '0' });
        if (data.organization_slug) {
          newsQs.set('org', data.organization_slug);
        }
        const newsRes = await fetch(`${API_BASE}/news/?${newsQs}`, { cache: 'no-store' });
        if (newsRes.ok) {
          const newsData = (await newsRes.json()) as NewsItem[];
          setNews(Array.isArray(newsData) ? newsData : []);
        } else {
          setNews([]);
        }
      } catch (err) {
        console.error('Failed to fetch regatta:', err);
      }
    })();
  }, [regattaId]);

  const heroSlides = useMemo(() => {
    if (!regatta) return [];
    const homeImages = (regatta.home_images ?? []) as HomeImage[];
    if (homeImages.length > 0) {
      return homeImages.slice(0, 3).map((img) => ({
        url: img.url.startsWith('http') ? img.url : `${API_BASE}${img.url}`,
        position_x: Math.max(0, Math.min(100, img.position_x ?? 50)),
        position_y: Math.max(0, Math.min(100, img.position_y ?? 50)),
      }));
    }
    const poster = regatta.poster_url?.trim();
    if (poster) {
      return [{ url: poster.startsWith('http') ? poster : `${API_BASE}${poster}`, position_x: 50, position_y: 50 }];
    }
    return [];
  }, [regatta]);

  const [activeSlide, setActiveSlide] = useState(0);
  useEffect(() => {
    if (heroSlides.length <= 1) return;
    const t = setInterval(() => {
      setActiveSlide((i) => (i + 1) % heroSlides.length);
    }, 5000);
    return () => clearInterval(t);
  }, [heroSlides.length]);

  if (!regattaId) return <p className="p-8">{tCommon('loading')}</p>;
  if (!regatta) return <p className="p-8">{t('loadingRegatta')}</p>;

  const heroBgStyle = heroSlides[activeSlide]
    ? {
        backgroundImage: `url(${heroSlides[activeSlide].url})`,
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: `${heroSlides[activeSlide].position_x}% ${heroSlides[activeSlide].position_y}%`,
      }
    : undefined;

  const imageSrc = (url: string | null) =>
    !url ? null : url.startsWith('http') ? url : `${API_BASE}${url}`;

  const formatNewsDate = (s: string) => {
    try {
      return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
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

  const quickLinkMobileClass =
    'rounded-lg bg-slate-800 text-white text-center py-3 px-2 text-xs font-semibold uppercase tracking-wide border border-slate-700 hover:bg-slate-900 transition';
  const quickLinkDesktopClass =
    'flex flex-col items-center justify-center gap-2 py-6 px-4 rounded-lg bg-slate-800 text-white border border-slate-700 hover:bg-slate-900 transition shadow-md';

  return (
    <main className="min-h-screen bg-gray-50">
      <RegattaHeader
        regattaId={regattaId}
        organizationSlug={regatta?.organization_slug}
        overlayHero
      />

      {/* Hero: carousel de até 3 imagens, rotação automática, focal point personalizado */}
      <section
        className={`relative w-full min-h-[52vh] sm:min-h-[60vh] md:min-h-[80vh] flex flex-col items-center justify-center text-center py-10 sm:py-14 md:py-20 overflow-hidden ${REGATTA_HERO_HEADER_PT}`}
        style={{
          ...(heroBgStyle ?? { background: 'linear-gradient(135deg, #1e40af 0%, #0ea5e9 100%)' }),
        }}
      >
        <div className="absolute inset-0 bg-black/40" />
        {heroSlides.length > 1 && (
          <div className="absolute bottom-4 left-0 right-0 z-20 flex justify-center gap-2">
            {heroSlides.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={t('slide', { index: i + 1 })}
                onClick={() => setActiveSlide(i)}
                className={`w-2.5 h-2.5 rounded-full transition ${
                  i === activeSlide ? 'bg-white scale-125' : 'bg-white/50 hover:bg-white/80'
                }`}
              />
            ))}
          </div>
        )}
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-white">
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold mb-2 sm:mb-3 drop-shadow-lg leading-tight">
            {regatta.name}
          </h1>
          <p className="text-base sm:text-lg md:text-xl font-medium opacity-95 drop-shadow">{regatta.location}</p>
          {classNames.length > 0 && (
            <p className="text-xl md:text-2xl font-semibold mt-2 md:mt-3 opacity-95 drop-shadow tracking-tight">
              {classNames.join(' • ')}
            </p>
          )}
          <p className="text-base md:text-lg mt-2 md:mt-3 opacity-90 drop-shadow">
            {formatDateRange(regatta.start_date, regatta.end_date, locale)}
          </p>
        </div>
      </section>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8">
      {/* Mobile: atalhos compactos (desktop usa grelha maior abaixo) */}
      <section className="mb-6 md:hidden">
        <div className="grid grid-cols-2 gap-2">
          <Link
            href={`/regattas/${regattaId}/form`}
            className={quickLinkMobileClass}
          >
            {tNav('onlineEntry')}
          </Link>
          <Link
            href={`/regattas/${regattaId}/entry`}
            className={quickLinkMobileClass}
          >
            {tNav('entryList')}
          </Link>
          <Link
            href={`/regattas/${regattaId}/notice`}
            className={quickLinkMobileClass}
          >
            {tNav('noticeBoard')}
          </Link>
          <Link
            href={`/regattas/${regattaId}/results`}
            className={quickLinkMobileClass}
          >
            {tNav('results')}
          </Link>
        </div>
      </section>

      {/* Navegação rápida: botões grandes no desktop */}
      <section className="mb-12 hidden md:block">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href={`/regattas/${regattaId}/form`}
            className={quickLinkDesktopClass}
          >
            <PenLine className="w-8 h-8" strokeWidth={2} />
            <span className="font-semibold text-sm uppercase tracking-wide">{tNav('onlineEntry')}</span>
          </Link>
          <Link
            href={`/regattas/${regattaId}/entry`}
            className={quickLinkDesktopClass}
          >
            <List className="w-8 h-8" strokeWidth={2} />
            <span className="font-semibold text-sm uppercase tracking-wide">{tNav('entryList')}</span>
          </Link>
          <Link
            href={`/regattas/${regattaId}/notice`}
            className={quickLinkDesktopClass}
          >
            <FileText className="w-8 h-8" strokeWidth={2} />
            <span className="font-semibold text-sm uppercase tracking-wide">{tNav('noticeBoard')}</span>
          </Link>
          <Link
            href={`/regattas/${regattaId}/results`}
            className={quickLinkDesktopClass}
          >
            <Trophy className="w-8 h-8" strokeWidth={2} />
            <span className="font-semibold text-sm uppercase tracking-wide">{tNav('results')}</span>
          </Link>
        </div>
      </section>

      {news.length > 0 && (
        <section className="mt-0">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">{t('news')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {news.map((n) => (
              <Link
                key={n.id}
                href={`/news/${n.id}`}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition group"
              >
                {n.image_url && (
                  <div className="aspect-video bg-gray-200 overflow-hidden">
                    <img
                      src={imageSrc(n.image_url) ?? ''}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition"
                    />
                  </div>
                )}
                <div className="p-4">
                  <p className="text-xs text-gray-500 mb-1">{formatNewsDate(n.published_at)}</p>
                  <h3 className="font-semibold text-gray-900 group-hover:text-blue-600">{n.title}</h3>
                  {bodyToSnippet(n.excerpt, 120) && (
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">{bodyToSnippet(n.excerpt, 120)}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
          <Link href="/news" className="inline-block mt-4 text-blue-600 font-medium hover:underline">
            {t('viewAllNews')}
          </Link>
        </section>
      )}

      </div>
    </main>
  );
}
