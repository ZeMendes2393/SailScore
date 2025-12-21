'use client';
import React from 'react';
import type { FleetSet, Assignment, RaceLite } from '../../../hooks/useFleets';

type Props = {
  selectedSet: FleetSet;
  localTitle: string;
  setLocalTitle: (v: string) => void;
  publishSet: (id: number) => Promise<void>;
  unpublishSet: (id: number) => Promise<void>;
  updateSetTitle: (id: number, title: string) => Promise<void>;

  racesInSelectedSet: RaceLite[];
  racesAvailable: RaceLite[];
  updateFleetSetRaces: (id: number, raceIds: number[]) => Promise<void>;

  assignments: Assignment[];
};

export default function ExistingFleetSet({
  selectedSet,
  localTitle,
  setLocalTitle,
  publishSet,
  unpublishSet,
  updateSetTitle,
  racesInSelectedSet,
  racesAvailable,
  updateFleetSetRaces,
  assignments,
}: Props) {
  return (
    <div className="mt-4 border rounded-xl p-4 space-y-4 bg-white shadow">
      <h3 className="text-lg font-semibold">
        {selectedSet.label} ({selectedSet.phase})
      </h3>

      {/* TITLE */}
      <div className="space-y-2 border-t pt-3">
        <label className="text-xs font-medium">Título público:</label>

        <input
          type="text"
          className="border rounded px-2 py-1 text-sm w-full"
          value={localTitle}
          onChange={(e) => setLocalTitle(e.target.value)}
        />

        <button
          className="px-3 py-1 text-xs bg-blue-600 text-white rounded"
          onClick={() => updateSetTitle(selectedSet.id, localTitle)}
        >
          Guardar título
        </button>

        <div className="flex items-center gap-3 mt-2">
          <button
            disabled={!localTitle.trim()}
            className={`px-3 py-1 text-xs rounded-full border transition ${
              !localTitle.trim()
                ? 'bg-gray-200 text-gray-400 border-gray-300 cursor-default'
                : selectedSet.is_published
                ? 'bg-green-600 text-white border-green-600 hover:bg-green-700'
                : 'bg-white text-gray-700 border-gray-400 hover:bg-gray-50'
            }`}
            onClick={() =>
              selectedSet.is_published
                ? unpublishSet(selectedSet.id)
                : publishSet(selectedSet.id)
            }
          >
            {selectedSet.is_published ? 'Despublicar' : 'Publicar'}
          </button>

          {!localTitle.trim() && (
            <span className="text-[11px] text-red-600">
              ⚠️ First set a title before publishing.
            </span>
          )}
        </div>

        {selectedSet.published_at && (
          <p className="text-xs text-gray-500">
            Publicado em: {new Date(selectedSet.published_at).toLocaleString()}
          </p>
        )}
      </div>

      {/* RACES */}
      <div className="space-y-3 border-t pt-3">
        <h4 className="font-semibold">Races ligadas</h4>

        {racesInSelectedSet.length === 0 ? (
          <div className="text-xs text-gray-500 italic">
            Nenhuma corrida ligada a este FleetSet.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {racesInSelectedSet.map((r) => (
              <span
                key={r.id}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs bg-white"
              >
                {r.name}
                <button
                  className="ml-1 text-red-600 hover:text-red-800"
                  onClick={async () => {
                    const newIds = racesInSelectedSet
                      .filter((x) => x.id !== r.id)
                      .map((x) => x.id);
                    await updateFleetSetRaces(selectedSet.id, newIds);
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="space-y-1 text-xs">
          <div className="text-gray-600">Adicionar race:</div>

          <div className="flex gap-2 flex-wrap">
            {racesAvailable.map((r) => (
              <button
                key={r.id}
                className="px-2 py-1 rounded-full border hover:bg-gray-50"
                onClick={async () => {
                  const currentIds = racesInSelectedSet.map((x) => x.id);
                  await updateFleetSetRaces(selectedSet.id, [...currentIds, r.id]);
                }}
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ASSIGNMENTS */}
      <div className="space-y-2 border-t pt-4">
        <h4 className="font-semibold">Assignments</h4>

        <div className="overflow-x-auto">
          <table className="table-auto w-full border">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-2 py-1">Fleet</th>
                <th className="border px-2 py-1">#</th>
                <th className="border px-2 py-1">Sail</th>
                <th className="border px-2 py-1">Boat</th>
                <th className="border px-2 py-1">Helm</th>
              </tr>
            </thead>

            <tbody>
              {assignments.map((a, i) => (
                <tr key={`${a.entry_id}-${a.fleet_id}-${i}`}>
                  <td className="border px-2 py-1">
                    {selectedSet.fleets.find((f) => f.id === a.fleet_id)?.name ?? '-'}
                  </td>
                  <td className="border px-2 py-1">{i + 1}</td>
                  <td className="border px-2 py-1">{a.sail_number}</td>
                  <td className="border px-2 py-1">{a.boat_name}</td>
                  <td className="border px-2 py-1">{a.helm_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
