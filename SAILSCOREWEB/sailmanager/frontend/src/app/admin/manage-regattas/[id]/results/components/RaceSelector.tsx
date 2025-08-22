'use client';

import type { Race } from '../types';

interface Props {
  races: Race[];
  selectedRaceId: number | null;
  onSelect: (raceId: number | null) => void;
  onResetLists?: () => void;
}

export default function RaceSelector({ races, selectedRaceId, onSelect, onResetLists }: Props) {
  return (
    <>
      <label className="block mb-2 text-sm font-medium text-gray-700">Seleciona uma corrida:</label>
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
        {races.map((race) => (
          <option key={race.id} value={race.id}>
            {race.name} ({race.class_name})
          </option>
        ))}
      </select>
    </>
  );
}
