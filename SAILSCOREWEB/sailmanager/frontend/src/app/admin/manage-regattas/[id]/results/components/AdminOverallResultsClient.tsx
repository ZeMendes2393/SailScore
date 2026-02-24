'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Trash2, Layers, Shuffle, List, Globe } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { SailNumberDisplay } from '@/components/ui/SailNumberDisplay';

import { apiGet, apiSend } from '@/lib/api';
import {
  RESULTS_OVERALL_COLUMNS,
  getVisibleResultsOverallColumnsForClass,
  resultsOverallColumnsByClassAfterToggle,
  type ResultsOverallColumnId,
} from '@/lib/resultsOverallColumns';
import RaceCreator from './RaceCreator';

// Discards
import DiscardsDrawer from './settings/DiscardsDrawer';
import TiebreakerDrawer from './settings/TiebreakerDrawer';
import PublishDrawer from './settings/PublishDrawer';

// Fleets
import FleetsDrawer from './fleets/FleetsDrawer';
import FleetManager from './fleets/FleetManager';

type RegattaConfig = {
  id: number;
  name: string;
  discard_count: number;
  discard_threshold: number;
  results_overall_columns?: string[] | Record<string, string[]> | null;
};

type OverallResult = {
  sail_number: string;
  boat_country_code?: string | null;
  boat_name: string;
  class_name: string;
  skipper_name: string;
  total_points: number;
  net_points: number;

  // backend: pode vir number, "DNF(10)" ou "(10)" etc
  per_race: Record<string, number | string>;

  // novos campos do backend
  overall_rank: number;
  finals_fleet?: string | null;

  // NOVO: fleet usada para cada race (ex.: { R1: "Yellow" })
  per_race_fleet?: Record<string, string | null>;

  boat_model?: string | null;
  bow_number?: string | null;
};

type ComputedRow = OverallResult & {
  discardedRaceNames: Set<string>;
};

type RaceLite = {
  id: number;
  name: string;
  class_name: string;
  order_index?: number | null;
};

type Props = { regattaId: number };

// para ir buscar codes por corrida
type RaceResultLite = {
  sail_number: string;
  code?: string | null;
};

// mapa de cores para os dots de fleet
const FLEET_COLOR_CLASSES: Record<string, string> = {
  Yellow: 'bg-yellow-300',
  Blue: 'bg-blue-500',
  Red: 'bg-red-500',
  Green: 'bg-green-500',

  Gold: 'bg-yellow-500',
  Silver: 'bg-gray-400',
  Bronze: 'bg-amber-700',
  Emerald: 'bg-emerald-500',
};

function normalizeSail(sn: string | null | undefined) {
  return (sn ?? '').trim().toUpperCase();
}

function formatPerRaceCell(
  raw: number | string | undefined,
  discarded: boolean,
  code?: string | null
) {
  if (raw === undefined || raw === null) return '-';

  const s = (typeof raw === 'number' ? String(raw) : String(raw))
    .replace(/\u200B/g, '')
    .trim();

  if (!s) return '-';

  // detectar se backend já vem como "(...)" para discard
  const isWrapped = s.startsWith('(') && s.endsWith(')');

  // pointsStr: tenta isolar os pontos
  let pointsStr = s;

  // se vier "(10)" -> pointsStr "10"
  if (isWrapped) pointsStr = s.slice(1, -1).trim();

  // se vier "DNF(10)" ou "(DNF 10)" etc -> tenta extrair pontos
  const m1 = pointsStr.match(/^([A-Za-z]{2,6})\s*\(\s*([-+]?\d+(?:\.\d+)?)\s*\)$/);
  if (m1) pointsStr = m1[2];

  const m2 = pointsStr.match(/^([A-Za-z]{2,6})\s+([-+]?\d+(?:\.\d+)?)$/);
  if (m2) pointsStr = m2[2];

  const c = code ? String(code).toUpperCase() : null;

  // 🔹 NÃO descartado → sem parêntesis
  if (!discarded) {
    if (c) return `${c} ${pointsStr}`;   // ex: DNF 10
    return pointsStr || '-';
  }

  // 🔹 DESCARTADO → com parêntesis
  if (c) return `(${c} ${pointsStr})`;   // ex: (DNF 10)
  if (isWrapped) return s;               // se backend já mandou "(...)", mantém
  return `(${pointsStr || '-'})`;
}

