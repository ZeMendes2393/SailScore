'use client';

import type { FleetSet, Assignment } from '../../hooks/useFleets';

type Props = {
  selectedSet: FleetSet;
  assignments: Assignment[];
};

function parseSailNumber(s: string | null | undefined): number {
  if (!s) return Number.POSITIVE_INFINITY;
  const m = String(s).match(/\d+/);
  return m ? Number(m[0]) : Number.POSITIVE_INFINITY;
}

export default function FleetAssignmentsTable({
  selectedSet,
  assignments,
}: Props) {
  const sorted = [...assignments].sort((a, b) => {
    const na = parseSailNumber(a.sail_number);
    const nb = parseSailNumber(b.sail_number);
    if (na !== nb) return na - nb;
    return (a.helm_name ?? '').localeCompare(b.helm_name ?? '');
  });

  return (
    <div className="space-y-2">
      <h4 className="font-semibold">
        Assignments — {selectedSet.label || '(sem label)'}
      </h4>
      <div className="text-sm text-gray-600">
        Total: {sorted.length}
      </div>
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
            {sorted.map((a, i) => (
              <tr key={`${a.entry_id}-${a.fleet_id}-${i}`}>
                <td className="border px-2 py-1">
                  {selectedSet.fleets.find((f) => f.id === a.fleet_id)?.name ??
                    '-'}
                </td>
                <td className="border px-2 py-1">{i + 1}</td>
                <td className="border px-2 py-1">{a.sail_number ?? ''}</td>
                <td className="border px-2 py-1">{a.boat_name ?? ''}</td>
                <td className="border px-2 py-1">{a.helm_name ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
