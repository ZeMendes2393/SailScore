'use client';

import type { RaceLite, FleetSet } from '../../../hooks/useFleets';
import notify from '@/lib/notify';

type Props = {
  classes: string[];
  selectedClass: string | null;
  setSelectedClass: (c: string | null) => void;

  rNum: 2 | 3 | 4;
  setRNum: (v: 2 | 3 | 4) => void;

  rRaceIds: number[];
  setRRaceIds: (v: number[]) => void;

  racesAvailable: RaceLite[];
  reshuffle: (num_fleets: 2 | 3 | 4, race_ids: number[]) => Promise<FleetSet>;
};

export default function CreateReshuffle({
  classes,
  selectedClass,
  setSelectedClass,
  rNum,
  setRNum,
  rRaceIds,
  setRRaceIds,
  racesAvailable,
  reshuffle,
}: Props) {
  const toggle = (id: number) => {
    setRRaceIds(
      rRaceIds.includes(id) ? rRaceIds.filter((x) => x !== id) : [...rRaceIds, id]
    );
  };

  return (
    <div className="border rounded-2xl p-4 space-y-3 bg-white shadow">
      <div className="font-semibold">Generate fleets based on results</div>

      <div className="grid sm:grid-cols-3 gap-3">
        <label className="flex flex-col text-sm">
          Class
          <select
            className="border rounded px-2 py-1"
            value={selectedClass ?? ''}
            onChange={(e) => setSelectedClass(e.target.value || null)}
          >
            {classes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
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
          Colours: {['Yellow', 'Blue', 'Red', 'Green'].slice(0, rNum).join(', ')}
        </div>
      </div>

      <div className="text-sm">Select races:</div>

      <div className="flex gap-2 flex-wrap">
        {racesAvailable.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => toggle(r.id)}
            className={`px-2 py-1 rounded border ${
              rRaceIds.includes(r.id) ? 'bg-amber-600 text-white' : 'bg-white'
            }`}
          >
            {r.name}
          </button>
        ))}
      </div>

      <button
        disabled={!selectedClass}
        className="bg-amber-600 text-white px-4 py-2 rounded-xl disabled:opacity-50"
        onClick={async () => {
          try {
            const fs = await reshuffle(rNum, rRaceIds);
            setRRaceIds([]);
            notify.success(`Reshuffle created successfully (Fleet Set #${fs.id}).`);
          } catch (e: any) {
            notify.error(e?.message ?? 'Error creating Reshuffle.');
          }
        }}
      >
        Generate Fleets
      </button>
    </div>
  );
}
