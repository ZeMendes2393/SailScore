'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import RegattaHeader, { REGATTA_HERO_HEADER_PT } from '../components/RegattaHeader';
import OnlineEntryPublic from '@/components/onlineentry/OnlineEntryPublic';
import { formatDateRange } from '@/lib/formatDate';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://127.0.0.1:8000';

type HomeImage = { url: string; position_x?: number; position_y?: number };

type Regatta = {
  id: number;
  name: string;
  location: string;
  start_date: string;
  end_date: string;
  poster_url?: string | null;
  home_images?: HomeImage[] | null;
  online_entry_open?: boolean;
};

export default function RegattaFormPage() {
  const params = useParams();
  const id = params?.id as string | undefined;
  const regattaId = useMemo(() => {
    const n = Number(id);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [id]);

  const [regatta, setRegatta] = useState<Regatta | null>(null);
  const [classNames, setClassNames] = useState<string[]>([]);

  useEffect(() => {
    if (!regattaId) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/regattas/${regattaId}`, { cache: 'no-store' });
        if (res.ok) {
          const data = (await res.json()) as Regatta;
          setRegatta(data);
        }
      } catch {
        setRegatta(null);
      }
    })();
    (async () => {
      try {
        const clsRes = await fetch(`${API_BASE}/regattas/${regattaId}/classes`, { cache: 'no-store' });
        if (!clsRes.ok) {
          setClassNames([]);
          return;
        }
        const cls = (await clsRes.json()) as string[];
        setClassNames(Array.isArray(cls) ? cls.map((c) => c.trim()).filter(Boolean) : []);
      } catch {
        setClassNames([]);
      }
    })();
  }, [regattaId]);

  const hi = regatta?.home_images?.[0];
  const heroImageUrl = (regatta?.poster_url?.trim() || hi?.url)?.trim();
  const heroPos = hi ? { x: hi.position_x ?? 50, y: hi.position_y ?? 50 } : { x: 50, y: 50 };
  const heroBgStyle = heroImageUrl
    ? {
        backgroundImage: `url(${heroImageUrl.startsWith('http') ? heroImageUrl : `${API_BASE}${heroImageUrl}`})`,
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: `${heroPos.x}% ${heroPos.y}%`,
      }
    : undefined;

  if (!regattaId) return <p className="p-8">Loading…</p>;
  if (!regatta) return <p className="p-8">Loading regatta…</p>;

  const isOpen = regatta.online_entry_open !== false;

  return (
    <main className="min-h-screen bg-gray-50">
      <RegattaHeader regattaId={regattaId} overlayHero />
      <section
        className={`relative w-screen text-center py-16 md:py-20 ${REGATTA_HERO_HEADER_PT}`}
        style={{
          marginLeft: 'calc(50% - 50vw)',
          marginRight: 'calc(50% - 50vw)',
          ...(heroBgStyle ?? { background: 'linear-gradient(135deg, #1e40af 0%, #0ea5e9 100%)' }),
        }}
      >
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative z-10 max-w-4xl mx-auto px-6 text-white">
          <h1 className="text-3xl md:text-4xl font-extrabold mb-2 drop-shadow-lg">{regatta.name}</h1>
          {classNames.length > 0 && (
            <p className="text-lg md:text-xl font-semibold opacity-95 drop-shadow mb-1">
              {classNames.join(' • ')}
            </p>
          )}
          <p className="text-base md:text-lg opacity-95 drop-shadow">
            {regatta.location} · {formatDateRange(regatta.start_date, regatta.end_date)}
          </p>
        </div>
      </section>
      <div className="container-page py-8">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Online Entry</h2>
        <div className="bg-white shadow rounded p-6">
          {isOpen ? (
            <OnlineEntryPublic regattaId={regattaId} />
          ) : (
            <div className="p-4 rounded border bg-amber-50 text-amber-800">
              Online entries are currently closed.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
