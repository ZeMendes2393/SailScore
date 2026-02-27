'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import RegattaHeader from '../components/RegattaHeader';
import EntryList from '../components/entrylist/EntryList';
import { getVisibleColumnsForClass } from '@/lib/entryListColumns';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://127.0.0.1:8000';

type Regatta = {
  id: number;
  name: string;
  location: string;
  start_date: string;
  end_date: string;
  poster_url?: string | null;
  entry_list_columns?: string[] | Record<string, string[]> | null;
};

export default function RegattaEntryPage() {
  const params = useParams();
  const id = params?.id as string | undefined;
  const regattaId = useMemo(() => {
    const n = Number(id);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [id]);

  const [regatta, setRegatta] = useState<Regatta | null>(null);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [classesError, setClassesError] = useState<string | null>(null);

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
      setLoadingClasses(true);
      setClassesError(null);
      try {
        const res = await fetch(`${API_BASE}/regattas/${regattaId}/classes`, { cache: 'no-store' });
        if (!res.ok) {
          setAvailableClasses([]);
          setClassesError('Could not load classes.');
          return;
        }
        const arr = (await res.json()) as string[];
        setAvailableClasses(Array.isArray(arr) ? arr : []);
        setSelectedClass((prev) => prev ?? arr[0] ?? null);
      } catch {
        setAvailableClasses([]);
        setClassesError('Network error.');
      } finally {
        setLoadingClasses(false);
      }
    })();
  }, [regattaId]);

  const heroImageUrl = regatta?.poster_url?.trim();
  const heroBgStyle = heroImageUrl
    ? {
        backgroundImage: `url(${heroImageUrl.startsWith('http') ? heroImageUrl : `${API_BASE}${heroImageUrl}`})`,
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
      }
    : undefined;

  const formatDateRange = (start: string, end: string) => {
    try {
      const s = new Date(start);
      const e = new Date(end);
      const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
      if (s.getTime() === e.getTime()) return s.toLocaleDateString('pt-PT', opts);
      return `${s.toLocaleDateString('pt-PT', opts)} – ${e.toLocaleDateString('pt-PT', opts)}`;
    } catch {
      return `${start} – ${end}`;
    }
  };

  if (!regattaId) return <p className="p-8">Loading…</p>;
  if (!regatta) return <p className="p-8">Loading regatta…</p>;

  return (
    <main className="min-h-screen bg-gray-50">
      <RegattaHeader regattaId={regattaId} />
      <section
        className="relative w-screen text-center py-16 md:py-20"
        style={{
          marginLeft: 'calc(50% - 50vw)',
          marginRight: 'calc(50% - 50vw)',
          ...(heroBgStyle ?? { background: 'linear-gradient(135deg, #1e40af 0%, #0ea5e9 100%)' }),
        }}
      >
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative z-10 max-w-4xl mx-auto px-6 text-white">
          <h1 className="text-3xl md:text-4xl font-extrabold mb-2 drop-shadow-lg">{regatta.name}</h1>
          <p className="text-base md:text-lg opacity-95 drop-shadow">
            {regatta.location} · {formatDateRange(regatta.start_date, regatta.end_date)}
          </p>
        </div>
      </section>
      <div className="container-page py-8">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Entry List</h2>
        {loadingClasses && <p className="text-gray-500">A carregar classes…</p>}
        {!loadingClasses && classesError && <p className="text-red-700">{classesError}</p>}
        {!loadingClasses && !classesError && availableClasses.length > 0 && (
          <div className="flex gap-2 mb-6 flex-wrap">
            {availableClasses.map((cls) => (
              <button
                key={cls}
                onClick={() => setSelectedClass(cls)}
                className={`px-3 py-1 rounded font-semibold border ${
                  selectedClass === cls ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 border-blue-600'
                }`}
              >
                {cls}
              </button>
            ))}
          </div>
        )}
        <div className="bg-white shadow rounded p-6">
          <EntryList
            regattaId={regattaId}
            selectedClass={selectedClass}
            entryListColumns={getVisibleColumnsForClass(regatta.entry_list_columns, selectedClass)}
          />
        </div>
      </div>
    </main>
  );
}
