'use client';

import { useMemo } from 'react';
import type { Race } from '../types';

/** Collapse all whitespace (incl. NBSP) to a single normal space. */
function collapseWs(s: string): string {
  return s.replace(/\s+/gu, ' ').trim();
}

/** One line in the race dropdown: name + class, never duplicating "(class)" from `race.name`. */
function raceSelectLabel(race: Race): string {
  const cn = collapseWs(race.class_name || '');
  const raw = collapseWs(race.name || '');
  if (!cn) return raw || `Race ${race.id}`;

  // Match "(class)" at the end even if inner spacing differs from `class_name` (e.g. "ANC  A")
  const flex = cn
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s+');
  const trailingClass = new RegExp(`(?:\\s*\\(\\s*${flex}\\s*\\))+\\s*$`, 'iu');
  let nameOnly = raw.replace(trailingClass, '').trim();

  if (!nameOnly) {
    const prefix = (raw.match(/^([^(]*)/u)?.[1] ?? '').trim();
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
