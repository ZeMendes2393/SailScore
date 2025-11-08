// src/app/admin/manage-regattas/[id]/results/components/sections/ManageResults.tsx
'use client';

import { useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useResults } from '../../hooks/useResults';
import RaceCreator from '../RaceCreator';
import type { Race } from '../../types';

interface Props {
  regattaId: number;
  onRaceCreated?: (race: Race) => void;
}

export default function ManageResults({ regattaId, onRaceCreated }: Props) {
  const { token } = useAuth();

  const {
    races,
    reorderRaces,
    renameRace,
    deleteRace,
  } = useResults(regattaId, token ?? undefined, null);

  // ordenar lista (order_index -> id) para mostrar
  const orderedRaces = useMemo(() => {
    return (races ?? [])
      .slice()
      .sort((a: any, b: any) => (a.order_index ?? a.id) - (b.order_index ?? b.id));
  }, [races]);

  // --- NOVO: reordenar apenas dentro da mesma classe do alvo ---
  const moveRaceUp = async (raceId: number) => {
    const all = orderedRaces ?? [];
    const target = all.find(r => r.id === raceId);
    if (!target) return;

    const group = all.filter(r => (r as any).class_name === (target as any).class_name);
    const ids = group.map(r => r.id);

    const i = ids.indexOf(raceId);
    if (i <= 0) return;

    [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
    await reorderRaces(ids); // envia só os IDs desta classe
  };

  const moveRaceDown = async (raceId: number) => {
    const all = orderedRaces ?? [];
    const target = all.find(r => r.id === raceId);
    if (!target) return;

    const group = all.filter(r => (r as any).class_name === (target as any).class_name);
    const ids = group.map(r => r.id);

    const i = ids.indexOf(raceId);
    if (i < 0 || i >= ids.length - 1) return;

    [ids[i], ids[i + 1]] = [ids[i + 1], ids[i]];
    await reorderRaces(ids); // envia só os IDs desta classe
  };
  // --- FIM NOVO ---

  const promptRename = async (race: Race) => {
    const base = race.name.replace(` (${(race as any).class_name})`, '');
    const name = prompt('Novo nome da corrida:', base);
    if (name && name.trim()) await renameRace(race.id, name.trim());
  };

  const confirmDelete = async (race: Race) => {
    if (confirm(`Eliminar a corrida "${race.name}"? (resultados desta corrida serão apagados)`)) {
      await deleteRace(race.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Criar Corrida */}
      <div className="p-4 border rounded-2xl bg-white shadow-sm max-w-2xl">
        <h4 className="text-lg font-semibold mb-3">Criar Corrida</h4>
        <RaceCreator
          regattaId={regattaId}
          defaultOpen={true}
          onRaceCreated={(race) => onRaceCreated?.(race as any)}
        />
        <p className="text-xs text-gray-500 mt-2">
          Dica: podes criar várias corridas seguidas mantendo a mesma classe.
        </p>
      </div>

      {/* Gerir corridas existentes */}
      <div className="p-4 border rounded-2xl bg-white shadow-sm">
        <h4 className="text-md font-semibold mb-3">Corridas da regata</h4>
        {orderedRaces.length === 0 ? (
          <p className="text-sm text-gray-500">Ainda não existem corridas.</p>
        ) : (
          <ul className="max-h-72 overflow-auto divide-y">
            {orderedRaces.map((r) => (
              <li key={`mgr-${r.id}`} className="py-2 flex items-center gap-2">
                <span className="flex-1 truncate">
                  {r.name} <span className="text-gray-500">({(r as any).class_name})</span>
                </span>
                <button
                  className="px-2 py-1 rounded border hover:bg-gray-50"
                  title="Subir"
                  onClick={() => moveRaceUp(r.id)}
                >↑</button>
                <button
                  className="px-2 py-1 rounded border hover:bg-gray-50"
                  title="Descer"
                  onClick={() => moveRaceDown(r.id)}
                >↓</button>
                <button
                  className="px-2 py-1 rounded border hover:bg-gray-50"
                  title="Renomear"
                  onClick={() => promptRename(r as any)}
                >Renomear</button>
                <button
                  className="px-2 py-1 rounded border hover:bg-red-50 text-red-600"
                  title="Eliminar"
                  onClick={() => confirmDelete(r as any)}
                >🗑</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
