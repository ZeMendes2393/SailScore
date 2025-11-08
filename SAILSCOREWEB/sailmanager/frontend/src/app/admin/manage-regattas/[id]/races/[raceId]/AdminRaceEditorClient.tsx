'use client';

import Link from 'next/link';
import RaceResultsManager from '../../results/components/RaceResultsManager';

export default function AdminRaceEditorClient({
  regattaId,
  raceId,
}: {
  regattaId: number;
  raceId: number;
}) {
  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Editar Corrida</h2>
        <Link
          href={`/admin/manage-regattas/${regattaId}/overall`}
          className="text-sm underline underline-offset-2"
        >
          ← Voltar ao Overall
        </Link>
      </div>

      {/* Reutiliza o teu manager, já com a corrida selecionada e tabs internas visíveis */}
      <RaceResultsManager
        regattaId={regattaId}
        newlyCreatedRace={null}
        hideInnerTabs={false}
        initialRaceId={raceId}  // 👈 precisa da prop no componente
      />
    </div>
  );
}
