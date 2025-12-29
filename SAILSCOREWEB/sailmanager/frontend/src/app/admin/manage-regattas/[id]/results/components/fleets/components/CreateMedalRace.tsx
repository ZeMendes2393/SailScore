'use client';

import { useMemo, useState } from 'react';
import type { OverallRow } from '../types';
import type { RaceLite } from '../../../hooks/useFleets';

type Props = {
  classOverall: OverallRow[];
  racesAvailable: RaceLite[];
  selectedClass: string;
  createMedalRace: (
    className: string,
    fromRank: number,
    toRank: number,
    raceIds?: number[]
  ) => Promise<void>;
};

export default function CreateMedalRace({
  classOverall,
  racesAvailable,
  selectedClass,
  createMedalRace,
}: Props) {
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(10);

  // ✅ agora é opcional e pode ser múltiplo
  const [selectedRaceIds, setSelectedRaceIds] = useState<number[]>([]);

  const top = useMemo(() => {
    return classOverall
      .slice()
      .sort((a, b) => a.overall_rank - b.overall_rank)
      .slice(from - 1, to);
  }, [classOverall, from, to]);

  const toggleRace = (id: number) => {
    setSelectedRaceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const total = classOverall.length;

  return (
    <div className="border rounded-xl p-4 bg-white shadow space-y-4">
      <h3 className="text-lg font-semibold">🏅 Medal Race</h3>

      <div className="flex gap-4 text-sm">
        <label className="flex flex-col">
          From
          <input
            type="number"
            min={1}
            max={Math.max(1, total)}
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
            max={Math.max(1, total)}
            value={to}
            onChange={(e) => setTo(Number(e.target.value))}
            className="border rounded px-2 py-1"
          />
        </label>
      </div>

      <div className="text-sm font-medium">
        Selected sailors: {top.length}
      </div>

      {/* Preview */}
      <ul className="text-xs mt-1 space-y-1">
        {top.map((s) => (
          <li key={s.overall_rank}>
            #{s.overall_rank} — {s.sail_number} {s.skipper_name} ({s.net_points})
          </li>
        ))}
      </ul>

      {/* ✅ opcional */}
      <div>
        <div className="text-sm mb-2">
          (Opcional) Associar races já à Medal Race:
        </div>

        {racesAvailable.length === 0 ? (
          <div className="text-xs text-gray-500">
            Não há races disponíveis para associar agora (podes associar depois).
          </div>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {racesAvailable.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => toggleRace(r.id)}
                className={`px-2 py-1 rounded border ${
                  selectedRaceIds.includes(r.id)
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white'
                }`}
              >
                {r.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        disabled={top.length === 0 || !selectedClass}
        className={`px-4 py-2 rounded-xl text-white ${
          top.length > 0 && selectedClass
            ? 'bg-emerald-600'
            : 'bg-gray-400 cursor-not-allowed'
        }`}
        onClick={async () => {
          try {
            await createMedalRace(selectedClass, from, to, selectedRaceIds);
            setSelectedRaceIds([]);
            alert('Medal Race criada com sucesso!');
          } catch (e: any) {
            alert(e?.message ?? 'Erro ao criar Medal Race.');
          }
        }}
      >
        Create Medal Race
      </button>
    </div>
  );
}
