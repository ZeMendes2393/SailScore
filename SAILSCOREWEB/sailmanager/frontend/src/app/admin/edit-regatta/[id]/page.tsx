'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import RequireAuth from '@/components/RequireAuth';
import { useAuth } from '@/context/AuthContext';
import { apiGet, apiSend } from '@/lib/api';

const AVAILABLE_CLASSES = [
  '420',
  '470',
  '49er',
  '49erFX',
  'ILCA 4',
  'ILCA 6',
  'ILCA 7',
  'Optimist',
  'Snipe',
  'Nacra 17',
];

type Regatta = {
  id: number;
  name: string;
  location: string;
  start_date: string;
  end_date: string;
};

type RegattaClass = {
  id: number;
  regatta_id: number;
  class_name: string;
};

export default function EditRegattaPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const regattaId = useMemo(() => Number(params?.id), [params?.id]);

  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<Regatta | null>(null);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [newClass, setNewClass] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);
  const [savingClasses, setSavingClasses] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    if (!Number.isFinite(regattaId)) return;
    setLoading(true);
    try {
      // meta
      const r = await apiGet<Regatta>(`/regattas/${regattaId}`);
      setMeta(r);
      setName(r.name);
      setLocation(r.location);
      setStartDate(r.start_date || '');
      setEndDate(r.end_date || '');

      // classes atuais
      const cls = await apiGet<RegattaClass[]>(`/regatta-classes/by_regatta/${regattaId}`);
      const names = Array.from(new Set(cls.map((c) => (c.class_name || '').trim()).filter(Boolean)));
      setSelectedClasses(names);
    } catch (e) {
      console.error('Load regatta error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regattaId]);

  const toggleClass = (className: string) => {
    setSelectedClasses((prev) =>
      prev.includes(className) ? prev.filter((c) => c !== className) : [...prev, className]
    );
  };

  const addCustomClass = () => {
    const c = newClass.trim();
    if (!c) return;
    setSelectedClasses((prev) => (prev.includes(c) ? prev : [...prev, c]));
    setNewClass('');
  };

  const saveMeta = async () => {
    if (!token || !meta) return alert('Sem sessão.');
    setSavingMeta(true);
    try {
      await apiSend<Regatta>(
        `/regattas/${regattaId}`,
        'PATCH',
        { name, location, start_date: startDate, end_date: endDate },
        token
      );
      alert('Dados atualizados.');
      await load();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Falha ao atualizar dados.');
    } finally {
      setSavingMeta(false);
    }
  };

  const saveClasses = async () => {
    if (!token) return alert('Sem sessão.');
    setSavingClasses(true);
    try {
      await apiSend<{ updated: number }>(
        `/regattas/${regattaId}/classes`,
        'PUT',
        { classes: selectedClasses },
        token
      );
      alert('Classes atualizadas.');
      await load();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Falha ao atualizar classes.');
    } finally {
      setSavingClasses(false);
    }
  };

  const deleteRegatta = async () => {
    if (!token) return alert('Sem sessão.');
    if (!confirm('Apagar esta regata? Esta ação é irreversível.')) return;
    setDeleting(true);
    try {
      await apiSend<void>(`/regattas/${regattaId}`, 'DELETE', undefined, token);
      alert('Regata apagada.');
      router.push('/admin');
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Falha ao apagar regata.');
    } finally {
      setDeleting(false);
    }
  };

  if (!Number.isFinite(regattaId)) {
    return <div className="p-6">Regatta ID inválido.</div>;
  }

  return (
    <RequireAuth roles={['admin']}>
      <div className="max-w-3xl mx-auto p-6 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Editar Regata #{regattaId}</h1>
          <button onClick={() => router.push('/admin')} className="border rounded px-3 py-1">
            Voltar
          </button>
        </div>

        {loading ? (
          <div className="text-gray-500">A carregar…</div>
        ) : (
          <>
            {/* Meta */}
            <section className="bg-white rounded border p-6 space-y-4">
              <h2 className="font-semibold">Dados principais</h2>
              <input
                className="w-full border rounded px-3 py-2"
                placeholder="Nome da Regata"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                className="w-full border rounded px-3 py-2"
                placeholder="Localização"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
              <div className="flex gap-3">
                <input
                  type="date"
                  className="w-full border rounded px-3 py-2"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <input
                  type="date"
                  className="w-full border rounded px-3 py-2"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <button
                className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60"
                onClick={saveMeta}
                disabled={savingMeta}
              >
                {savingMeta ? 'A guardar…' : 'Guardar dados'}
              </button>
            </section>

            {/* Classes */}
            <section className="bg-white rounded border p-6 space-y-4">
              <h2 className="font-semibold">Classes</h2>

              <div className="grid grid-cols-2 gap-2">
                {AVAILABLE_CLASSES.map((c) => (
                  <label key={c} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      value={c}
                      checked={selectedClasses.includes(c)}
                      onChange={() => toggleClass(c)}
                    />
                    {c}
                  </label>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  className="border rounded px-3 py-2 flex-1"
                  placeholder="Adicionar classe personalizada"
                  value={newClass}
                  onChange={(e) => setNewClass(e.target.value)}
                />
                <button className="border rounded px-3" type="button" onClick={addCustomClass}>
                  Adicionar
                </button>
              </div>

              {selectedClasses.length > 0 && (
                <p className="text-xs text-gray-600">
                  Selecionadas: {selectedClasses.join(', ')}
                </p>
              )}

              <button
                className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60"
                onClick={saveClasses}
                disabled={savingClasses}
              >
                {savingClasses ? 'A guardar…' : 'Guardar classes'}
              </button>
            </section>

            {/* Danger zone */}
            <section className="bg-white rounded border p-6 space-y-3">
              <h2 className="font-semibold text-red-700">Apagar regata</h2>
              <p className="text-sm text-gray-600">
                Esta ação é permanente e apaga todos os dados associados a esta regata.
              </p>
              <button
                className="border border-red-300 text-red-700 rounded px-4 py-2 hover:bg-red-50 disabled:opacity-60"
                onClick={deleteRegatta}
                disabled={deleting}
              >
                {deleting ? 'A apagar…' : 'Apagar regata'}
              </button>
            </section>
          </>
        )}
      </div>
    </RequireAuth>
  );
}
