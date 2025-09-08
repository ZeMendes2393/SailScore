'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

import MultiStepEntryForm from '@/components/onlineentry/MultiStepEntryForm';
import EntryList from './components/entrylist/EntryList';
import NoticeBoard from './components/noticeboard/NoticeBoard';
import NoticeBoardPublic from './components/noticeboard/components/NoticeBoardPublic';

interface Regatta {
  id: number;
  name: string;
  location: string;
  start_date: string;
  end_date: string;
  status?: string;
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:8000';

export default function RegattaDetails() {
  const params = useParams();
  const id = params.id as string;
  const regattaId = useMemo(() => Number(id), [id]);
  const router = useRouter();

  const [regatta, setRegatta] = useState<Regatta | null>(null);
  const [activeTab, setActiveTab] = useState<'entry' | 'notice' | 'form' | null>(null);

  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [classesError, setClassesError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/regattas/${regattaId}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as Regatta;
        setRegatta(data);
      } catch (err) {
        console.error('❌ Falha ao obter regata:', err);
      }
    })();

    (async () => {
      setLoadingClasses(true);
      setClassesError(null);
      try {
        const res = await fetch(`${API_BASE}/regattas/${regattaId}/classes`, { cache: 'no-store' });
        if (!res.ok) {
          setAvailableClasses([]);
          setClassesError('Não foi possível carregar as classes desta regata.');
          return;
        }
        const arr = (await res.json()) as unknown;
        setAvailableClasses(Array.isArray(arr) ? (arr as string[]) : []);
      } catch (err) {
        setAvailableClasses([]);
        setClassesError('Erro de rede ao carregar classes.');
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

  if (!regatta) return <p className="p-8">A carregar regata...</p>;

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
        {loadingClasses && <p className="text-gray-500">A carregar classes…</p>}
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

      {/* NAVIGATION + Sailor Account */}
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
        {activeTab === 'entry' && <EntryList regattaId={regattaId} selectedClass={selectedClass} />}
        {activeTab === 'notice' && <NoticeBoardPublic regattaId={regattaId} />}
        {activeTab === 'form' && <MultiStepEntryForm regattaId={regattaId} />}

        {!activeTab && (
          <p className="text-gray-600">Escolhe uma secção acima para ver os detalhes desta regata.</p>
        )}
      </div>
    </main>
  );
}
