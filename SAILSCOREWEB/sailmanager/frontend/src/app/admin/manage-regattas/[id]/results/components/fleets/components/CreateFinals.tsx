'use client';

import type { RaceLite, FleetSet } from '../../../hooks/useFleets';
import type { OverallRow } from '../types';

type RangeRow = { name: string; from: string; to: string };

type Props = {
  classOverall: OverallRow[];

  // Manual ranges (ONLY)
  manualRanges: RangeRow[];
  setManualRanges: (v: RangeRow[]) => void;

  // Races to attach
  finalRaceIds: number[];
  setFinalRaceIds: (v: number[]) => void;
  racesAvailable: RaceLite[];

  startFinals: (
    label: string,
    grouping: Record<string, number>,
    race_ids?: number[]
  ) => Promise<FleetSet>;

  // Mantemos estes props (mesmo que não uses na UI agora)
  lockFinals: boolean;
  setLockFinals: (v: boolean) => void;
};

export default function CreateFinals({
  classOverall,
  manualRanges,
  setManualRanges,
  finalRaceIds,
  setFinalRaceIds,
  racesAvailable,
  startFinals,
  lockFinals,
  setLockFinals,
}: Props) {
  const toggleRace = (id: number) => {
    setFinalRaceIds(
      finalRaceIds.includes(id)
        ? finalRaceIds.filter((x) => x !== id)
        : [...finalRaceIds, id]
    );
  };

  const updateRange = (idx: number, patch: Partial<RangeRow>) => {
    setManualRanges(
      manualRanges.map((r, i) => (i === idx ? { ...r, ...patch } : r))
    );
  };

  const removeRange = (idx: number) => {
    setManualRanges(manualRanges.filter((_, i) => i !== idx));
  };

  const addRange = () => {
    setManualRanges([...manualRanges, { name: 'Group', from: '', to: '' }]);
  };

  const totalBoats = classOverall.length;

  return (
    <div className="border rounded-2xl p-4 space-y-3 bg-white shadow">
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold">Generate finals groups (ranges)</div>
        <div className="text-xs text-gray-500">
          Boats in ranking: <span className="font-semibold">{totalBoats}</span>
        </div>
      </div>

      {/* UI escondida por agora */}
      {/*
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={lockFinals}
          onChange={(e) => setLockFinals(e.target.checked)}
        />
        Hold these groups for the rest of the event
      </label>
      */}

      {/* MANUAL RANGES ONLY */}
      <div className="space-y-2">
        <div className="text-sm">Define os ranges (posições no ranking):</div>

        {manualRanges.map((r, i) => (
          <div key={i} className="flex gap-2 items-center flex-wrap">
            <input
              className="border rounded px-2 py-1 w-32"
              value={r.name}
              onChange={(e) => updateRange(i, { name: e.target.value })}
              placeholder="Gold / Silver..."
            />

            <input
              className="border rounded px-2 py-1 w-20"
              type="number"
              inputMode="numeric"
              value={r.from}
              onChange={(e) => updateRange(i, { from: e.target.value })}
              placeholder="from"
              min={1}
            />

            <span>–</span>

            <input
              className="border rounded px-2 py-1 w-20"
              type="number"
              inputMode="numeric"
              value={r.to}
              onChange={(e) => updateRange(i, { to: e.target.value })}
              placeholder="to"
              min={1}
            />

            <button
              type="button"
              className="px-2 py-1 border rounded"
              onClick={() => removeRange(i)}
              title="Remove range"
            >
              -
            </button>
          </div>
        ))}

        <button
          type="button"
          className="px-2 py-1 border rounded"
          onClick={addRange}
        >
          + Add range
        </button>

        <div className="text-xs text-gray-500">
          Dica: agora podes apagar o número (ficar vazio) e escrever outro sem ele
          “voltar” sozinho.
        </div>
      </div>

      {/* RACES */}
      <div className="text-sm">Attach races to these Finals:</div>
      <div className="flex gap-2 flex-wrap">
        {racesAvailable.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => toggleRace(r.id)}
            className={`px-2 py-1 rounded border ${
              finalRaceIds.includes(r.id)
                ? 'bg-emerald-600 text-white'
                : 'bg-white'
            }`}
          >
            {r.name}
          </button>
        ))}
      </div>

      <button
        className="bg-emerald-600 text-white px-4 py-2 rounded-xl"
        onClick={async () => {
          if (totalBoats === 0) {
            alert('No ranking available for this class.');
            return;
          }

          const grouping: Record<string, number> = {};

          for (const g of manualRanges) {
            const name = (g.name || '').trim();
            if (!name) continue;

            // Permite vazio enquanto edita; na submissão validamos
            const fromRaw = (g.from || '').trim();
            const toRaw = (g.to || '').trim();

            if (!fromRaw || !toRaw) {
              alert(`Range "${name}" tem from/to vazio.`);
              return;
            }

            const from = Math.max(1, parseInt(fromRaw, 10));
            const to = Math.max(from, parseInt(toRaw, 10));
            const size = to - from + 1;

            if (!Number.isFinite(from) || !Number.isFinite(to) || size <= 0) {
              alert(`Range inválido em "${name}".`);
              return;
            }

            grouping[name] = size;
          }

          if (Object.keys(grouping).length === 0) {
            alert('Ranges inválidos.');
            return;
          }

          const sum = Object.values(grouping).reduce((a, b) => a + b, 0);
          if (sum > totalBoats) {
            alert(`Os ranges somam ${sum}, mas só há ${totalBoats} boats no ranking.`);
            return;
          }

          await startFinals('Finals', grouping, finalRaceIds);
          setFinalRaceIds([]);
          alert('Finals criado com sucesso!');
        }}
      >
        Start Finals
      </button>
    </div>
  );
}
