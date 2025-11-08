'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

// 👇 imports existentes
import RaceCreator from './RaceCreator';
import SettingsDrawer from './settings/SettingsDrawer';

// 👇 NOVOS imports para Fleets
import FleetsDrawer from './fleets/FleetsDrawer';
import FleetManager from './fleets/FleetManager';

type RegattaConfig = {
  id: number;
  name: string;
  discard_count: number;
  discard_threshold: number;
};

type OverallResult = {
  sail_number: string;
  boat_name: string;
  class_name: string;
  skipper_name: string;
  total_points: number;
  per_race: Record<string, number | string>;
};

type ComputedRow = OverallResult & {
  net_points: number;
  discardedRaceNames: Set<string>;
};

type RaceLite = { id: number; name: string; class_name: string; order_index?: number | null };

export default function AdminOverallResultsClient() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const regattaId = Number(params.id);
  const { token } = useAuth();

  const [classes, setClasses] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [racesByClass, setRacesByClass] = useState<Record<string, RaceLite[]>>({});
  const [rawResults, setRawResults] = useState<OverallResult[]>([]);
  const [regatta, setRegatta] = useState<RegattaConfig | null>(null);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingResults, setLoadingResults] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reorder local
  const [pendingOrder, setPendingOrder] = useState<number[] | null>(null);
  const [saving, setSaving] = useState(false);
  const dirty = !!pendingOrder;

  // Settings resolvidas por classe
  const [clsResolved, setClsResolved] = useState<{
    discard_count: number;
    discard_threshold: number;
    scoring_codes: Record<string, number>;
  } | null>(null);

  // Action Bar: controlos de UI
  const [showSettings, setShowSettings] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // 👉 NOVO: Drawer de Fleets
  const [showFleets, setShowFleets] = useState(false);

  // API helpers
  const apiGet = useCallback(
    async (path: string) => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000'}${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`GET ${path} falhou (${res.status})`);
      return res.json();
    },
    [token]
  );

  const apiSend = useCallback(
    async (path: string, method: string, body?: any) => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000'}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) throw new Error(`Erro ${res.status} ao enviar para ${path}`);
      return res.json().catch(() => ({}));
    },
    [token]
  );

  // Config regata
  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet(`/regattas/${regattaId}`);
        setRegatta({
          id: data.id,
          name: data.name,
          discard_count: data.discard_count ?? 0,
          discard_threshold: data.discard_threshold ?? 0,
        });
      } catch (e) {
        console.error(e);
      }
    })();
  }, [apiGet, regattaId]);

  // Classes
  useEffect(() => {
    (async () => {
      setLoadingClasses(true);
      try {
        const data: string[] = await apiGet(`/regattas/${regattaId}/classes`);
        setClasses(data || []);
        if (data?.length) setSelectedClass((prev) => prev ?? data[0]);
      } catch {
        setError('Erro ao carregar classes');
      } finally {
        setLoadingClasses(false);
      }
    })();
  }, [apiGet, regattaId]);

  // Corridas por classe
  useEffect(() => {
    (async () => {
      try {
        const all: RaceLite[] = await apiGet(`/races/by_regatta/${regattaId}`);
        const grouped: Record<string, RaceLite[]> = {};
        (all || []).forEach((r) => {
          if (!grouped[r.class_name]) grouped[r.class_name] = [];
          grouped[r.class_name].push(r);
        });
        for (const k of Object.keys(grouped)) {
          grouped[k].sort((a, b) => (a.order_index ?? a.id) - (b.order_index ?? b.id));
        }
        setRacesByClass(grouped);
      } catch (e) {
        console.error('Falha ao carregar corridas', e);
      }
    })();
  }, [apiGet, regattaId]);

  // Resultados overall
  useEffect(() => {
    (async () => {
      if (!selectedClass) return;
      setLoadingResults(true);
      try {
        const data: OverallResult[] = await apiGet(
          `/results/overall/${regattaId}?class_name=${encodeURIComponent(selectedClass)}`
        );
        setRawResults(data || []);
      } catch {
        setError('Erro ao carregar resultados');
      } finally {
        setLoadingResults(false);
      }
    })();
  }, [apiGet, regattaId, selectedClass]);

  // Settings por classe (aceita {resolved:{...}} ou direto)
  useEffect(() => {
    (async () => {
      if (!selectedClass) { setClsResolved(null); return; }
      try {
        const res = await apiGet(`/regattas/${regattaId}/class-settings/${encodeURIComponent(selectedClass)}`);
        const payload = (res?.resolved ?? res) || null;
        if (payload) {
          setClsResolved({
            discard_count: Number(payload.discard_count ?? 0),
            discard_threshold: Number(payload.discard_threshold ?? 0),
            scoring_codes: payload.scoring_codes ?? {},
          });
        } else {
          setClsResolved(null);
        }
      } catch {
        setClsResolved(null);
      }
    })();
  }, [apiGet, regattaId, selectedClass]);

  // Colunas (nomes das corridas)
  const raceNames = useMemo(() => {
    const s = new Set<string>();
    rawResults.forEach((r) => Object.keys(r.per_race || {}).forEach((k) => s.add(k)));
    return Array.from(s);
  }, [rawResults]);

  const nameToId = useMemo(() => {
    const map = new Map<string, number>();
    const list = selectedClass ? racesByClass[selectedClass] || [] : [];
    list.forEach((r) => map.set(r.name, r.id));
    return map;
  }, [racesByClass, selectedClass]);

  // Reordenação local
  const moveColumn = (raceName: string, dir: 'left' | 'right') => {
    if (!selectedClass) return;
    const list = racesByClass[selectedClass] || [];
    const ids = (pendingOrder ?? list.map((r) => r.id)).slice();
    const id = nameToId.get(raceName);
    if (!id) return;

    const i = ids.indexOf(id);
    const j = dir === 'left' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= ids.length) return;

    [ids[i], ids[j]] = [ids[j], ids[i]];
    setPendingOrder(ids);
  };

  const orderedRaceNames = useMemo(() => {
    if (!selectedClass) return raceNames;
    const list = racesByClass[selectedClass] || [];
    const order = pendingOrder ?? list.map((r) => r.id);
    const idx = new Map(order.map((id, i) => [id, i]));
    return [...raceNames].sort(
      (a, b) => (idx.get(nameToId.get(a) ?? 9999) ?? 9999) - (idx.get(nameToId.get(b) ?? 9999) ?? 9999)
    );
  }, [pendingOrder, racesByClass, raceNames, selectedClass, nameToId]);

  // Abrir corrida individual
  const openRace = (raceName: string) => {
    const id = nameToId.get(raceName);
    if (id) router.push(`/admin/manage-regattas/${regattaId}/races/${id}`);
  };

  // Calcular NET + descartes (classe > global)
  const results: ComputedRow[] = useMemo(() => {
    const discards = (clsResolved?.discard_count ?? regatta?.discard_count ?? 0);
    const threshold = (clsResolved?.discard_threshold ?? regatta?.discard_threshold ?? 0);

    const extractPoints = (v: any) => {
      if (typeof v === 'number') return v;
      if (typeof v === 'string') {
        const m = v.match(/-?\d+(\.\d+)?/);
        return m ? Number(m[0]) : NaN;
      }
      return NaN;
    };

    return rawResults
      .map((r) => {
        const pairs = Object.entries(r.per_race || {})
          .map(([n, v]) => ({ name: n, points: extractPoints(v) }))
          .filter((x) => Number.isFinite(x.points));
        const total = pairs.reduce((a, c) => a + c.points, 0);
        let net = total;
        let disc = new Set<string>();
        if (pairs.length >= threshold && discards > 0) {
          const worst = pairs.slice().sort((a, b) => b.points - a.points).slice(0, discards);
          disc = new Set(worst.map((x) => x.name));
          net = total - worst.reduce((a, c) => a + c.points, 0);
        }
        return { ...r, total_points: total, net_points: net, discardedRaceNames: disc };
      })
      .sort((a, b) => a.net_points - b.net_points);
  }, [rawResults, regatta, clsResolved]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header + Action Bar */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Classificação Geral (Admin)</h2>
          {regatta && (
            <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
              Descartes: <strong>{clsResolved?.discard_count ?? regatta.discard_count}</strong>
              {(clsResolved?.discard_count ?? regatta.discard_count) > 0 && (
                <> (após <strong>{clsResolved?.discard_threshold ?? regatta.discard_threshold}</strong> regatas)</>
              )}
            </span>
          )}
        </div>

        {/* Action bar por classe */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowCreate(v => !v)}
            className="px-3 py-2 rounded border hover:bg-gray-50"
            disabled={!selectedClass}
            title={!selectedClass ? 'Escolhe uma classe primeiro' : 'Criar nova corrida'}
          >
            ➕ Criar Corrida
          </button>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="px-3 py-2 rounded border hover:bg-gray-50"
            disabled={!selectedClass}
            title={!selectedClass ? 'Escolhe uma classe primeiro' : 'Definições por classe'}
          >
            ⚙️ Settings (classe)
          </button>
          {/* 🧩 NOVO: botão Fleets */}
          <button
            type="button"
            onClick={() => setShowFleets(true)}
            className="px-3 py-2 rounded border hover:bg-gray-50"
            disabled={!selectedClass}
            title={!selectedClass ? 'Escolhe uma classe primeiro' : 'Gerir Fleets (Qualifying/Finals)'}
          >
            🧩 Fleets
          </button>
        </div>

        {/* Card criador de corridas (mostra/oculta) */}
        {showCreate && (
          <div className="border rounded-2xl bg-white shadow-sm">
            <RaceCreator
              regattaId={regattaId}
              defaultOpen
              onRaceCreated={(race) => {
                // refetch corridas e resultados
                (async () => {
                  try {
                    const all: RaceLite[] = await apiGet(`/races/by_regatta/${regattaId}`);
                    const grouped: Record<string, RaceLite[]> = {};
                    (all || []).forEach((r) => {
                      if (!grouped[r.class_name]) grouped[r.class_name] = [];
                      grouped[r.class_name].push(r);
                    });
                    for (const k of Object.keys(grouped)) {
                      grouped[k].sort((a, b) => (a.order_index ?? a.id) - (b.order_index ?? b.id));
                    }
                    setRacesByClass(grouped);
                    // se a classe da corrida criada for a ativa, atualiza tabela (refetch overall)
                    if (race.class_name === selectedClass) {
                      const data: OverallResult[] = await apiGet(
                        `/results/overall/${regattaId}?class_name=${encodeURIComponent(race.class_name)}`
                      );
                      setRawResults(data || []);
                    }
                  } catch (e) {
                    console.error('refresh após criar corrida falhou', e);
                  }
                })();
              }}
            />
          </div>
        )}
      </div>

      {/* Abas de classes */}
      {loadingClasses ? (
        <p className="text-gray-500">A carregar classes…</p>
      ) : classes.length === 0 ? (
        <p className="text-gray-500">Sem classes configuradas para esta regata.</p>
      ) : (
        <div className="flex gap-2 mb-4 flex-wrap">
          {classes.map((cls) => (
            <button
              key={cls}
              onClick={() => {
                setSelectedClass(cls);
                setPendingOrder(null);
              }}
              className={`px-3 py-1 rounded font-semibold border transition ${
                selectedClass === cls
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-blue-600 border-blue-600 hover:bg-blue-50'
              }`}
            >
              {cls}
            </button>
          ))}
        </div>
      )}

      {/* Tabela */}
      {selectedClass && !loadingResults && (
        <table className="table-auto w-full border border-collapse">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-3 py-2">#</th>
              <th className="border px-3 py-2">Nº Vela</th>
              <th className="border px-3 py-2">Embarcação</th>
              <th className="border px-3 py-2">Timoneiro</th>
              {orderedRaceNames.map((n) => (
                <th key={n} className="border px-3 py-2">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => openRace(n)}
                      className="underline underline-offset-2 hover:text-blue-700 font-semibold"
                    >
                      {n}
                    </button>
                    <div className="inline-flex gap-1">
                      <button
                        onClick={() => moveColumn(n, 'left')}
                        className="px-1.5 py-0.5 border rounded hover:bg-gray-50"
                      >
                        ←
                      </button>
                      <button
                        onClick={() => moveColumn(n, 'right')}
                        className="px-1.5 py-0.5 border rounded hover:bg-gray-50"
                      >
                        →
                      </button>
                    </div>
                  </div>
                </th>
              ))}
              <th className="border px-3 py-2">Total</th>
              <th className="border px-3 py-2">Net</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={i}>
                <td className="border px-3 py-2">{i + 1}º</td>
                <td className="border px-3 py-2">{r.sail_number}</td>
                <td className="border px-3 py-2">{r.boat_name}</td>
                <td className="border px-3 py-2">{r.skipper_name}</td>
                {orderedRaceNames.map((n) => {
                  const raw = r.per_race[n];
                  const discarded = r.discardedRaceNames.has(n);
                  return (
                    <td
                      key={n}
                      className={`border px-3 py-2 text-center ${discarded ? 'text-gray-400' : ''}`}
                    >
                      {discarded ? `(${raw})` : (raw ?? '-')}
                    </td>
                  );
                })}
                <td className="border px-3 py-2 text-right font-semibold">
                  {r.total_points.toFixed(2)}
                </td>
                <td className="border px-3 py-2 text-right font-bold">
                  {r.net_points.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Barra fixa Guardar/Cancelar (reorder) */}
      {dirty && (
        <div className="fixed bottom-4 left-4 right-4 z-30">
          <div className="w-full px-6">
            <div className="flex items-center gap-3 border rounded-2xl bg-white shadow-lg p-3">
              <span className="text-sm text-gray-700">
                Tens alterações à ordem das regatas por guardar.
              </span>
              <div className="ml-auto flex gap-2">
                <button
                  disabled={saving}
                  onClick={async () => {
                    if (!pendingOrder) return;
                    if (!confirm('Confirmas guardar a nova ordem das corridas?')) return;
                    try {
                      setSaving(true);
                      await apiSend(`/races/regattas/${regattaId}/reorder`, 'PUT', {
                        ordered_ids: pendingOrder,
                      });
                      const refreshed: RaceLite[] = await apiGet(`/races/by_regatta/${regattaId}`);
                      const grouped: Record<string, RaceLite[]> = {};
                      refreshed.forEach((r) => {
                        if (!grouped[r.class_name]) grouped[r.class_name] = [];
                        grouped[r.class_name].push(r);
                      });
                      for (const k of Object.keys(grouped)) {
                        grouped[k].sort((a, b) => (a.order_index ?? a.id) - (b.order_index ?? b.id));
                      }
                      setRacesByClass(grouped);
                      setPendingOrder(null);
                      router.refresh();
                    } catch (e: any) {
                      alert(e?.message || 'Erro ao guardar a nova ordem.');
                    } finally {
                      setSaving(false);
                    }
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'A guardar…' : 'Guardar ordem'}
                </button>
                <button
                  disabled={saving}
                  onClick={() => setPendingOrder(null)}
                  className="px-3 py-2 border rounded-xl hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drawer Settings por classe */}
      {showSettings && (
        <SettingsDrawer
          regattaId={regattaId}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* 🧩 Drawer de Fleets */}
      {showFleets && (
        <FleetsDrawer
          open={showFleets}
          onClose={() => setShowFleets(false)}
          title="Fleet Manager"
        >
          {/* Passa contexto mínimo necessário */}
          {selectedClass ? (
            <FleetManager />

          ) : (
            <div className="p-4 text-sm text-gray-600">Escolhe uma classe para gerir fleets.</div>
          )}
        </FleetsDrawer>
      )}
    </div>
  );
}
