'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiGet, apiSend } from '@/lib/api';

interface Props {
  regattaId: number;
  onRaceCreated: (newRace: Race) => void;
  defaultOpen?: boolean; // podes abrir/fechar o card por defeito
}

interface Race {
  id: number;
  name: string;
  regatta_id: number;
  class_name: string;
}

export default function RaceCreator({ regattaId, onRaceCreated, defaultOpen = false }: Props) {
  const { token } = useAuth();

  const [open, setOpen] = useState(defaultOpen);
  const [name, setName] = useState('');
  const [className, setClassName] = useState('');
  const [classOptions, setClassOptions] = useState<string[]>([]);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [loading, setLoading] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => !!name.trim() && !!className && !!date && !loading && !loadingClasses,
    [name, className, date, loading, loadingClasses]
  );

  // Carregar classes da regata (com token)
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingClasses(true);
      setError(null);
      setOk(null);
      try {
        const data = await apiGet<string[]>(`/regattas/${regattaId}/classes`, token ?? undefined);
        if (!mounted) return;
        const arr = Array.isArray(data) ? data : [];
        setClassOptions(arr);
        if (!className && arr.length > 0) setClassName(arr[0]);
      } catch (e) {
        if (!mounted) return;
        setClassOptions([]);
        setError('Não foi possível obter as classes desta regata.');
      } finally {
        if (mounted) setLoadingClasses(false);
      }
    })();
    return () => { mounted = false; };
  }, [regattaId, token]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreateRace = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setOk(null);
    try {
      const payload = {
        regatta_id: regattaId,
        name: name.trim(),
        class_name: className,
        date, // backend espera YYYY-MM-DD
      };
      const newRace = await apiSend<Race>('/races', 'POST', payload, token ?? undefined);
      onRaceCreated(newRace);
      setOk('Corrida criada com sucesso!');
      // mantém a classe selecionada para criar várias de seguida
      setName('');
    } catch (e: any) {
      setError(typeof e?.message === 'string' ? e.message : 'Erro ao criar corrida.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-2xl bg-white shadow-sm">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">Criar Corrida</h4>
        <button
          onClick={() => setOpen(v => !v)}
          className="text-xs px-3 py-1 rounded border hover:bg-gray-50"
          aria-expanded={open}
        >
          {open ? 'Fechar' : 'Abrir'}
        </button>
      </div>

      {!open ? (
        <p className="mt-2 text-xs text-gray-500">
          Formulário compacto para adicionar novas corridas.
        </p>
      ) : (
        <div className="mt-3 space-y-2 text-sm">
          {loadingClasses && <p className="text-gray-500">A carregar classes…</p>}
          {!!error && <p className="text-red-600">{error}</p>}
          {!!ok && <p className="text-green-700">{ok}</p>}
          {(!loadingClasses && classOptions.length === 0) && (
            <p className="text-gray-500">Sem classes configuradas para esta regata.</p>
          )}

          <label className="block">
            <span className="text-xs text-gray-700">Nome</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full border rounded px-3 py-2"
              placeholder="Ex: Corrida 1"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateRace()}
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-xs text-gray-700">Classe</span>
              <select
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                className="mt-1 w-full border rounded px-3 py-2"
                disabled={loadingClasses || classOptions.length === 0}
              >
                {classOptions.length === 0 && <option value="">-- Sem classes --</option>}
                {classOptions.map((cls) => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs text-gray-700">Data</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full border rounded px-3 py-2"
              />
            </label>
          </div>

          <button
            onClick={handleCreateRace}
            disabled={!canSubmit}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'A criar…' : '➕ Criar Corrida'}
          </button>
        </div>
      )}
    </div>
  );
}
