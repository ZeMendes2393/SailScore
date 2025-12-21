'use client';

import type { RaceLite } from '../../../hooks/useFleets';
import type { OverallRow } from '../types';

type Props = {
  classOverall: OverallRow[];

  mode: 'auto' | 'manual' | 'manual_ranges';
  setMode: (v: 'auto' | 'manual' | 'manual_ranges') => void;

  lockFinals: boolean;
  setLockFinals: (v: boolean) => void;

  finalGroups: string[];
  setFinalGroups: (v: string[]) => void;

  manualSpec: { name: string; size: number }[];
  setManualSpec: (v: { name: string; size: number }[]) => void;

  manualRanges: { name: string; from: number; to: number }[];
  setManualRanges: (v: { name: string; from: number; to: number }[]) => void;

  finalRaceIds: number[];
  setFinalRaceIds: (v: number[]) => void;

  racesAvailable: RaceLite[];

  startFinals: (
    label: string,
    grouping: Record<string, number>,
    race_ids?: number[]
  ) => Promise<void>;
};

export default function CreateFinals({
  classOverall,
  mode,
  setMode,
  lockFinals,
  setLockFinals,
  finalGroups,
  setFinalGroups,
  manualSpec,
  setManualSpec,
  manualRanges,
  setManualRanges,
  finalRaceIds,
  setFinalRaceIds,
  racesAvailable,
  startFinals,
}: Props) {
  const toggleRace = (id: number) => {
    setFinalRaceIds(
      finalRaceIds.includes(id)
        ? finalRaceIds.filter((x) => x !== id)
        : [...finalRaceIds, id]
    );
  };

  return (
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

      {/* Mode selector */}
      <div className="flex gap-4 items-center">
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" checked={mode === 'auto'} onChange={() => setMode('auto')} />
          Auto
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input type="radio" checked={mode === 'manual'} onChange={() => setMode('manual')} />
          Manual (sizes)
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input type="radio" checked={mode === 'manual_ranges'} onChange={() => setMode('manual_ranges')} />
          Manual (ranges)
        </label>
      </div>

      {/* AUTO MODE */}
      {mode === 'auto' && (
        <div className="space-y-2">
          <div className="text-sm">Select fleets:</div>
          <div className="flex gap-2 flex-wrap">
            {['Gold', 'Silver', 'Bronze', 'Emerald'].map((g) => (
              <button
                key={g}
                onClick={() =>
                  setFinalGroups(
                    finalGroups.includes(g)
                      ? finalGroups.filter((x) => x !== g)
                      : [...finalGroups, g]
                  )
                }
                className={`px-2 py-1 rounded border ${
                  finalGroups.includes(g)
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* RACEs */}
      <div className="text-sm">Attach races to these Finals:</div>
      <div className="flex gap-2 flex-wrap">
        {racesAvailable.map((r) => (
          <button
            key={r.id}
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
          if (classOverall.length === 0) {
            alert('No ranking available for this class.');
            return;
          }

          const grouping: Record<string, number> = {};

          if (mode === 'auto') {
            const total = classOverall.length;
            const slots = finalGroups.length;

            const base = Math.floor(total / slots);
            let extra = total % slots;

            finalGroups.forEach((g) => {
              grouping[g] = base + (extra > 0 ? 1 : 0);
              if (extra > 0) extra -= 1;
            });
          }

          await startFinals('Finals', grouping, finalRaceIds);
          setFinalRaceIds([]);
        }}
      >
        Start Finals
      </button>
    </div>
  );
}
