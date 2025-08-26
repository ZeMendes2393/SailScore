'use client';

import { useMemo } from 'react';
import type { Race } from '../types';

interface Props {
  races: Race[];
  selectedRaceId: number | null;
  onSelect: (raceId: number | null) => void;
  onResetLists?: () => void;
}

export default function RaceSelector({ races, selectedRaceId, onSelect, onResetLists }: Props) {
  // Dedup por id e ordena por order_index (fallback id)
  const uniqueRaces = useMemo(() => {
    const m = new Map<number, Race>();
    for (const r of races || []) m.set(r.id, r);
    return Array.from(m.values()).sort((a: any, b: any) =>
      (a.order_index ?? a.id) - (b.order_index ?? b.id)
    );
  }, [races]);

  return (
    <>
      <label className="block mb-2 text-sm font-medium text-gray-700">
        Seleciona uma corrida:
      </label>
      <select
        className="border rounded p-2 w-full mb-4"
        value={selectedRaceId ?? ''}
        onChange={(e) => {
          const value = e.target.value;
          const raceId = value ? Number(value) : null;
          onSelect(raceId);
          onResetLists?.();
        }}
      >
        <option value="">-- Escolher corrida --</option>
        {uniqueRaces.map((race) => (
          <option key={`race-${race.id}`} value={race.id}>
            {race.name} ({race.class_name})
          </option>
        ))}
      </select>
    </>
  );
}
