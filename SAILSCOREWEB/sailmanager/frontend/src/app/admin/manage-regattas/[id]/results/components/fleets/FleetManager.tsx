'use client';

import { useMemo, useState } from 'react';

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

  // 👇 novos campos vindos do backend
  overall_rank: number;
  finals_fleet?: string | null;
};

type FleetManagerProps = {
  // ranking já ordenado pelo backend (respeita finals groups)
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
    racesInSelectedSet, // 👈 vem do hook
    loading,
    error,
    createQualifying,
    reshuffle,
    startFinals,
    deleteFleetSet,
    updateFleetSetRaces,
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

  // ranking só da classe selecionada
  const classOverall: OverallRow[] = useMemo(
    () =>
      selectedClass
        ? overall.filter((row) => row.class_name === selectedClass)
        : overall,
    [overall, selectedClass]
  );

  // forms Qualifying
  const [qLabel, setQLabel] = useState('Quali D1');
  const [qNum, setQNum] = useState<2 | 3 | 4>(2);
  const [qRaceIds, setQRaceIds] = useState<number[]>([]);

  // forms Reshuffle
  const [rLabel, setRLabel] = useState('Quali D2');
  const [rNum, setRNum] = useState<2 | 3 | 4>(2);
  const [rRaceIds, setRRaceIds] = useState<number[]>([]);
  const [showInfo, setShowInfo] = useState(false);

  // finals
  const [mode, setMode] = useState<'auto' | 'manual' | 'manual_ranges'>('auto');
  const [finalGroups, setFinalGroups] = useState<string[]>(
    [...COLORS_FINALS].slice(0, 2)
  );
  const [manualSpec, setManualSpec] = useState<
    { name: string; size: number }[]
  >([
    { name: 'Gold', size: 0 },
    { name: 'Silver', size: 0 },
  ]);
  const [manualRanges, setManualRanges] = useState<
    { name: string; from: number; to: number }[]
  >([
    { name: 'Gold', from: 1, to: 50 },
    { name: 'Silver', from: 51, to: 100 },
  ]);
  const [lockFinals, setLockFinals] = useState(true); // ainda não usado no backend
  const [finalRaceIds, setFinalRaceIds] = useState<number[]>([]);

  const toggle = (arr: number[], setArr: (v: number[]) => void, id: number) =>
    setArr(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  // assignments ordenados por nº de vela
  const sortedAssignments: Assignment[] = useMemo(() => {
    const copy = assignments.slice();
    copy.sort((a: Assignment, b: Assignment) => {
      const na = parseSailNumber(a.sail_number);
      const nb = parseSailNumber(b.sail_number);
      if (na !== nb) return na - nb;
      return (a.helm_name ?? '').localeCompare(b.helm_name ?? '');
    });
    return copy;
  }, [assignments]);

  return (
    <div className="space-y-6">
      {/* Erros globais do hook */}
      {errorMessage && (
        <div className="text-sm text-red-600 whitespace-pre-line">
          {errorMessage}
        </div>
      )}

      {/* classes */}
      <div className="flex gap-2 flex-wrap">
        {classes.map((c: string) => (
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
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {/* sets */}
      <div className="space-y-2">
        <h4 className="font-semibold">Fleet Sets</h4>
        {loading ? (
          <div>A carregar…</div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {sets.map((s: FleetSet) => {
              const raceNamesForCard = selectedSetId === s.id
                ? racesInSelectedSet.map((r) => r.name)
                : (s.race_names ?? []);

              return (
                <div
                  key={s.id}
                  className={`border rounded-xl p-3 hover:bg-gray-50 relative ${
                    selectedSetId === s.id ? 'border-blue-600' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedSetId(s.id)}
                    className="block w-full text-left"
                  >
                    <div className="text-sm text-gray-500">
                      {s.phase.toUpperCase()}
                    </div>
                    <div className="font-semibold">
                      {s.label || '(sem label)'}
                    </div>
                    <div className="text-sm">
                      Fleets: {s.fleets.map((f) => f.name).join(', ')}
                    </div>
                    {raceNamesForCard.length > 0 && (
                      <div className="text-xs text-gray-500 mt-1">
                        Races: {raceNamesForCard.join(', ')}
                      </div>
                    )}
                  </button>

                  {/* Botão apagar FleetSet */}
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (
                        !confirm(
                          'Apagar este FleetSet (fleets + assignments)?'
                        )
                      )
                        return;
                      await deleteFleetSet(s.id);
                    }}
                    className="absolute top-2 right-2 text-xs text-red-600 hover:text-red-700"
                  >
                    🗑
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Races ligadas + assignments do FleetSet selecionado */}
      {selectedSet && (
        <div className="space-y-4">
          {/* Races ligadas a este FleetSet */}
          <div className="space-y-2">
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
                        try {
                          const newIds = racesInSelectedSet
                            .filter((x) => x.id !== r.id)
                            .map((x) => x.id);
                          await updateFleetSetRaces(selectedSet.id, newIds);
                        } catch {
                          // o hook já trata de erros/alerts
                        }
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Adicionar races livres a este FleetSet */}
            <div className="space-y-1 text-xs">
              <div className="text-gray-600">Adicionar race a este grupo:</div>
              {racesAvailable.length === 0 ? (
                <div className="text-[11px] text-gray-400 italic">
                  Não há mais races livres (sem fleet set) nesta classe.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {racesAvailable.map((r: RaceLite) => (
                    <button
                      key={r.id}
                      type="button"
                      className="px-2 py-1 rounded-full border hover:bg-gray-50"
                      onClick={async () => {
                        try {
                          const currentIds = racesInSelectedSet.map(
                            (x) => x.id
                          );
                          const newIds = [...currentIds, r.id];
                          await updateFleetSetRaces(selectedSet.id, newIds);
                        } catch {
                          // erros tratados no hook
                        }
                      }}
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* assignments */}
          <div className="space-y-2">
            <h4 className="font-semibold">
              Assignments — {selectedSet.label}
            </h4>
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
                  {sortedAssignments.map((a: Assignment, i: number) => (
                    <tr key={`${a.entry_id}-${a.fleet_id}-${i}`}>
                      <td className="border px-2 py-1">
                        {selectedSet.fleets.find((f) => f.id === a.fleet_id)
                          ?.name ?? '-'}
                      </td>
                      <td className="border px-2 py-1">{i + 1}</td>
                      <td className="border px-2 py-1">
                        {a.sail_number ?? ''}
                      </td>
                      <td className="border px-2 py-1">
                        {a.boat_name ?? ''}
                      </td>
                      <td className="border px-2 py-1">
                        {a.helm_name ?? ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* criar qualifying */}
      <div className="border rounded-2xl p-4 space-y-3">
        <div className="font-semibold">
          Generate fleets randomly based on entry list
        </div>
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
          <div className="text-sm">
            Colours: {COLORS_QUALI.slice(0, qNum).join(', ')}
          </div>
        </div>

        <div className="text-sm mt-1">
          Select the races that will be scored according to the fleet assignment:
        </div>
        {racesAvailable.length === 0 ? (
          <div className="text-xs text-gray-500 italic">
            First create races so fleets can be connected to those races.
          </div>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {racesAvailable.map((r: RaceLite) => (
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
            try {
              await createQualifying(qLabel, qNum, qRaceIds);
              setQRaceIds([]);
              alert('Qualifying criado.');
            } catch (e: unknown) {
              const msg =
                e instanceof Error ? e.message : 'Falha a criar qualifying.';
              alert(msg);
            }
          }}
        >
          Generate Fleets
        </button>
      </div>

      {/* reshuffle */}
      <div className="border rounded-2xl p-4 space-y-3">
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
          <div className="text-sm">
            Colours: {COLORS_QUALI.slice(0, rNum).join(', ')}
          </div>
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
              <strong>Como funciona:</strong> segue o padrão oficial de
              reassignment (2/3/4 frotas) com base no ranking atual.
            </p>
            <p className="mt-1">
              ⚠️ Pré-condição: todas as corridas do <em>Fleet Set</em> anterior
              têm de estar scored.
            </p>
          </div>
        )}

        {/* Preview do ranking que está a ser usado como seed */}
        {classOverall.length > 0 && (
          <div className="mt-3 text-xs text-gray-700">
            <div className="font-semibold mb-1">
              Ranking atual (seed para o reshuffle):
            </div>
            <ol className="list-decimal pl-4 space-y-0.5">
              {classOverall.map((row) => (
                <li
                  key={`${row.sail_number}-${row.skipper_name}`}
                >
                  #{row.overall_rank} – {row.sail_number} {row.skipper_name}
                  {row.finals_fleet ? ` [${row.finals_fleet}]` : ''} (NET{' '}
                  {row.net_points.toFixed(2)})
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="text-sm mt-2">
          Select the races that will be scored according to this fleet
          assignment:
        </div>
        {racesAvailable.length === 0 ? (
          <div className="text-xs text-gray-500 italic">
            Sem corridas disponíveis.
          </div>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {racesAvailable.map((r: RaceLite) => (
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
            try {
              await reshuffle(rLabel, rNum, rRaceIds);
              setRRaceIds([]);
              alert('Re-shuffle criado.');
            } catch (e: unknown) {
              const msg =
                e instanceof Error ? e.message : 'Falha no reshuffle.';
              alert(msg);
            }
          }}
        >
          Generate fleets
        </button>
      </div>

      {/* finals */}
      <div className="border rounded-2xl p-4 space-y-3">
        <div className="font-semibold">
          Generate fleets based on results (Finals)
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={lockFinals}
            onChange={(e) => setLockFinals(e.target.checked)}
          />
          Hold these groups for the rest of the event
        </label>

        <div className="flex gap-3 items-center">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={mode === 'auto'}
              onChange={() => setMode('auto')}
            />{' '}
            Equally split
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={mode === 'manual'}
              onChange={() => setMode('manual')}
            />{' '}
            Manual (sizes)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={mode === 'manual_ranges'}
              onChange={() => setMode('manual_ranges')}
            />{' '}
            Manual (ranges)
          </label>
        </div>

        {mode === 'auto' && (
          <div className="space-y-2">
            <div className="text-sm">Select fleets:</div>
            <div className="flex gap-2 flex-wrap">
              {COLORS_FINALS.map((g: string) => (
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

        {mode === 'manual' && (
          <div className="space-y-2">
            <div className="text-sm">Definição manual (por tamanho):</div>
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
                          ? {
                              ...x,
                              size: Math.max(0, Number(e.target.value) || 0),
                            }
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
                setManualSpec((a) => [...a, { name: 'Group', size: 0 }])
              }
            >
              + grupo
            </button>
          </div>
        )}

        {mode === 'manual_ranges' && (
          <div className="space-y-2">
            <div className="text-sm">Definição manual (por intervalos):</div>
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
                          ? {
                              ...x,
                              from: Math.max(1, Number(e.target.value) || 1),
                            }
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
                              to: Math.max(m.from, Number(e.target.value) || m.from),
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
                setManualRanges((a) => [
                  ...a,
                  { name: 'Group', from: 1, to: 1 },
                ])
              }
            >
              + range
            </button>
          </div>
        )}

        <div className="text-sm">Vincular corridas das Finals:</div>
        {racesAvailable.length === 0 ? (
          <div className="text-xs text-gray-500 italic">
            Sem corridas disponíveis.
          </div>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {racesAvailable.map((r: RaceLite) => (
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

        <button
          className="bg-emerald-600 text-white px-4 py-2 rounded-xl"
          onClick={async () => {
            try {
              const grouping: Record<string, number> = {};
              const total = classOverall.length;

              if (total === 0) {
                throw new Error('Não há ranking (overall) para esta classe.');
              }

              if (mode === 'auto') {
                const numGroups = finalGroups.length;
                if (numGroups === 0) {
                  throw new Error('Escolhe pelo menos um grupo para as finals.');
                }
                const baseSize = Math.floor(total / numGroups);
                let resto = total % numGroups;
                for (const g of finalGroups) {
                  grouping[g] = baseSize + (resto > 0 ? 1 : 0);
                  if (resto > 0) resto -= 1;
                }
              } else if (mode === 'manual') {
                manualSpec.forEach((g) => {
                  if (g.name && g.size > 0) {
                    grouping[g.name] = g.size;
                  }
                });
              } else {
                manualRanges.forEach((g) => {
                  if (g.name && g.to >= g.from) {
                    const size = g.to - g.from + 1;
                    if (size > 0) grouping[g.name] = size;
                  }
                });
              }

              if (Object.keys(grouping).length === 0) {
                throw new Error('Nenhum grupo válido definido para as finals.');
              }

              await startFinals('Finals', grouping, finalRaceIds);
              setFinalRaceIds([]);
              alert('Finals iniciadas.');
            } catch (e: unknown) {
              const msg =
                e instanceof Error ? e.message : 'Falha a iniciar Finals.';
              alert(msg);
            }
          }}
        >
          Iniciar Finals
        </button>
      </div>
    </div>
  );
}
