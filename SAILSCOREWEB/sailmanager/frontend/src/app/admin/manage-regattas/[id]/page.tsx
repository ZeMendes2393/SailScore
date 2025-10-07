'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import MultiStepEntryForm from '@/components/onlineentry/MultiStepEntryForm';
import NoticeBoard from '../../../regattas/[id]/components/noticeboard/NoticeBoard';
import AdminResultsClient from './results/AdminResultsClient';
import { useAuth } from '@/context/AuthContext';
import { apiGet, apiSend } from '@/lib/api';
import AdminNoticeBoard from './noticeboard/AdminNoticeBoard';
import AdminEntryList from './entries/AdminEntryList';

interface Regatta {
  id: number;
  name: string;
  location: string;
  start_date: string;
  end_date: string;
  status?: string;
}

type Tab = 'entry' | 'notice' | 'form' | 'results' | 'edit' | 'delete';

export default function AdminRegattaPage() {
  const { id } = useParams();
  const regattaId = parseInt(id as string);
  const router = useRouter();
  const { token, user } = useAuth();

  const [regatta, setRegatta] = useState<Regatta | null>(null);
  const [activeTab, setActiveTab] = useState<Tab | null>(null);

  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // form de edição
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    const fetchRegatta = async () => {
      const r = await apiGet<Regatta>(`/regattas/${regattaId}`).catch(() => null);
      if (r) {
        setRegatta(r);
        setName(r.name);
        setLocation(r.location);
        setStartDate(r.start_date);
        setEndDate(r.end_date);
      }
    };
    const fetchClasses = async () => {
      const data = await apiGet<string[]>(`/regattas/${regattaId}/classes`).catch(() => []);
      setAvailableClasses(Array.isArray(data) ? data : []);
    };
    if (Number.isFinite(regattaId)) {
      fetchRegatta();
      fetchClasses();
    }
  }, [regattaId]);

  useEffect(() => {
    if (activeTab === 'entry' && !selectedClass && availableClasses.length > 0) {
      setSelectedClass(availableClasses[0] ?? null);
    }
  }, [activeTab, availableClasses, selectedClass]);

  if (!regatta) return <p className="p-8">A carregar regata...</p>;

  const isResults = activeTab === 'results';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      alert('Sem sessão. Inicia sessão de admin.');
      router.push('/admin/login');
      return;
    }
    setSaving(true);
    try {
      const patched = await apiSend<Regatta>(
        `/regattas/${regattaId}`,
        'PATCH',
        { name, location, start_date: startDate, end_date: endDate },
        token
      );
      setRegatta(patched);
      alert('Regata atualizada.');
      setActiveTab(null);
    } catch (err: any) {
      alert(err?.message || 'Erro ao atualizar regata.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!token) {
      alert('Sem sessão. Inicia sessão de admin.');
      router.push('/admin/login');
      return;
    }
    if (!confirm('Tens a certeza que queres apagar esta regata? Esta ação é irreversível.')) {
      return;
    }
    setDeleting(true);
    try {
      await apiSend(`/regattas/${regattaId}`, 'DELETE', {}, token);
      alert('Regata apagada.');
      router.replace('/admin');
    } catch (err: any) {
      alert(err?.message || 'Falha ao apagar regata.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow rounded p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">{regatta.name}</h1>
            <p className="text-gray-600">
              {regatta.location} | {regatta.start_date} – {regatta.end_date}
            </p>
            <span className="bg-blue-200 text-blue-800 px-2 py-1 rounded text-xs mt-2 inline-block">
              {regatta.status || 'Scheduled'}
            </span>
          </div>
          <div className="text-xs text-gray-500">
            {user?.email ? <>Admin: <b>{user.email}</b></> : null}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white shadow rounded mb-4 px-6 py-4 flex gap-6 text-blue-600 font-semibold flex-wrap">
        <button onClick={() => setActiveTab('entry')} className="hover:underline">Entry List</button>
        <button onClick={() => setActiveTab('notice')} className="hover:underline">Notice Board</button>
        <button onClick={() => setActiveTab('form')} className="hover:underline">Online Entry</button>
        <button onClick={() => setActiveTab('results')} className="hover:underline">Results</button>
        {/* novas tabs */}
        <span className="mx-2 text-gray-300">|</span>
        <button onClick={() => setActiveTab('edit')} className="hover:underline">Editar</button>
        <button onClick={() => setActiveTab('delete')} className="hover:underline text-red-600">Eliminar</button>
      </div>

      {/* Class selector (só para Entry List) */}
      {activeTab === 'entry' && availableClasses.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
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

      {/* OUTRAS TABS no card “estreito” */}
      {!isResults && activeTab !== 'edit' && activeTab !== 'delete' && (
        <div className="p-6 bg-white rounded shadow">
          {activeTab === 'entry' && (
  <AdminEntryList regattaId={regattaId} selectedClass={selectedClass} />
)}

          {activeTab === 'notice' && <AdminNoticeBoard regattaId={regattaId} />}
          {activeTab === 'form' && (
            <p className="text-sm text-gray-500">
              Admins não podem submeter inscrições. Esta área está visível apenas para consistência visual.
            </p>
          )}
          {!activeTab && (
            <p className="text-gray-600">Escolhe uma secção acima para ver os detalhes desta regata.</p>
          )}
        </div>
      )}

      {/* RESULTS: full-bleed */}
      {isResults && (
        <section className="mt-2">
          <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen">
            <div className="px-6">
              <AdminResultsClient regattaId={regattaId} />
            </div>
          </div>
        </section>
      )}

      {/* EDITAR */}
      {activeTab === 'edit' && (
        <div className="p-6 bg-white rounded shadow max-w-2xl">
          <h2 className="text-xl font-semibold mb-4">Editar regata</h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Nome</label>
              <input
                className="w-full border rounded px-3 py-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Localização</label>
              <input
                className="w-full border rounded px-3 py-2"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
              />
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1">Data início</label>
                <input
                  type="date"
                  className="w-full border rounded px-3 py-2"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Data fim</label>
                <input
                  type="date"
                  className="w-full border rounded px-3 py-2"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
              >
                {saving ? 'A guardar…' : 'Guardar alterações'}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab(null)}
                className="px-4 py-2 rounded border"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ELIMINAR */}
      {activeTab === 'delete' && (
        <div className="p-6 bg-white rounded shadow max-w-2xl">
          <h2 className="text-xl font-semibold mb-2 text-red-700">Eliminar regata</h2>
          <p className="text-sm text-gray-700">
            Esta ação é <b>irreversível</b>. Vai apagar a regata <b>{regatta.name}</b> e todos os dados
            associados (inscrições, corridas, resultados, protestos, etc.).
          </p>
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 rounded bg-red-600 text-white disabled:opacity-60"
            >
              {deleting ? 'A eliminar…' : 'Eliminar definitivamente'}
            </button>
            <button
              onClick={() => setActiveTab(null)}
              className="px-4 py-2 rounded border"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
