'use client';

import { useMemo } from 'react';
import type { FleetSet, RaceLite } from '../../hooks/useFleets';

type Props = {
  selectedSet: FleetSet;
  races: RaceLite[]; // todas as races desta classe
  onUpdateRaces: (raceIds: number[]) => Promise<void>;
};

export default function FleetSetRacesEditor({
  selectedSet,
  races,
  onUpdateRaces,
}: Props) {
  // races atualmente ligadas a este set
  const current = useMemo(
    () => races.filter((r) => r.fleet_set_id === selectedSet.id),
    [races, selectedSet.id]
  );

  // races livres (sem fleet_set) desta classe
  const available = useMemo(
    () => races.filter((r) => !r.fleet_set_id),
    [races]
  );

  const currentIds = current.map((r) => r.id);

  const handleRemove = async (raceId: number) => {
    const ok = window.confirm(
      'Esta race pode já ter resultados associados a este grupo.\n' +
        'Se a remover do Fleet Set, os resultados mantêm-se na corrida, mas deixam de estar agrupados aqui.\n\n' +
        'Queres mesmo remover esta race deste Fleet Set?'
    );
    if (!ok) return;

    const newIds = currentIds.filter((id) => id !== raceId);
    await onUpdateRaces(newIds);
  };

  const handleAdd = async (raceId: number) => {
    const newIds = [...currentIds, raceId];
    await onUpdateRaces(newIds);
  };

  return (
    <div className="mb-2 rounded-xl border p-3 bg-gray-50">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {/* Races ligadas */}
        <div>
          <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Races in this Fleet Set
          </div>
          {current.length === 0 ? (
            <div className="text-xs text-gray-500 mt-1">
              No races linked yet.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 mt-1">
              {current.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleRemove(r.id)}
                  className="px-2 py-1 rounded-full border text-xs bg-white hover:bg-red-50 hover:border-red-400 flex items-center gap-1"
                  title="Remove race from this Fleet Set"
                >
                  <span>{r.name}</span>
                  <span className="text-[10px] text-red-500">×</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Adicionar novas races livres */}
        <div className="sm:text-right">
          <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Add race
          </div>
          {available.length === 0 ? (
            <div className="text-xs text-gray-400 mt-1">
              No more races available to add.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 mt-1 justify-start sm:justify-end">
              {available.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleAdd(r.id)}
                  className="px-2 py-1 rounded-full border text-xs bg-white hover:bg-emerald-50 hover:border-emerald-500"
                  title="Add race to this Fleet Set"
                >
                  {r.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