export default function AdminOverallResultsClient({ regattaId }: Props) {
  const router = useRouter();
  const { token } = useAuth();

  const [classes, setClasses] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [racesByClass, setRacesByClass] = useState<Record<string, RaceLite[]>>({});
  const [rawResults, setRawResults] = useState<OverallResult[]>([]);
  const [regatta, setRegatta] = useState<RegattaConfig | null>(null);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingResults, setLoadingResults] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // reorder local
  const [pendingOrder, setPendingOrder] = useState<number[] | null>(null);
  const [saving, setSaving] = useState(false);
  const dirty = !!pendingOrder;

  // settings resolvidas por classe
  const [clsResolved, setClsResolved] = useState<{
    discard_count: number;
    discard_threshold: number;
    scoring_codes: Record<string, number>;
  } | null>(null);

  // drawers
  const [showCreate, setShowCreate] = useState(false);
  const [showFleets, setShowFleets] = useState(false);
  const [showDiscards, setShowDiscards] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [showTiebreaker, setShowTiebreaker] = useState(false);
  const [showFields, setShowFields] = useState(false);
  const [savingColumns, setSavingColumns] = useState(false);

  // NOVO: codes por corrida (raceName -> sail_number -> code)
  const [codesByRace, setCodesByRace] = useState<Record<string, Record<string, string | null>>>({});

  // Colunas visíveis por classe
  const visibleColumns = useMemo(
    () => getVisibleResultsOverallColumnsForClass(regatta?.results_overall_columns, selectedClass),
    [regatta?.results_overall_columns, selectedClass]
  );

  const toggleResultsColumn = useCallback(
    async (columnId: ResultsOverallColumnId) => {
      if (!selectedClass) return;
      const current = getVisibleResultsOverallColumnsForClass(regatta?.results_overall_columns, selectedClass);
      const next = current.includes(columnId)
        ? current.filter((id) => id !== columnId)
        : [...current, columnId].sort(
            (a, b) =>
              RESULTS_OVERALL_COLUMNS.findIndex((c) => c.id === a) -
              RESULTS_OVERALL_COLUMNS.findIndex((c) => c.id === b)
          );
      const payload = resultsOverallColumnsByClassAfterToggle(regatta?.results_overall_columns, selectedClass, next);
      setSavingColumns(true);
      try {
        const data = await apiSend<{ results_overall_columns?: Record<string, string[]> | null }>(
          `/regattas/${regattaId}`,
          'PATCH',
          { results_overall_columns: payload },
          token ?? undefined
        );
        setRegatta((prev) => (prev ? { ...prev, results_overall_columns: data?.results_overall_columns ?? payload } : prev));
      } catch (e: any) {
        alert(e?.message || 'Erro ao guardar colunas.');
      } finally {
        setSavingColumns(false);
      }
    },
    [regatta, regattaId, selectedClass, token]
  );

  // Config regata
  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet<RegattaConfig>(`/regattas/${regattaId}`, token ?? undefined);
        setRegatta({
          id: data.id,
          name: data.name,
          discard_count: data.discard_count ?? 0,
          discard_threshold: data.discard_threshold ?? 0,
          results_overall_columns: data.results_overall_columns ?? null,
        });
      } catch (e) {
        console.error(e);
      }
    })();
  }, [regattaId, token]);

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

  // Settings por classe
  useEffect(() => {
    (async () => {
      if (!selectedClass) {
        setClsResolved(null);
        return;
      }
      try {
        type ClassSettingsRes = { resolved?: { discard_count?: number; discard_threshold?: number; scoring_codes?: Record<string, unknown> }; discard_count?: number; discard_threshold?: number; scoring_codes?: Record<string, unknown> };
        const res = await apiGet<ClassSettingsRes>(
          `/regattas/${regattaId}/class-settings/${encodeURIComponent(selectedClass)}`,
          token ?? undefined
        );
        const payload = (res?.resolved ?? res) || null;
        if (payload) {
          setClsResolved({
            discard_count: Number(payload.discard_count ?? 0),
            discard_threshold: Number(payload.discard_threshold ?? 0),
            scoring_codes: (payload.scoring_codes ?? {}) as Record<string, number>,
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
      (a, b) =>
        (idx.get(nameToId.get(a) ?? 9999) ?? 9999) -
        (idx.get(nameToId.get(b) ?? 9999) ?? 9999)
    );
  }, [pendingOrder, racesByClass, raceNames, selectedClass, nameToId]);

  // Mapa raceName -> href para Link (robusto: fallback por match de nome)
  const raceNameToHref = useMemo(() => {
    const map = new Map<string, string>();
    const list = selectedClass ? racesByClass[selectedClass] || [] : [];
    const norm = (s: string) => (s ?? '').trim().toLowerCase();
    for (const r of list) {
      map.set(r.name, `/admin/manage-regattas/${regattaId}/races/${r.id}`);
    }
    // Fallback: nomes que aparecem em raceNames mas não batem exatamente
    for (const rn of raceNames) {
      if (map.has(rn)) continue;
      const needle = norm(rn);
      const match = list.find((r) => norm(r.name) === needle || norm(r.name).includes(needle) || needle.includes(norm(r.name)));
      if (match) map.set(rn, `/admin/manage-regattas/${regattaId}/races/${match.id}`);
    }
    return map;
  }, [regattaId, selectedClass, racesByClass, raceNames]);

  // Abrir corrida individual (robusto: fallback se nameToId falhar)
  const openRace = (raceName: string) => {
    const href = raceNameToHref.get(raceName);
    if (href) router.push(href);
  };

  // ✅ NOVO: buscar codes das corridas (para mostrar DNF(10) / (DNF 10))
  useEffect(() => {
    (async () => {
      if (!selectedClass) {
        setCodesByRace({});
        return;
      }

      const entries = await Promise.all(
        orderedRaceNames.map(async (raceName) => {
          const raceId = nameToId.get(raceName);
          if (!raceId) return [raceName, {}] as const;

          try {
            const rows: RaceResultLite[] = await apiGet(`/results/races/${raceId}/results`);

            const map: Record<string, string | null> = {};
            (rows || []).forEach((rr) => {
              const key = normalizeSail(rr.sail_number);
              if (!key) return;
              map[key] = rr.code ? String(rr.code).toUpperCase() : null;
            });

            return [raceName, map] as const;
          } catch {
            return [raceName, {}] as const;
          }
        })
      );

      const next: Record<string, Record<string, string | null>> = {};
      for (const [raceName, m] of entries) next[raceName] = m;
      setCodesByRace(next);
    })();
  }, [apiGet, selectedClass, orderedRaceNames, nameToId]);

  // Calcular descartes apenas para fins visuais (backend já tratou dos pontos)
  const results: ComputedRow[] = useMemo(() => {
    return rawResults
      .map((r) => {
        const discarded = new Set<string>();
        const cleanedPerRace: Record<string, number | string> = {};

        Object.entries(r.per_race || {}).forEach(([name, val]) => {
          if (typeof val === 'string') {
            const cleaned = val.replace(/\u200B/g, '').trim();

            // se backend marca discard com "(...)"
            if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
              discarded.add(name);
              cleanedPerRace[name] = cleaned.slice(1, -1).trim(); // guarda sem parêntesis
              return;
            }

            cleanedPerRace[name] = cleaned || '-';
            return;
          }

          cleanedPerRace[name] = val ?? '-';
        });

        return {
          ...r,
          per_race: cleanedPerRace,
          discardedRaceNames: discarded,
        };
      })
      .sort((a, b) => a.overall_rank - b.overall_rank);
  }, [rawResults]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Voltar ao menu da regata */}
      <div className="mb-4">
        <Link
          href={`/admin/manage-regattas/${regattaId}`}
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
        >
          ← Back to regatta menu
        </Link>
      </div>

      {/* Header + Action Bar */}
      <div className="flex flex-col gap-3 mb-4">
        <h2 className="text-2xl font-bold">Overall Classification (Admin)</h2>

        {/* Action bar per class */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded border border-gray-200 hover:bg-gray-50 text-gray-700"
            disabled={!selectedClass}
            title={!selectedClass ? 'Choose a class first' : 'Create new race'}
          >
            <Plus size={16} strokeWidth={2} />
            Create Race
          </button>

          <button
            type="button"
            onClick={() => setShowDiscards(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded border border-gray-200 hover:bg-gray-50 text-gray-700"
            disabled={!selectedClass}
            title={!selectedClass ? 'Choose a class first' : 'Configure discards'}
          >
            <Trash2 size={16} strokeWidth={2} />
            Discards
          </button>

          <button
            type="button"
            onClick={() => setShowFleets(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded border border-gray-200 hover:bg-gray-50 text-gray-700"
            disabled={!selectedClass}
            title={!selectedClass ? 'Choose a class first' : 'Manage Fleets (Qualifying/Finals)'}
          >
            <Layers size={16} strokeWidth={2} />
            Fleets
          </button>

          <button
            type="button"
            onClick={() => setShowPublish(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded border border-gray-200 hover:bg-gray-50 text-gray-700"
            disabled={!selectedClass}
            title={!selectedClass ? 'Choose a class first' : 'Publish results to public (up to race K)'}
          >
            <Globe size={16} strokeWidth={2} />
            Publish (Public)
          </button>

          <button
            type="button"
            onClick={() => setShowTiebreaker(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded border border-gray-200 hover:bg-gray-50 text-gray-700"
            title="Tie-breaking rules (Appendix 8, Medal Race)"
          >
            <Shuffle size={16} strokeWidth={2} />
            Tiebreaker
          </button>

          <button
            type="button"
            onClick={() => setShowFields((v) => !v)}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded border text-gray-700 ${
              showFields ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
            }`}
            title="Visible columns in Overall table"
          >
            <List size={16} strokeWidth={2} />
            Fields
          </button>
        </div>

        {/* Fields: colunas visíveis */}
        {showFields && (
          <div className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 rounded border">
            <span className="text-sm font-medium text-gray-700">
              Visible columns{selectedClass ? ` (class ${selectedClass})` : ''}:
            </span>
            {RESULTS_OVERALL_COLUMNS.map((col) => (
              <label key={col.id} className="inline-flex items-center gap-1.5 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={visibleColumns.includes(col.id)}
                  onChange={() => toggleResultsColumn(col.id)}
                  disabled={savingColumns}
                  className="rounded border-gray-300"
                />
                {col.label}
              </label>
            ))}
            {savingColumns && <span className="text-xs text-gray-500">Saving…</span>}
          </div>
        )}

        {/* Race creator */}
        {showCreate && (
          <div className="border rounded-2xl bg-white shadow-sm">
            <RaceCreator
              regattaId={regattaId}
              defaultOpen
              onRaceCreated={(race) => {
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

      {!!error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      {/* Class tabs */}
      {loadingClasses ? (
        <p className="text-gray-500">Loading classes…</p>
      ) : classes.length === 0 ? (
        <p className="text-gray-500">No classes configured for this regatta.</p>
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

      {/* Table */}
      {selectedClass && !loadingResults && (
        <table className="table-auto w-full border border-collapse">
          <thead className="bg-gray-100">
            <tr>
              {visibleColumns.filter((id) => id !== 'total' && id !== 'net').map((id) => (
                <th key={id} className="border px-3 py-2">
                  {RESULTS_OVERALL_COLUMNS.find((c) => c.id === id)?.label ?? id}
                </th>
              ))}
              {orderedRaceNames.map((n) => {
                const href = raceNameToHref.get(n);
                return (
                <th key={n} className="border px-3 py-2">
                  <div className="flex items-center justify-center gap-2">
                    {href ? (
                      <Link
                        href={href}
                        className="underline underline-offset-2 hover:text-blue-700 font-semibold"
                      >
                        {n}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openRace(n)}
                        className="underline underline-offset-2 hover:text-blue-700 font-semibold"
                      >
                        {n}
                      </button>
                    )}
                    <div className="inline-flex gap-1">
                      <button
                        type="button"
                        onClick={() => moveColumn(n, 'left')}
                        className="px-1.5 py-0.5 border rounded hover:bg-gray-50"
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        onClick={() => moveColumn(n, 'right')}
                        className="px-1.5 py-0.5 border rounded hover:bg-gray-50"
                      >
                        →
                      </button>
                    </div>
                  </div>
                </th>
              );
              })}
              {visibleColumns.includes('total') && (
                <th className="border px-3 py-2">Total</th>
              )}
              {visibleColumns.includes('net') && (
                <th className="border px-3 py-2">Net</th>
              )}
            </tr>
          </thead>

          <tbody>
            {results.map((r) => (
              <tr key={`${r.class_name}-${r.sail_number}-${r.skipper_name}`}>
                {visibleColumns.filter((id) => id !== 'total' && id !== 'net').map((id) => {
                  if (id === 'place') return <td key={id} className="border px-3 py-2 text-center">{r.overall_rank}º</td>;
                  if (id === 'fleet') return <td key={id} className="border px-3 py-2 text-center">{r.finals_fleet ?? '-'}</td>;
                  if (id === 'sail_no') return <td key={id} className="border px-3 py-2"><SailNumberDisplay countryCode={r.boat_country_code} sailNumber={r.sail_number} /></td>;
                  if (id === 'boat') return <td key={id} className="border px-3 py-2">{r.boat_name}</td>;
                  if (id === 'skipper') return <td key={id} className="border px-3 py-2">{r.skipper_name}</td>;
                  if (id === 'class') return <td key={id} className="border px-3 py-2">{r.class_name}</td>;
                  if (id === 'model') return <td key={id} className="border px-3 py-2">{r.boat_model ?? '—'}</td>;
                  if (id === 'bow') return <td key={id} className="border px-3 py-2">{r.bow_number ?? '—'}</td>;
                  return <td key={id} className="border px-3 py-2">—</td>;
                })}
                {orderedRaceNames.map((n) => {
                  const raw = r.per_race?.[n];
                  const discarded = r.discardedRaceNames.has(n);

                  const fleetLabel = r.per_race_fleet?.[n] ?? null;
                  const fleetColorClass = fleetLabel
                    ? FLEET_COLOR_CLASSES[fleetLabel] ?? 'bg-gray-400'
                    : '';

                  const sailKey = normalizeSail(r.sail_number);
                  const code = codesByRace[n]?.[sailKey] ?? null;

                  const display = formatPerRaceCell(raw as any, discarded, code);

                  return (
                    <td key={n} className="border px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {fleetLabel && (
                          <span
                            className={`inline-block w-2 h-2 rounded-full ${fleetColorClass}`}
                            title={fleetLabel}
                          />
                        )}
                        <span>{display}</span>
                      </div>
                    </td>
                  );
                })}
                {visibleColumns.includes('total') && (
                  <td className="border px-3 py-2 text-right font-semibold">
                    {Number(r.total_points).toFixed(2)}
                  </td>
                )}
                {visibleColumns.includes('net') && (
                  <td className="border px-3 py-2 text-right font-bold">
                    {Number(r.net_points).toFixed(2)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Fixed Save/Cancel bar (reorder) */}
      {dirty && (
        <div className="fixed bottom-4 left-4 right-4 z-30">
          <div className="w-full px-6">
            <div className="flex items-center gap-3 border rounded-2xl bg-white shadow-lg p-3">
              <span className="text-sm text-gray-700">
                You have changes to race order to save.
              </span>
              <div className="ml-auto flex gap-2">
                <button
                  disabled={saving}
                  onClick={async () => {
                    if (!pendingOrder) return;
                    if (!confirm('Do you want to save the new race order?')) return;
                    try {
                      setSaving(true);
                      await apiSend(`/races/regattas/${regattaId}/reorder`, 'PUT', {
                        ordered_ids: pendingOrder,
                      }, token ?? undefined);

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
                  {saving ? 'Saving…' : 'Save order'}
                </button>
                <button
                  disabled={saving}
                  onClick={() => setPendingOrder(null)}
                  className="px-3 py-2 border rounded-xl hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Discards Drawer */}
      {showDiscards && selectedClass && (
        <DiscardsDrawer
          regattaId={regattaId}
          class_name={selectedClass}
          onClose={() => setShowDiscards(false)}
        />
      )}

      {/* Publish (Public) Drawer */}
      {showPublish && selectedClass && (
        <PublishDrawer
          regattaId={regattaId}
          class_name={selectedClass}
          onClose={() => setShowPublish(false)}
          races={(racesByClass[selectedClass] ?? []).map((r) => ({ id: r.id, name: r.name, class_name: r.class_name, order_index: r.order_index ?? undefined }))}
        />
      )}

      {/* Fleets Drawer */}
      {showFleets && (
        <FleetsDrawer open={showFleets} onClose={() => setShowFleets(false)} title="Fleet Manager">
          {selectedClass ? (
            <FleetManager overall={results} regattaId={regattaId} />
          ) : (
            <div className="p-4 text-sm text-gray-600">Choose a class to manage fleets.</div>
          )}
        </FleetsDrawer>
      )}

      {/* Tiebreaker Drawer */}
      {showTiebreaker && (
        <TiebreakerDrawer onClose={() => setShowTiebreaker(false)} />
      )}
    </div>
  );
}
