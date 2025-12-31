'use client';

import type { RaceLite, FleetSet } from '../../../hooks/useFleets';

type Props = {
  qLabel: string;
  setQLabel: (v: string) => void;

  qNum: 2 | 3 | 4;
  setQNum: (v: 2 | 3 | 4) => void;

  qRaceIds: number[];
  setQRaceIds: (v: number[]) => void;

  racesAvailable: RaceLite[];

  createQualifying: (
    label: string,
    num_fleets: 2 | 3 | 4,
    race_ids: number[]
  ) => Promise<FleetSet>;
};

export default function CreateQualifying({
  qLabel,
  setQLabel,
  qNum,
  setQNum,
  qRaceIds,
  setQRaceIds,
  racesAvailable,
  createQualifying,
}: Props) {
  const toggle = (id: number) => {
    setQRaceIds(
      qRaceIds.includes(id) ? qRaceIds.filter((x) => x !== id) : [...qRaceIds, id]
    );
  };

  return (
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

        <div className="text-sm">
          Colours: {['Yellow', 'Blue', 'Red', 'Green'].slice(0, qNum).join(', ')}
        </div>
      </div>

      <div className="text-sm mt-1">Select the races that will be scored:</div>

      <div className="flex gap-2 flex-wrap">
        {racesAvailable.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => toggle(r.id)}
            className={`px-2 py-1 rounded border ${
              qRaceIds.includes(r.id) ? 'bg-blue-600 text-white' : 'bg-white'
            }`}
          >
            {r.name}
          </button>
        ))}
      </div>

      <button
        className="bg-blue-600 text-white px-4 py-2 rounded-xl"
        onClick={async () => {
          try {
            const fs = await createQualifying(qLabel, qNum, qRaceIds);
            setQRaceIds([]);
            alert(`Qualifying criado com sucesso! (FleetSet #${fs.id})`);
          } catch (e: any) {
            alert(e?.message ?? 'Erro ao criar Qualifying.');
          }
        }}
      >
        Generate Fleets
      </button>
    </div>
  );
}
