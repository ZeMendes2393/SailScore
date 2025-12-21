'use client';

import { useState, useMemo } from 'react';
import type { OverallRow } from '../types';
import type { RaceLite } from '../../../hooks/useFleets';

type Props = {
  classOverall: OverallRow[];
  racesAvailable: RaceLite[];
  regattaId: number;
  createMedalRace: (regattaId: number, raceId: number, entries: number[]) => Promise<void>;
};

export default function CreateMedalRace({
  classOverall,
  racesAvailable,
  regattaId,
  createMedalRace,
}: Props) {

  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(10);
  const [selectedRaceId, setSelectedRaceId] = useState<number | null>(null);

  const top = useMemo(() => {
    return classOverall
      .slice()
      .sort((a, b) => a.overall_rank - b.overall_rank)
      .slice(from - 1, to);
  }, [classOverall, from, to]);

  return (
    <div className="border rounded-xl p-4 bg-white shadow space-y-4">
      <h3 className="text-lg font-semibold">Medal Race</h3>

      <div className="flex gap-4 text-sm">
        <label className="flex flex-col">
          From
          <input
            type="number"
            min={1}
            max={classOverall.length}
            value={from}
            onChange={(e) => setFrom(Number(e.target.value))}
            className="border rounded px-2 py-1"
          />
        </label>

        <label className="flex flex-col">
          To
          <input
            type="number"
            min={1}
            max={classOverall.length}
            value={to}
            onChange={(e) => setTo(Number(e.target.value))}
            className="border rounded px-2 py-1"
          />
        </label>
      </div>

      <div className="text-sm font-medium">
        Selected sailors: {top.length}
      </div>

      <ul className="text-xs mt-1 space-y-1">
        {top.map((s) => (
          <li key={s.entry_id}>
            #{s.overall_rank} — {s.sail_number} {s.skipper_name} ({s.net_points})
          </li>
        ))}
      </ul>

      <div>
        <div className="text-sm mb-2">Select Medal Race:</div>
        <div className="flex gap-2 flex-wrap">
          {racesAvailable.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedRaceId(r.id)}
              className={`px-2 py-1 rounded border ${
                selectedRaceId === r.id ? 'bg-emerald-600 text-white' : 'bg-white'
              }`}
            >
              {r.name}
            </button>
          ))}
        </div>
      </div>

      <button
        disabled={!selectedRaceId}
        className={`px-4 py-2 rounded-xl text-white ${
          selectedRaceId ? 'bg-emerald-600' : 'bg-gray-400 cursor-not-allowed'
        }`}
        onClick={async () => {
          if (!selectedRaceId) return;
          await createMedalRace(regattaId, selectedRaceId, top.map((s) => s.entry_id));
          alert("Medal Race criada com sucesso!");
        }}
      >
        Create Medal Race
      </button>
    </div>
  );
}
