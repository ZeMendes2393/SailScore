'use client';

import type { FleetSet, Assignment } from '../../hooks/useFleets';
import { SailNumberDisplay } from '@/components/ui/SailNumberDisplay';
import { compareBySailThenCountry } from '@/lib/sailNumberSort';

type Props = {
  selectedSet: FleetSet;
  assignments: Assignment[];
};

export default function FleetAssignmentsTable({
  selectedSet,
  assignments,
}: Props) {
  const fleetOrder = new Map<number, number>(
    selectedSet.fleets.map((f) => [f.id, f.order_index ?? 0])
  );
  const orderOf = (fleetId: number) => fleetOrder.get(fleetId) ?? 9999;

  const sorted = [...assignments].sort((a, b) => {
    const fo = orderOf(a.fleet_id) - orderOf(b.fleet_id);
    if (fo !== 0) return fo;
    return compareBySailThenCountry(a, b);
  });

  return (
    <div className="space-y-2">
      <h4 className="font-semibold">
        Assignments — {selectedSet.label || '(no label)'}
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
                <td className="border px-2 py-1"><SailNumberDisplay countryCode={(a as any).boat_country_code} sailNumber={a.sail_number} /></td>
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
