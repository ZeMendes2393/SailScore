'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

import OnlineEntryPublic from '@/components/onlineentry/OnlineEntryPublic';
import EntryList from './components/entrylist/EntryList';
import NoticeBoard from './components/noticeboard/NoticeBoard';

// keep in sync with your api.ts
const API_BASE =
  (process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ||
    'http://127.0.0.1:8000');

type Regatta = {
  id: number;
  name: string;
  location: string;
  start_date: string;
  end_date: string;
  status?: string;
  online_entry_open?: boolean; // 👈 novo
};

export default function RegattaDetails() {
  const params = useParams();
  const router = useRouter();

  const id = params?.id as string | undefined;
  const regattaId = useMemo(() => {
    const n = Number(id);
    return Number.isFinite(n) && n > 0 ? n : 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const [regatta, setRegatta] = useState<Regatta | null>(null);
  const [activeTab, setActiveTab] = useState<'entry' | 'notice' | 'form' | null>(null);

  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [classesError, setClassesError] = useState<string | null>(null);

  useEffect(() => {
    if (!regattaId) return;

    (async () => {
      try {
        const url = `${API_BASE}/regattas/${regattaId}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as Regatta;
        setRegatta(data);
      } catch (err) {
        console.error('Failed to fetch regatta:', err);
      }
    })();

    (async () => {
      setLoadingClasses(true);
      setClassesError(null);
      try {
        const url = `${API_BASE}/regattas/${regattaId}/classes`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) {
          setAvailableClasses([]);
          setClassesError('Could not load classes for this regatta.');
          return;
        }
        const arr = await res.json();
        setAvailableClasses(Array.isArray(arr) ? (arr as string[]) : []);
      } catch (err) {
        setAvailableClasses([]);
        setClassesError('Network error while loading classes.');
      } finally {
        setLoadingClasses(false);
      }
    })();
  }, [regattaId]);

  useEffect(() => {
    if (activeTab === 'entry' && !selectedClass && availableClasses.length > 0) {
      setSelectedClass(availableClasses[0]);
    }
  }, [activeTab, availableClasses, selectedClass]);

  if (!regattaId) return <p className="p-8">Loading…</p>;
  if (!regatta) return <p className="p-8">Loading regatta…</p>;

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="bg-white shadow rounded p-6 mb-6">
        <h1 className="text-3xl font-bold mb-2">{regatta.name}</h1>
        <p className="text-gray-600">
          {regatta.location} | {regatta.start_date} – {regatta.end_date}
        </p>
        <span className="bg-blue-200 text-blue-800 px-2 py-1 rounded text-xs mt-2 inline-block">
          {regatta.status || 'Scheduled'}
        </span>
      </div>

      {/* CLASS SELECTOR */}
      <div className="mb-6">
        {loadingClasses && <p className="text-gray-500">Loading classes…</p>}
        {!loadingClasses && classesError && <p className="text-red-700">{classesError}</p>}
        {!loadingClasses && !classesError && availableClasses.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap">
            {availableClasses.map((cls) => (
              <button
                key={cls}
                onClick={() => setSelectedClass(cls)}
                className={`px-3 py-1 rounded font-semibold border ${
                  selectedClass === cls
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-blue-600 border-blue-600'
                }`}
              >
                {cls}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* NAV + Sailor Account */}
      <div className="bg-white shadow rounded mb-4 px-6 py-4 flex items-center justify-between">
        <div className="flex gap-6 text-blue-600 font-semibold">
          <button onClick={() => setActiveTab('entry')} className="hover:underline">
            Entry List
          </button>
          <button onClick={() => setActiveTab('notice')} className="hover:underline">
            Notice Board
          </button>
          <button onClick={() => setActiveTab('form')} className="hover:underline">
            Online Entry
          </button>
          <button onClick={() => router.push(`/regattas/${id}/results`)} className="hover:underline">
            Results
          </button>
        </div>

        <div>
          <Link href={`/login?regattaId=${regattaId}`}>
            <button className="text-sm bg-gray-900 text-white px-3 py-1 rounded hover:bg-gray-800">
              Sailor account
            </button>
          </Link>
        </div>
      </div>

      {/* TAB CONTENT */}
      <div className="p-6 bg-white rounded shadow">
        {activeTab === 'entry' && (
          <EntryList regattaId={regattaId} selectedClass={selectedClass} />
        )}

        {activeTab === 'notice' && <NoticeBoard regattaId={regattaId} />}

        {activeTab === 'form' && (
          regatta.online_entry_open !== false  // undefined => trata como aberto
            ? <OnlineEntryPublic regattaId={regattaId} />
            : (
              <div className="p-4 rounded border bg-amber-50 text-amber-800">
                Online entries are currently closed.
              </div>
            )
        )}

        {!activeTab && (
          <p className="text-gray-600">
            Choose a section above to see the details of this regatta.
          </p>
        )}
      </div>
    </main>
  );
}
