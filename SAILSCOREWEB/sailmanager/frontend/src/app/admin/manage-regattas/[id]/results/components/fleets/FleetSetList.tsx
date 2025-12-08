'use client';

import type { FleetSet } from '../../hooks/useFleets';

type Props = {
  sets: FleetSet[];
  selectedSetId: number | null;
  loading: boolean;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void | Promise<void>;
};

export default function FleetSetList({
  sets,
  selectedSetId,
  loading,
  onSelect,
  onDelete,
}: Props) {
  if (loading) {
    return (
      <div className="space-y-2">
        <h4 className="font-semibold">Fleet Sets</h4>
        <div>A carregar…</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="font-semibold">Fleet Sets</h4>
      <div className="grid sm:grid-cols-2 gap-3">
        {sets.map((s) => (
          <div
            key={s.id}
            className={`border rounded-xl p-3 hover:bg-gray-50 relative ${
              selectedSetId === s.id ? 'border-blue-600' : ''
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(s.id)}
              className="block w-full text-left"
            >
              <div className="text-sm text-gray-500">
                {s.phase.toUpperCase()}
              </div>
              <div className="font-semibold">{s.label || '(sem label)'}</div>
              <div className="text-sm">
                Fleets: {s.fleets.map((f) => f.name).join(', ')}
              </div>
              {(s.race_names?.length ?? 0) > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  Races: {s.race_names!.join(', ')}
                </div>
              )}
            </button>

            <button
              type="button"
              onClick={async (e) => {
                e.stopPropagation();
                await onDelete(s.id);
              }}
              className="absolute top-2 right-2 text-xs text-red-600 hover:text-red-700"
            >
              🗑
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
