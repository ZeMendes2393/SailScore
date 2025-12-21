'use client';
import React from 'react';
import type { FleetSet } from '../../../hooks/useFleets';

type Props = {
  sets: FleetSet[];
  modeCreate: '' | 'qualifying' | 'reshuffle' | 'finals' | 'medal';
  setModeCreate: (m: Props['modeCreate']) => void;
  selectedSetId: number | null;
  setSelectedSetId: (id: number | null) => void;
};

export default function SelectCreateOrExistingBar({
  sets,
  modeCreate,
  setModeCreate,
  selectedSetId,
  setSelectedSetId,
}: Props) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl shadow">

      {/* CREATE PANEL */}
      <div className="flex flex-col w-full sm:w-1/2">
        <span className="text-xs font-medium">Generate New Fleet Set</span>

        <select
          className="border rounded px-3 py-2 text-sm"
          value={modeCreate}
          onChange={(e) => {
            const v = e.target.value as Props['modeCreate'];
            setModeCreate(v);
            if (v !== '') setSelectedSetId(null);
          }}
        >
          <option value="">Create fleet set…</option>
          <option value="qualifying">Generate fleets randomly</option>
          <option value="reshuffle">Generate fleets (results)</option>
          <option value="finals">Generate fleets (Finals)</option>
          <option value="medal">Medal Race</option>
        </select>
      </div>

      {/* EXISTING PANEL */}
      <div className="flex flex-col w-full sm:w-1/2">
        <span className="text-xs font-medium">Select Existing Fleet Set</span>

        <select
          className="border rounded px-3 py-2 text-sm"
          value={selectedSetId ?? ''}
          onChange={(e) => {
            const id = Number(e.target.value);
            setSelectedSetId(id || null);
            if (id) setModeCreate('');
          }}
        >
          <option value="">—</option>

          {sets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label} — {s.phase}
            </option>
          ))}
        </select>
      </div>

    </div>
  );
}
