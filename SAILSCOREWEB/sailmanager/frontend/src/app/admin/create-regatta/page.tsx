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
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [newClass, setNewClass] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
      if (selectedClasses.length > 0) {
        await apiSend<{ updated: number }>(
          `/regattas/${regatta.id}/classes`,
          'PUT',
          { classes: selectedClasses },
          token
        );
      }

      alert('Regata criada com sucesso!');
      router.push(`/admin/edit-regatta/${regatta.id}`);
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
            <p className="font-medium mb-2">Selecionar Classes:</p>
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

            <div className="mt-3 flex gap-2">
              <input
                className="border rounded px-3 py-2 flex-1"
                placeholder="Adicionar classe personalizada"
                value={newClass}
                onChange={(e) => setNewClass(e.target.value)}
              />
              <button type="button" className="border rounded px-3" onClick={addCustomClass}>
                Adicionar
              </button>
            </div>

            {selectedClasses.length > 0 && (
              <p className="text-xs text-gray-600 mt-2">
                Selecionadas: {selectedClasses.join(', ')}
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
