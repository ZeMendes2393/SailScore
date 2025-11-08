'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '');

type Props = {
  onClose: () => void;
  regattaId?: number; // se quiseres usar noutros contextos
};

type ClassSettingsResponse = {
  overrides: {
    regatta_id: number;
    class_name: string;
    discard_count: number | null;
    discard_threshold: number | null;
    scoring_codes: Record<string, number> | null;
  };
  resolved: {
    discard_count: number;
    discard_threshold: number;
    scoring_codes: Record<string, number>;
  };
};

export default function SettingsDrawer({ onClose, regattaId }: Props) {
  const { token } = useAuth() as any;
  const [classes, setClasses] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [overrides, setOverrides] = useState<ClassSettingsResponse['overrides'] | null>(null);
  const [resolved, setResolved] = useState<ClassSettingsResponse['resolved'] | null>(null);

  const canSave = !!selectedClass;

  useEffect(() => {
    if (!regattaId) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/regattas/${regattaId}/classes`, {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const data: string[] = await res.json();
        setClasses(data || []);
        if (data?.length) setSelectedClass((prev) => prev ?? data[0]);
      } catch (e) {
        // noop
      }
    })();
  }, [regattaId, token]);

  useEffect(() => {
    if (!regattaId || !selectedClass) return;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/regattas/${regattaId}/class-settings/${encodeURIComponent(selectedClass)}`, {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const data: ClassSettingsResponse = await res.json();
        setOverrides(data.overrides);
        setResolved(data.resolved);
      } catch (e) {
        // noop
      } finally {
        setLoading(false);
      }
    })();
  }, [regattaId, selectedClass, token]);

  const [dcInput, setDcInput] = useState<string>('');
  const [dtInput, setDtInput] = useState<string>('');
  const [codes, setCodes] = useState<Array<{ code: string; points: string }>>([]);

  // sincroniza inputs quando muda overrides/resolved
  useEffect(() => {
    if (!overrides || !resolved) return;
    setDcInput(overrides.discard_count === null || overrides.discard_count === undefined ? '' : String(overrides.discard_count));
    setDtInput(overrides.discard_threshold === null || overrides.discard_threshold === undefined ? '' : String(overrides.discard_threshold));
    const toTable = (overrides.scoring_codes ?? resolved.scoring_codes ?? {});
    setCodes(Object.entries(toTable).map(([k,v]) => ({ code: k, points: String(v) })));
  }, [overrides, resolved]);

  const onAddCode = () => setCodes(prev => [...prev, { code: '', points: '' }]);
  const onChangeCode = (i: number, field: 'code'|'points', value: string) => {
    setCodes(prev => prev.map((row, idx) => idx === i ? { ...row, [field]: value } : row));
  };
  const onRemoveCode = (i: number) => setCodes(prev => prev.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!regattaId || !selectedClass) return;
    setSaving(true);
    try {
      // construir corpo. Campo vazio => “remover override” (null)
      const discard_count = dcInput === '' ? None : Number(dcInput);
      const discard_threshold = dtInput === '' ? None : Number(dtInput);

      // normalizar codes (apenas válidos e uppercase)
      const codesObj: Record<string, number> | null =
        codes
          .map(r => ({ code: (r.code || '').trim().toUpperCase(), points: Number(r.points) }))
          .filter(r => r.code && Number.isFinite(r.points))
          .reduce((acc, cur) => ({ ...acc, [cur.code]: cur.points }), {} as Record<string, number>);
      const scoring_codes = Object.keys(codesObj).length ? codesObj : null;

      const res = await fetch(`${API_BASE}/regattas/${regattaId}/class-settings/${encodeURIComponent(selectedClass)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          discard_count,
          discard_threshold,
          scoring_codes,
        }),
      });
      if (!res.ok) throw new Error(await res.text().catch(()=>''));
      await res.json();
      // refetch valores resolvidos
      const ref = await fetch(`${API_BASE}/regattas/${regattaId}/class-settings/${encodeURIComponent(selectedClass)}`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data: ClassSettingsResponse = await ref.json();
      setOverrides(data.overrides);
      setResolved(data.resolved);
      alert('Definições guardadas.');
    } catch (e: any) {
      alert(e?.message || 'Falha ao guardar definições.');
    } finally {
      setSaving(false);
    }
  };

  const resetToInherit = () => {
    // limpar inputs para herdar
    setDcInput('');
    setDtInput('');
    // limpar códigos (deixa vazio para herdar global)
    setCodes([]);
  };

  return (
    <div className="fixed inset-0 z-40">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      {/* drawer */}
      <div className="absolute right-0 top-0 h-full w-full max-w-[520px] bg-white shadow-xl p-5 overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Settings por Classe</h3>
          <button onClick={onClose} className="px-3 py-1 rounded border hover:bg-gray-50">Fechar</button>
        </div>

        {!regattaId ? (
          <p className="text-sm text-gray-600">Regata inválida.</p>
        ) : (
          <>
            {/* Seletor de classe */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Classe</label>
              <div className="flex gap-2">
                <select
                  value={selectedClass ?? ''}
                  onChange={(e) => setSelectedClass(e.target.value || null)}
                  className="border rounded px-3 py-2 w-full"
                >
                  {(classes ?? []).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {loading ? (
              <p className="text-sm text-gray-600">A carregar…</p>
            ) : (
              <>
                {/* DescARTES */}
                <div className="space-y-2 mb-6">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="block text-sm font-medium">Discard count (override)</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={dcInput}
                        onChange={e => setDcInput(e.target.value)}
                        placeholder="(herdar)"
                        className="border rounded px-3 py-2 w-full"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium">Discard threshold (override)</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={dtInput}
                        onChange={e => setDtInput(e.target.value)}
                        placeholder="(herdar)"
                        className="border rounded px-3 py-2 w-full"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    Em uso: <b>{resolved?.discard_count ?? 0}</b> após <b>{resolved?.discard_threshold ?? 0}</b> regatas.
                  </p>
                </div>

                {/* Scoring Codes */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">Scoring codes (override)</h4>
                    <button onClick={onAddCode} className="px-2 py-1 rounded border text-sm hover:bg-gray-50">+ Código</button>
                  </div>
                  <div className="space-y-2">
                    {codes.map((row, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          value={row.code}
                          onChange={e => onChangeCode(i, 'code', e.target.value)}
                          placeholder="DNS / DNF / UFD ..."
                          className="border rounded px-2 py-1 w-36 uppercase"
                        />
                        <input
                          value={row.points}
                          onChange={e => onChangeCode(i, 'points', e.target.value)}
                          placeholder="pontos"
                          className="border rounded px-2 py-1 w-28"
                          inputMode="decimal"
                        />
                        <button onClick={() => onRemoveCode(i)} className="px-2 py-1 rounded border hover:bg-red-50 text-red-600">Remover</button>
                      </div>
                    ))}
                    {!codes.length && (
                      <p className="text-xs text-gray-500">Vazio = herdar global</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={save}
                    disabled={!canSave || saving}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded"
                  >
                    {saving ? 'A guardar…' : 'Guardar'}
                  </button>
                  <button onClick={resetToInherit} className="px-3 py-2 rounded border hover:bg-gray-50">
                    Repor para “herdar”
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// helper para “null” sem TS chatear
const None: any = null;
