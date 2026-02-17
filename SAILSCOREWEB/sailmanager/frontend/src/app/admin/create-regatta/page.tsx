'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import RequireAuth from '@/components/RequireAuth';
import { useAuth } from '@/context/AuthContext';
import { apiSend } from '@/lib/api';

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

export default function CreateRegattaPage() {
  const router = useRouter();
  const { token, user } = useAuth();

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  type OneDesignItem = { class_name: string; sailors_per_boat: number };
  const [selectedOneDesign, setSelectedOneDesign] = useState<OneDesignItem[]>([]);
  const [selectedHandicap, setSelectedHandicap] = useState<string[]>([]);
  const [newClassOD, setNewClassOD] = useState('');
  const [newSailorsOD, setNewSailorsOD] = useState(1);
  const [newClassH, setNewClassH] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const toggleOneDesign = (className: string) => {
    setSelectedOneDesign((prev) => {
      const has = prev.some((c) => c.class_name === className);
      if (has) return prev.filter((c) => c.class_name !== className);
      return [...prev, { class_name: className, sailors_per_boat: 1 }].sort((a, b) => a.class_name.localeCompare(b.class_name));
    });
  };

  const setSailorsOD = (className: string, sailors: number) => {
    setSelectedOneDesign((prev) =>
      prev.map((x) => (x.class_name === className ? { ...x, sailors_per_boat: sailors } : x))
    );
  };

  const addCustomOneDesign = () => {
    const c = newClassOD.trim();
    if (!c) return;
    const key = c.toLowerCase();
    if (selectedOneDesign.some((x) => x.class_name.toLowerCase() === key) || selectedHandicap.some((x) => x.toLowerCase() === key))
      return;
    setSelectedOneDesign((prev) => [...prev, { class_name: c, sailors_per_boat: newSailorsOD }].sort((a, b) => a.class_name.localeCompare(b.class_name)));
    setNewClassOD('');
  };

  const toggleHandicap = (className: string) => {
    setSelectedHandicap((prev) =>
      prev.includes(className) ? prev.filter((c) => c !== className) : [...prev, className]
    );
  };

  const addCustomHandicap = () => {
    const c = newClassH.trim();
    if (!c) return;
    const key = c.toLowerCase();
    if (selectedOneDesign.some((x) => x.class_name.toLowerCase() === key) || selectedHandicap.some((x) => x.toLowerCase() === key))
      return;
    setSelectedHandicap((prev) => [...prev, c].sort((a, b) => a.localeCompare(b)));
    setNewClassH('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      alert('Sem sessão. Faz login de novo.');
      router.push('/admin/login');
      return;
    }
    setSubmitting(true);
    try {
      // 1) Criar regata
      const regatta = await apiSend<{ id: number }>(
        '/regattas/', // trailing slash evita 307/308
        'POST',
        { name, location, start_date: startDate, end_date: endDate },
        token
      );

      // 2) Substituir classes (se houver)
      const classesPayload = [
        ...selectedOneDesign.map((c) => ({ class_name: c.class_name, class_type: 'one_design' as const, sailors_per_boat: c.sailors_per_boat })),
        ...selectedHandicap.map((c) => ({ class_name: c, class_type: 'handicap' as const })),
      ];
      if (classesPayload.length > 0) {
        await apiSend(
          `/regattas/${regatta.id}/classes`,
          'PUT',
          { classes: classesPayload },
          token
        );
      }

      // Ir para a página central (admin)
      router.push('/admin');
    } catch (err: any) {
      console.error('Create regatta error:', err);
      alert(err?.message || 'Erro ao criar regata.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RequireAuth roles={['admin']}>
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Criar Nova Regata</h1>

        <div className="mb-4 text-sm text-gray-600">
          Sessão: {user?.email ?? '—'} {token ? '✅' : '❌'}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 shadow rounded">
          <input
            type="text"
            placeholder="Nome da Regata"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border p-2 rounded"
            required
          />
          <input
            type="text"
            placeholder="Localização"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full border p-2 rounded"
            required
          />
          <div className="flex gap-4">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border p-2 rounded"
              required
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border p-2 rounded"
              required
            />
          </div>

          <div>
            <p className="font-medium mb-2">Classes</p>
            <p className="text-xs text-gray-500 mb-3">One Design e Handicap separados.</p>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="border rounded p-3">
                <h4 className="text-sm font-semibold mb-2">One Design</h4>
                <p className="text-xs text-gray-500 mb-2">Nº de velejadores por embarcação.</p>
                <div className="grid grid-cols-2 gap-1 mb-2">
                  {AVAILABLE_CLASSES.map((c) => (
                    <label key={c} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedOneDesign.some((x) => x.class_name === c)}
                        onChange={() => toggleOneDesign(c)}
                      />
                      {c}
                    </label>
                  ))}
                </div>
                {selectedOneDesign.length > 0 && (
                  <div className="mb-2 space-y-1">
                    {selectedOneDesign.map((item) => (
                      <div key={item.class_name} className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{item.class_name}</span>
                        <label className="text-xs text-gray-600">Velejadores:</label>
                        <select value={item.sailors_per_boat} onChange={(e) => setSailorsOD(item.class_name, Number(e.target.value))} className="border rounded px-1.5 py-0.5 text-sm w-14">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 mt-2 flex-wrap items-end">
                  <input
                    className="border rounded px-2 py-1.5 flex-1 min-w-[100px] text-sm"
                    placeholder="Outra classe (ex: RS Aero)"
                    value={newClassOD}
                    onChange={(e) => setNewClassOD(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomOneDesign())}
                  />
                  <select value={newSailorsOD} onChange={(e) => setNewSailorsOD(Number(e.target.value))} className="border rounded px-2 py-1.5 text-sm w-14">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>{n} vel.</option>
                    ))}
                  </select>
                  <button type="button" className="border rounded px-2" onClick={addCustomOneDesign}>
                    +
                  </button>
                </div>
              </div>

              <div className="border rounded p-3">
                <h4 className="text-sm font-semibold mb-2">Handicap</h4>
                <p className="text-xs text-gray-500 mb-2">Ex: ANC A, ANC B, IRC, ORC…</p>
                <div className="flex flex-wrap gap-1 mb-2">
                  {selectedHandicap.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded text-sm"
                    >
                      {c}
                      <button
                        type="button"
                        onClick={() => toggleHandicap(c)}
                        className="text-red-600 hover:underline"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <input
                    className="border rounded px-2 py-1.5 flex-1 text-sm"
                    placeholder="ex: ANC A"
                    value={newClassH}
                    onChange={(e) => setNewClassH(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomHandicap())}
                  />
                  <button type="button" className="border rounded px-2" onClick={addCustomHandicap}>
                    +
                  </button>
                </div>
              </div>
            </div>

            {(selectedOneDesign.length > 0 || selectedHandicap.length > 0) && (
              <p className="text-xs text-gray-600 mt-2">
                One Design: {selectedOneDesign.map((c) => `${c.class_name} (${c.sailors_per_boat} vel.)`).join(', ') || '—'} | Handicap: {selectedHandicap.join(', ') || '—'}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'A criar...' : 'Criar Regata'}
          </button>
        </form>
      </div>
    </RequireAuth>
  );
}
