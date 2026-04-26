'use client';
import React from 'react';
import type { FleetSet, Assignment, RaceLite } from '../../../hooks/useFleets';
import { SailNumberDisplay } from '@/components/ui/SailNumberDisplay';

type Props = {
  selectedSet: FleetSet;
  classType: string;
  localTitle: string;
  setLocalTitle: (v: string) => void;

  publishSet: (id: number) => Promise<void>;
  unpublishSet: (id: number) => Promise<void>;
  updateSetTitle: (id: number, title: string) => Promise<void>;

  racesInSelectedSet: RaceLite[];
  racesAvailable: RaceLite[];
  updateFleetSetRaces: (id: number, raceIds: number[], force?: boolean) => Promise<void>;

  deleteFleetSet: (setId: number, force?: boolean) => Promise<void>;

  assignments: Assignment[];
};

export default function ExistingFleetSet({
  selectedSet,
  classType,
  localTitle,
  setLocalTitle,
  publishSet,
  unpublishSet,
  updateSetTitle,
  racesInSelectedSet,
  racesAvailable,
  updateFleetSetRaces,
  deleteFleetSet,
  assignments,
}: Props) {
  const missingTitle = !localTitle.trim();
  const isHandicap = classType === 'handicap';
  const displayTitle = selectedSet.public_title?.trim() || localTitle.trim();

  return (
    <div className="mt-4 border rounded-xl p-4 space-y-4 bg-white shadow">
      <h3 className="text-lg font-semibold">
        {displayTitle ? `${displayTitle} (${selectedSet.phase})` : `(${selectedSet.phase})`}
      </h3>

      {/* TITLE + ACTIONS */}
      <div className="space-y-2 border-t pt-3">
        <label className="text-xs font-medium">Public title:</label>

        <input
          type="text"
          className="border rounded px-2 py-1 text-sm w-full"
          value={localTitle}
          onChange={(e) => setLocalTitle(e.target.value)}
        />

        {/* aviso inline (opcional mas recomendado) */}
        {!selectedSet.is_published && missingTitle && (
          <p className="text-xs text-amber-700">
            Set a public title to publish this Fleet Set.
          </p>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          <button
            className="px-3 py-1 text-xs bg-blue-600 text-white rounded"
            onClick={() => updateSetTitle(selectedSet.id, localTitle)}
          >
            Save title
          </button>

          <button
            title={
              !selectedSet.is_published && missingTitle
                ? 'Please set a public title before publishing.'
                : selectedSet.is_published
                ? 'Unpublish this Fleet Set'
                : 'Publish this Fleet Set'
            }
            // só bloqueia quando é "Publicar" e falta o título
            disabled={!selectedSet.is_published && missingTitle}
            className={`px-3 py-1 text-xs rounded-full border transition ${
              !selectedSet.is_published && missingTitle
                ? 'bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed'
                : selectedSet.is_published
                ? 'bg-green-600 text-white border-green-600 hover:bg-green-700'
                : 'bg-white text-gray-700 border-gray-400 hover:bg-gray-50'
            }`}
            onClick={async () => {
              if (!selectedSet.is_published && missingTitle) {
                alert('Please set a public title before publishing.');
                return;
              }

              if (selectedSet.is_published) {
                await unpublishSet(selectedSet.id);
              } else {
                await publishSet(selectedSet.id);
              }
            }}
          >
            {selectedSet.is_published ? 'Unpublish' : 'Publish'}
          </button>

          {/* 🗑 DELETE */}
          <button
            className="px-3 py-1 text-xs rounded border border-red-600 text-red-600 hover:bg-red-50"
            onClick={async () => {
              const ok = window.confirm(
                `Are you sure you want to delete the Fleet Set "${selectedSet.label}"?`
              );
              if (!ok) return;

              try {
                await deleteFleetSet(selectedSet.id);
              } catch (err: any) {
                let detail: any = null;

                // 🔑 tentar extrair detail do erro
                if (typeof err?.message === 'string') {
                  try {
                    detail = JSON.parse(err.message);
                  } catch {
                    /* ignore */
                  }
                }

                if (detail?.code === 'FLEETSET_HAS_RESULTS') {
                  const force = window.confirm(
                    `This Fleet Set has ${detail.result_count} associated results.\n\nForce delete anyway?`
                  );
                  if (force) {
                    await deleteFleetSet(selectedSet.id, true);
                  }
                } else {
                  console.error('Error deleting Fleet Set:', err);
                  alert('Error deleting Fleet Set.');
                }
              }
            }}
          >
            🗑 Delete
          </button>
        </div>

        {selectedSet.published_at && (
          <p className="text-xs text-gray-500">
            Published on:{' '}
            {new Date(selectedSet.published_at).toLocaleString()}
          </p>
        )}
      </div>

      {/* RACES */}
      <div className="space-y-3 border-t pt-3">
        <h4 className="font-semibold">Linked races</h4>

        {racesInSelectedSet.length === 0 ? (
          <div className="text-xs text-gray-500 italic">
            No races linked to this Fleet Set.
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
                    const ok = window.confirm(
                      `Are you sure you want to remove "${r.name}" from this Fleet Set?\n\n` +
                        'This race already may have results associated with this Fleet Set. ' +
                        'Results will remain in the race, but it will no longer be linked here.'
                    );
                    if (!ok) return;
                    const newIds = racesInSelectedSet
                      .filter((x) => x.id !== r.id)
                      .map((x) => x.id);
                    await updateFleetSetRaces(selectedSet.id, newIds, true);
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="space-y-1 text-xs">
          <div className="text-gray-600">Add race:</div>

          <div className="flex gap-2 flex-wrap">
            {racesAvailable.map((r) => (
              <button
                key={r.id}
                className="px-2 py-1 rounded-full border hover:bg-gray-50"
                onClick={async () => {
                  const currentIds = racesInSelectedSet.map((x) => x.id);
                  await updateFleetSetRaces(selectedSet.id, [
                    ...currentIds,
                    r.id,
                  ]);
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
                <th className="border px-2 py-1">Sail</th>
                <th className="border px-2 py-1">Boat</th>
                <th className="border px-2 py-1">{isHandicap ? 'Helm' : 'Crew / Helm'}</th>
              </tr>
            </thead>

            <tbody>
              {assignments.map((a, i) => (
                <tr key={`${a.entry_id}-${a.fleet_id}-${i}`}>
                  <td className="border px-2 py-1">
                    {selectedSet.fleets.find((f) => f.id === a.fleet_id)?.name ??
                      '-'}
                  </td>
                  <td className="border px-2 py-1">
                    <SailNumberDisplay
                      countryCode={a.boat_country_code}
                      sailNumber={a.sail_number}
                    />
                  </td>
                  <td className="border px-2 py-1">{a.boat_name}</td>
                  <td className="border px-2 py-1">
                    {isHandicap
                      ? (a.helm_name ?? '')
                      : (a.crew_names.length > 0 ? a.crew_names.join(', ') : (a.helm_name ?? ''))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
