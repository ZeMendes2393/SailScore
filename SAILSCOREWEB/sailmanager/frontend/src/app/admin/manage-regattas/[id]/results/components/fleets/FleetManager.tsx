'use client';
  // CREATE FORMS STATE

import { useMemo, useState, useEffect } from 'react';
import {
  useFleets,
  type FleetSet,
  type Assignment,
  type RaceLite,
} from '../../hooks/useFleets';

const COLORS_QUALI = ['Yellow', 'Blue', 'Red', 'Green'] as const;
const COLORS_FINALS = ['Gold', 'Silver', 'Bronze', 'Emerald'] as const;

type OverallRow = {
  sail_number: string;
  boat_name: string;
  class_name: string;
  skipper_name: string;
  total_points: number;
  net_points: number;
  discardedRaceNames: Set<string>;
  per_race: Record<string, number | string>;
  overall_rank: number;
  finals_fleet?: string | null;
};

type FleetManagerProps = {
  overall: OverallRow[];
};

function parseSailNumber(s: string | null | undefined): number {
  if (!s) return Number.POSITIVE_INFINITY;
  const m = String(s).match(/\d+/);
  return m ? Number(m[0]) : Number.POSITIVE_INFINITY;
}

export default function FleetManager({ overall }: FleetManagerProps) {
  const {
    classes,
    selectedClass,
    setSelectedClass,
    sets,
    assignments,
    selectedSetId,
    setSelectedSetId,
    racesAvailable,
    racesInSelectedSet,
    loading,
    error,
    createQualifying,
    reshuffle,
    startFinals,
    updateFleetSetRaces,
    publishSet,
    unpublishSet,
    updateSetTitle,
  } = useFleets();

  const errorMessage = useMemo(() => {
    if (!error) return '';
    if (error instanceof Error) return error.message;
    return String(error);
  }, [error]);

  const selectedSet: FleetSet | null = useMemo(
    () => sets.find((s) => s.id === selectedSetId) ?? null,
    [sets, selectedSetId]
  );

  const [localTitle, setLocalTitle] = useState('');

  useEffect(() => {
    setLocalTitle(selectedSet?.public_title ?? '');
  }, [selectedSet]);

  const classOverall = useMemo(
    () =>
      selectedClass
        ? overall.filter((row) => row.class_name === selectedClass)
        : overall,
    [overall, selectedClass]
  );

  // CREATE FORMS STATE
  const [modeCreate, setModeCreate] = useState<
    '' | 'qualifying' | 'reshuffle' | 'finals'
  >('');

  const [qLabel, setQLabel] = useState('Quali D1');
  const [qNum, setQNum] = useState<2 | 3 | 4>(2);
  const [qRaceIds, setQRaceIds] = useState<number[]>([]);

  const [rLabel, setRLabel] = useState('Quali D2');
  const [rNum, setRNum] = useState<2 | 3 | 4>(2);
  const [rRaceIds, setRRaceIds] = useState<number[]>([]);
  const [showInfo, setShowInfo] = useState(false);

  const [mode, setMode] = useState<'auto' | 'manual' | 'manual_ranges'>('auto');
  const [finalGroups, setFinalGroups] = useState([...COLORS_FINALS].slice(0, 2));
  const [manualSpec, setManualSpec] = useState([
    { name: 'Gold', size: 0 },
    { name: 'Silver', size: 0 },
  ]);

  const [manualRanges, setManualRanges] = useState([
    { name: 'Gold', from: 1, to: 50 },
    { name: 'Silver', from: 51, to: 100 },
  ]);

  const [lockFinals, setLockFinals] = useState(true);
  const [finalRaceIds, setFinalRaceIds] = useState<number[]>([]);

  const toggle = (arr: number[], setArr: any, id: number) =>
    setArr(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  const sortedAssignments: Assignment[] = useMemo(() => {
    const copy = assignments.slice();
    copy.sort((a, b) => {
      const na = parseSailNumber(a.sail_number);
      const nb = parseSailNumber(b.sail_number);
      return na !== nb ? na - nb : (a.helm_name ?? '').localeCompare(b.helm_name ?? '');
    });
    return copy;
  }, [assignments]);

  return (
    <div className="space-y-6">

      {errorMessage && (
        <div className="text-sm text-red-600 whitespace-pre-line">{errorMessage}</div>
      )}

      {/* ======= TOP: CLASSES ======= */}
      <div className="flex gap-2 flex-wrap">
        {classes.map((c) => (
          <button
            key={c}
            className={`px-3 py-1 rounded border ${
              c === selectedClass
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-blue-600 border-blue-600 hover:bg-blue-50'
            }`}
            onClick={() => {
              setSelectedClass(c);
              setSelectedSetId(null);
              setModeCreate('');
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {/* ======= TOP BAR: CREATE + EXISTING (OPÇÃO A) ======= */}
      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl shadow">

        {/* CREATE PANEL */}
        <div className="flex flex-col w-full sm:w-1/2">
          <span className="text-xs font-medium">Generate New Fleet Set</span>

          <select
            className="border rounded px-3 py-2 text-sm"
            value={modeCreate}
            onChange={(e) => {
              const v = e.target.value as typeof modeCreate;
              setModeCreate(v);
              if (v !== '') setSelectedSetId(null);
            }}
          >
            <option value="">Create fleet set…</option>
            <option value="qualifying">Generate fleets randomly based on entry list</option>
            <option value="reshuffle">Generate fleets based on results</option>
            <option value="finals">Generate fleets based on results (Finals)</option>
          </select>
        </div>

        {/* EXISTING PANEL */}
        <div className="flex flex-col w-full sm:w-1/2">
          <span className="text-xs font-medium">Select Existing Fleet Set</span>

          <select
            className="border rounded px-3 py-2 text-sm"
            value={selectedSetId ?? ''}
            onChange={(e) => {
              const id = Number(e.target.value);
              setSelectedSetId(id || null);
              if (id) setModeCreate('');
            }}
          >
            <option value="">—</option>
            {sets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} — {s.phase}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ===== IF EXISTING SELECTED → SHOW SET CARD ===== */}
      {selectedSet && (
        <div className="mt-4 border rounded-xl p-4 space-y-4 bg-white shadow">
          <h3 className="text-lg font-semibold">
            {selectedSet.label} ({selectedSet.phase})
          </h3>

          {/* PUBLICAÇÃO */}
          <div className="space-y-2 border-t pt-3">
            <label className="text-xs font-medium">Título público:</label>

            <input
              type="text"
              className="border rounded px-2 py-1 text-sm w-full"
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
            />

            <button
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded"
              onClick={() => updateSetTitle(selectedSet.id, localTitle)}
            >
              Guardar título
            </button>

            <div className="flex items-center gap-3 mt-2">
              <button
                disabled={!localTitle.trim()}
                className={`px-3 py-1 text-xs rounded-full border transition
                  ${
                    !localTitle.trim()
                      ? 'bg-gray-200 text-gray-400 border-gray-300 cursor-default'
                      : selectedSet.is_published
                      ? 'bg-green-600 text-white border-green-600 hover:bg-green-700'
                      : 'bg-white text-gray-700 border-gray-400 hover:bg-gray-50'
                  }
                `}
                onClick={() => {
                  if (!localTitle.trim()) return;
                  selectedSet.is_published
                    ? unpublishSet(selectedSet.id)
                    : publishSet(selectedSet.id);
                }}
              >
                {selectedSet.is_published ? 'Despublicar' : 'Publicar'}
              </button>

              {!localTitle.trim() && (
                <span className="text-[11px] text-red-600">
                  ⚠️ First set a title before publishing.
                </span>
              )}
            </div>

            {selectedSet.published_at && (
              <p className="text-xs text-gray-500">
                Publicado em: {new Date(selectedSet.published_at).toLocaleString()}
              </p>
            )}
          </div>
                        {/* ====================== RACES LIGADAS AO FLEET SET ====================== */}
<div className="space-y-3 border-t pt-3">

  <h4 className="font-semibold">
    Races ligadas a “{selectedSet.label || '(sem label)'}”
  </h4>

  {racesInSelectedSet.length === 0 ? (
    <div className="text-xs text-gray-500 italic">
      Nenhuma corrida ligada a este FleetSet.
    </div>
  ) : (
    <div className="flex flex-wrap gap-2">
      {racesInSelectedSet.map((r) => (
        <span
          key={r.id}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs bg-white"
        >
          {r.name}
          <button
            type="button"
            className="ml-1 text-red-600 hover:text-red-800"
            onClick={async () => {
              const newIds = racesInSelectedSet
                .filter((x) => x.id !== r.id)
                .map((x) => x.id);
              await updateFleetSetRaces(selectedSet.id, newIds);
            }}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  )}

  {/* ADD RACES */}
  <div className="space-y-1 text-xs">
    <div className="text-gray-600">Adicionar race a este FleetSet:</div>

    {racesAvailable.length === 0 ? (
      <div className="text-[11px] text-gray-400 italic">
        Não há races livres (sem fleet set).
      </div>
    ) : (
      <div className="flex gap-2 flex-wrap">
        {racesAvailable.map((r: RaceLite) => (
          <button
            key={r.id}
            type="button"
            className="px-2 py-1 rounded-full border hover:bg-gray-50"
            onClick={async () => {
              const currentIds = racesInSelectedSet.map((x) => x.id);
              const newIds = [...currentIds, r.id];
              await updateFleetSetRaces(selectedSet.id, newIds);
            }}
          >
            {r.name}
          </button>
        ))}
      </div>
    )}
  </div>
</div>

{/* ====================== ASSIGNMENTS ====================== */}
<div className="space-y-2 border-t pt-4">
  <h4 className="font-semibold">Assignments — {selectedSet.label}</h4>

  <div className="text-sm text-gray-600">
    Total: {sortedAssignments.length}
  </div>

  <div className="overflow-x-auto">
    <table className="table-auto w-full border">
      <thead className="bg-gray-100">
        <tr>
          <th className="border px-2 py-1">Fleet</th>
          <th className="border px-2 py-1">#</th>
          <th className="border px-2 py-1">Sail</th>
          <th className="border px-2 py-1">Boat</th>
          <th className="border px-2 py-1">Helm</th>
        </tr>
      </thead>

      <tbody>
        {sortedAssignments.map((a, i) => (
          <tr key={`${a.entry_id}-${a.fleet_id}-${i}`}>
            <td className="border px-2 py-1">
              {selectedSet.fleets.find((f) => f.id === a.fleet_id)?.name ?? '-'}
            </td>
            <td className="border px-2 py-1">{i + 1}</td>
            <td className="border px-2 py-1">{a.sail_number}</td>
            <td className="border px-2 py-1">{a.boat_name}</td>
            <td className="border px-2 py-1">{a.helm_name}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</div>

        </div>
      )}

      {/* ===== IF CREATE MODE → SHOW CREATE FORMS ===== */}

      {/* QUALIFYING */}
      {modeCreate === 'qualifying' && (
        <div className="border rounded-2xl p-4 space-y-3 bg-white shadow">
          <div className="font-semibold">Generate fleets randomly based on entry list</div>

          <div className="grid sm:grid-cols-3 gap-3">
            <label className="flex flex-col text-sm">
              Name
              <input
                value={qLabel}
                onChange={(e) => setQLabel(e.target.value)}
                className="border rounded px-2 py-1"
              />
            </label>

            <label className="flex flex-col text-sm">
              Number of fleets
              <select
                value={qNum}
                onChange={(e) => setQNum(Number(e.target.value) as 2 | 3 | 4)}
                className="border rounded px-2 py-1"
              >
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
              </select>
            </label>

            <div className="text-sm">Colours: {COLORS_QUALI.slice(0, qNum).join(', ')}</div>
          </div>

          <div className="text-sm mt-1">
            Select the races that will be scored according to the fleet assignment:
          </div>

          {racesAvailable.length === 0 ? (
            <div className="text-xs text-gray-500 italic">
              First create races so fleets can be connected.
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {racesAvailable.map((r) => (
                <button
                  key={r.id}
                  onClick={() => toggle(qRaceIds, setQRaceIds, r.id)}
                  className={`px-2 py-1 rounded border ${
                    qRaceIds.includes(r.id)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white'
                  }`}
                >
                  {r.name}
                </button>
              ))}
            </div>
          )}

          <button
            className="bg-blue-600 text-white px-4 py-2 rounded-xl"
            onClick={async () => {
              await createQualifying(qLabel, qNum, qRaceIds);
              setQRaceIds([]);
              alert('Qualifying criado.');
            }}
          >
            Generate Fleets
          </button>
        </div>
      )}

      {/* RESHUFFLE */}
      {modeCreate === 'reshuffle' && (
        <div className="border rounded-2xl p-4 space-y-3 bg-white shadow">
          <div className="font-semibold">Generate fleets based on results</div>

          <div className="grid sm:grid-cols-3 gap-3">
            <label className="flex flex-col text-sm">
              Name
              <input
                value={rLabel}
                onChange={(e) => setRLabel(e.target.value)}
                className="border rounded px-2 py-1"
              />
            </label>

            <label className="flex flex-col text-sm">
              Number of fleets
              <select
                value={rNum}
                onChange={(e) => setRNum(Number(e.target.value) as 2 | 3 | 4)}
                className="border rounded px-2 py-1"
              >
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
              </select>
            </label>

            <div className="text-sm">Colours: {COLORS_QUALI.slice(0, rNum).join(', ')}</div>
          </div>

          <button
            className="px-2 py-1 border rounded"
            onClick={() => setShowInfo((v) => !v)}
          >
            More info
          </button>

          {showInfo && (
            <div className="mt-2 text-sm bg-yellow-50 border border-yellow-200 rounded p-3">
              <p>
                <strong>Como funciona:</strong> segue o padrão oficial de reassignment.
              </p>
              <p className="mt-1">⚠️ Todas as corridas do fleet set anterior devem estar scored.</p>
            </div>
          )}

          <div className="text-sm mt-2">Select races used for this assignment:</div>

          {racesAvailable.length === 0 ? (
            <div className="text-xs text-gray-500 italic">Sem corridas disponíveis.</div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {racesAvailable.map((r) => (
                <button
                  key={r.id}
                  onClick={() => toggle(rRaceIds, setRRaceIds, r.id)}
                  className={`px-2 py-1 rounded border ${
                    rRaceIds.includes(r.id)
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white'
                  }`}
                >
                  {r.name}
                </button>
              ))}
            </div>
          )}

          <button
            className="bg-amber-600 text-white px-4 py-2 rounded-xl"
            onClick={async () => {
              await reshuffle(rLabel, rNum, rRaceIds);
              setRRaceIds([]);
              alert('Re-shuffle criado.');
            }}
          >
            Generate fleets
          </button>
        </div>
      )}

      {/* FINALS */}
      {modeCreate === 'finals' && (
        <div className="border rounded-2xl p-4 space-y-3 bg-white shadow">
          <div className="font-semibold">Generate fleets based on results (Finals)</div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={lockFinals}
              onChange={(e) => setLockFinals(e.target.checked)}
            />
            Hold these groups for the rest of the event
          </label>

          {/* MODE SELECTOR */}
          <div className="flex gap-3 items-center">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={mode === 'auto'}
                onChange={() => setMode('auto')}
              />
              Equally split
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={mode === 'manual'}
                onChange={() => setMode('manual')}
              />
              Manual (sizes)
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={mode === 'manual_ranges'}
                onChange={() => setMode('manual_ranges')}
              />
              Manual (ranges)
            </label>
          </div>

          {/* AUTO MODE */}
          {mode === 'auto' && (
            <div className="space-y-2">
              <div className="text-sm">Select fleets:</div>
              <div className="flex gap-2 flex-wrap">
                {COLORS_FINALS.map((g) => (
                  <button
                    key={g}
                    onClick={() =>
                      setFinalGroups((prev) =>
                        prev.includes(g)
                          ? prev.filter((x) => x !== g)
                          : [...prev, g]
                      )
                    }
                    className={`px-2 py-1 rounded border ${
                      finalGroups.includes(g)
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* MANUAL SIZES */}
          {mode === 'manual' && (
            <div className="space-y-2">
              <div className="text-sm">Manual definition (sizes):</div>

              {manualSpec.map((m, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className="border rounded px-2 py-1"
                    value={m.name}
                    onChange={(e) =>
                      setManualSpec((arr) =>
                        arr.map((x, ix) =>
                          ix === i ? { ...x, name: e.target.value } : x
                        )
                      )
                    }
                  />

                  <input
                    className="border rounded px-2 py-1 w-24"
                    type="number"
                    value={m.size}
                    onChange={(e) =>
                      setManualSpec((arr) =>
                        arr.map((x, ix) =>
                          ix === i
                            ? { ...x, size: Math.max(0, Number(e.target.value) || 0) }
                            : x
                        )
                      )
                    }
                  />

                  <button
                    className="px-2 border rounded"
                    onClick={() =>
                      setManualSpec((arr) => arr.filter((_, ix) => ix !== i))
                    }
                  >
                    -
                  </button>
                </div>
              ))}

              <button
                className="px-2 py-1 border rounded"
                onClick={() =>
                  setManualSpec((arr) => [...arr, { name: 'Group', size: 0 }])
                }
              >
                + Add group
              </button>
            </div>
          )}

          {/* MANUAL RANGES */}
          {mode === 'manual_ranges' && (
            <div className="space-y-2">
              <div className="text-sm">Manual definition (ranges):</div>

              {manualRanges.map((m, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className="border rounded px-2 py-1 w-28"
                    value={m.name}
                    onChange={(e) =>
                      setManualRanges((arr) =>
                        arr.map((x, ix) =>
                          ix === i ? { ...x, name: e.target.value } : x
                        )
                      )
                    }
                  />

                  <input
                    className="border rounded px-2 py-1 w-20"
                    type="number"
                    value={m.from}
                    onChange={(e) =>
                      setManualRanges((arr) =>
                        arr.map((x, ix) =>
                          ix === i
                            ? { ...x, from: Math.max(1, Number(e.target.value) || 1) }
                            : x
                        )
                      )
                    }
                  />

                  <span className="self-center">–</span>

                  <input
                    className="border rounded px-2 py-1 w-20"
                    type="number"
                    value={m.to}
                    onChange={(e) =>
                      setManualRanges((arr) =>
                        arr.map((x, ix) =>
                          ix === i
                            ? {
                                ...x,
                                to: Math.max(
                                  m.from,
                                  Number(e.target.value) || m.from
                                ),
                              }
                            : x
                        )
                      )
                    }
                  />

                  <button
                    className="px-2 border rounded"
                    onClick={() =>
                      setManualRanges((arr) => arr.filter((_, ix) => ix !== i))
                    }
                  >
                    -
                  </button>
                </div>
              ))}

              <button
                className="px-2 py-1 border rounded"
                onClick={() =>
                  setManualRanges((arr) => [
                    ...arr,
                    { name: 'Group', from: 1, to: 1 },
                  ])
                }
              >
                + Add range
              </button>
            </div>
          )}

          {/* SELECT FINALS RACES */}
          <div className="text-sm">Attach races to these Finals:</div>

          {racesAvailable.length === 0 ? (
            <div className="text-xs text-gray-500 italic">No available races.</div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {racesAvailable.map((r) => (
                <button
                  key={r.id}
                  onClick={() => toggle(finalRaceIds, setFinalRaceIds, r.id)}
                  className={`px-2 py-1 rounded border ${
                    finalRaceIds.includes(r.id)
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white'
                  }`}
                >
                  {r.name}
                </button>
              ))}
            </div>
          )}

          {/* START FINALS */}
          <button
            className="bg-emerald-600 text-white px-4 py-2 rounded-xl"
            onClick={async () => {
              const grouping: Record<string, number> = {};
              const total = classOverall.length;

              if (total === 0) {
                alert('No ranking available for this class.');
                return;
              }

              if (mode === 'auto') {
                const numGroups = finalGroups.length;
                const baseSize = Math.floor(total / numGroups);
                let extra = total % numGroups;

                finalGroups.forEach((g) => {
                  grouping[g] = baseSize + (extra > 0 ? 1 : 0);
                  if (extra > 0) extra -= 1;
                });
              } else if (mode === 'manual') {
                manualSpec.forEach((g) => {
                  if (g.size > 0) grouping[g.name] = g.size;
                });
              } else {
                manualRanges.forEach((g) => {
                  grouping[g.name] = g.to - g.from + 1;
                });
              }

              await startFinals('Finals', grouping, finalRaceIds);
              setFinalRaceIds([]);
              alert('Finals initiated.');
            }}
          >
            Start Finals
          </button>
        </div>
      )}
    </div>
  );
}
