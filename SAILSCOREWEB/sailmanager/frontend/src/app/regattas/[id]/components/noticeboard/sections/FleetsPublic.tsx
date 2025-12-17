'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';

type PublishedBoat = {
  sail_number: string | null;
  boat_name: string | null;
  helm_name: string | null;
};

type PublishedFleet = {
  id: number;
  name: string; // ex.: Yellow, Blue, Gold, Silver…
  order_index: number;
  boats: PublishedBoat[];
};

type PublishedFleetSet = {
  id: number;
  title: string;         // ex.: "Fleets Day 2"
  phase: 'qualifying' | 'finals';
  created_at: string;
  fleets: PublishedFleet[];
};

type Props = {
  regattaId: number;
};

export default function FleetsPublic({ regattaId }: Props) {
  const [sets, setSets] = useState<PublishedFleetSet[]>([]);
  const [selectedSetId, setSelectedSetId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!regattaId || Number.isNaN(regattaId)) return;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        // ⚠️ Ajustar este endpoint quando o backend estiver pronto
        const data = await apiGet<PublishedFleetSet[]>(
          `/public/regattas/${regattaId}/fleets`
        );
        const list = data || [];
        // ordenar por data mais recente primeiro
        list.sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
        );
        setSets(list);
        if (list.length > 0) {
          setSelectedSetId(list[0].id);
        }
      } catch (e: any) {
        console.error('Erro a carregar fleets public:', e);
        setError(
          e?.message || 'Não foi possível carregar as fleets publicadas.'
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [regattaId]);

  if (loading && sets.length === 0) {
    return <p className="text-sm text-gray-600">A carregar fleets…</p>;
  }

  if (error && sets.length === 0) {
    return (
      <p className="text-sm text-red-600">
        {error}
      </p>
    );
  }

  if (sets.length === 0) {
    return (
      <p className="text-sm text-gray-600">
        Ainda não existem fleets publicadas para esta regata.
      </p>
    );
  }

  const current = sets.find((s) => s.id === selectedSetId) ?? sets[0];

  return (
    <div className="space-y-4">
      {/* selector do “título” das fleets (Day 1, Day 2, Finals, etc.) */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-700">
          Published fleets:
        </span>
        <select
          className="border rounded px-3 py-1 text-sm"
          value={current.id}
          onChange={(e) => setSelectedSetId(Number(e.target.value))}
        >
          {sets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title} — {s.phase === 'qualifying' ? 'Qualifying' : 'Finals'}
            </option>
          ))}
        </select>
        <span className="text-xs text-gray-500">
          Published at {new Date(current.created_at).toLocaleString()}
        </span>
      </div>

      {/* lista de fleets dentro desse “título” */}
      <div className="grid gap-4 md:grid-cols-2">
        {current.fleets
          .slice()
          .sort((a, b) => a.order_index - b.order_index)
          .map((fleet) => (
            <div
              key={fleet.id}
              className="border rounded-2xl p-3 bg-white shadow-sm"
            >
              <div className="flex items-baseline justify-between mb-2">
                <h3 className="font-semibold text-sm">
                  Fleet {fleet.name}
                </h3>
                <span className="text-xs text-gray-500">
                  {fleet.boats.length} boats
                </span>
              </div>
              {fleet.boats.length === 0 ? (
                <p className="text-xs text-gray-500">
                  (Nenhuma embarcação nesta fleet.)
                </p>
              ) : (
                <table className="w-full text-xs border border-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border px-2 py-1 text-left">Sail</th>
                      <th className="border px-2 py-1 text-left">Boat</th>
                      <th className="border px-2 py-1 text-left">Helm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fleet.boats.map((b, i) => (
                      <tr key={`${fleet.id}-${i}`}>
                        <td className="border px-2 py-1">
                          {b.sail_number ?? ''}
                        </td>
                        <td className="border px-2 py-1">
                          {b.boat_name ?? ''}
                        </td>
                        <td className="border px-2 py-1">
                          {b.helm_name ?? ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
