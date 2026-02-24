'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiGet, apiSend } from '@/lib/api';

interface Props {
  regattaId: number;
  onRaceCreated: (newRace: Race) => void;
  defaultOpen?: boolean; // you can open/close the card by default
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
        setError('Could not fetch classes for this regatta.');
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
      setOk('Race created successfully!');
      // mantém a classe selecionada para criar várias de seguida
      setName('');
    } catch (e: any) {
      setError(typeof e?.message === 'string' ? e.message : 'Error creating race.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-2xl bg-white shadow-sm">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">Create Race</h4>
        <button
          onClick={() => setOpen(v => !v)}
          className="text-xs px-3 py-1 rounded border hover:bg-gray-50"
          aria-expanded={open}
        >
          {open ? 'Close' : 'Open'}
        </button>
      </div>

      {!open ? (
        <p className="mt-2 text-xs text-gray-500">
          Compact form to add new races.
        </p>
      ) : (
        <div className="mt-3 space-y-2 text-sm">
          {loadingClasses && <p className="text-gray-500">Loading classes…</p>}
          {!!error && <p className="text-red-600">{error}</p>}
          {!!ok && <p className="text-green-700">{ok}</p>}
          {(!loadingClasses && classOptions.length === 0) && (
            <p className="text-gray-500">No classes configured for this regatta.</p>
          )}

          <label className="block">
            <span className="text-xs text-gray-700">Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full border rounded px-3 py-2"
              placeholder="Ex: Race 1"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateRace()}
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-xs text-gray-700">Class</span>
              <select
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                className="mt-1 w-full border rounded px-3 py-2"
                disabled={loadingClasses || classOptions.length === 0}
              >
                {classOptions.length === 0 && <option value="">-- No classes --</option>}
                {classOptions.map((cls) => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs text-gray-700">Date</span>
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
            {loading ? 'Creating…' : (
              <>
                <Plus size={16} strokeWidth={2} className="inline mr-1.5 -mt-0.5" />
                Create Race
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
