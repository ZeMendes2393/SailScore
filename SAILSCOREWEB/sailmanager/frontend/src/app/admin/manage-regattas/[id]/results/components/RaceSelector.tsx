'use client';

import { useMemo } from 'react';
import type { Race } from '../types';

/** One line in the race dropdown: name + class, never duplicating "(class)" from `race.name`. */
function raceSelectLabel(race: Race): string {
  const cn = (race.class_name || '').trim();
  const raw = (race.name || '').trim();
  if (!cn) return raw || `Race ${race.id}`;

  const escaped = cn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Strip one or more trailing "(class)" tails (case-insensitive), e.g. "2 (ANC A) (ANC A)" → "2"
  const trailingClass = new RegExp(`(?:\\s*\\(\\s*${escaped}\\s*\\))+\\s*$`, 'i');
  let nameOnly = raw.replace(trailingClass, '').trim();

  if (!nameOnly) {
    const beforeParen = raw.match(/^([^(]*)/);
    const prefix = (beforeParen?.[1] ?? '').trim();
    nameOnly = prefix || `Race ${race.id}`;
  }

  return `${nameOnly} (${cn})`;
}

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
    return Array.from(m.values()).sort(
      (a: any, b: any) => (a.order_index ?? a.id) - (b.order_index ?? b.id)
    );
  }, [races]);

  return (
    <>
      <label className="block mb-2 text-sm font-medium text-gray-700">
        Select a race:
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
        <option value="">-- Select race --</option>

        {uniqueRaces.map((race) => (
          <option key={`race-${race.id}`} value={race.id}>
            {raceSelectLabel(race)}
            {race.discardable === false ? ' — (non-discardable)' : ''}
          </option>
        ))}
      </select>
    </>
  );
}
