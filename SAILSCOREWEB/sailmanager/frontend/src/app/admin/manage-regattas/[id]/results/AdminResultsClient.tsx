'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

import RaceCreator from './components/RaceCreator';
import RaceResultsManager from './components/RaceResultsManager';

type Section = 'create' | 'edit' | 'fill';

interface Props {
  regattaId: number;
}

export default function AdminResultsClient({ regattaId }: Props) {
  const [newlyCreatedRace, setNewlyCreatedRace] = useState<{
    id: number;
    name: string;
    regatta_id: number;
    class_name: string;
  } | null>(null);

  const search = useSearchParams();
  const router = useRouter();

  const [section, setSection] = useState<Section>('edit');

  useEffect(() => {
    const v = search.get('view');
    if (v === 'draft') setSection('fill');
    else if (v === 'existing' || v === 'add' || v === 'scoring') setSection('edit');
  }, [search]);

  const go = (next: Section) => {
    setSection(next);
    const sp = new URLSearchParams(search?.toString());
    if (next === 'fill') sp.set('view', 'draft');
    else if (next === 'edit') sp.set('view', 'existing');
    else if (next === 'create') sp.delete('view');
    router.replace(`?${sp.toString()}`);
  };

  const NavItem = ({
    label,
    active,
    onClick,
    badge,
  }: {
    label: string;
    active: boolean;
    onClick: () => void;
    badge?: number;
  }) => (
    <button
      onClick={onClick}
      className={[
        'w-full text-left px-3 py-2 rounded-lg border transition',
        active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-50',
      ].join(' ')}
      aria-current={active ? 'page' : undefined}
    >
      <span className="inline-flex items-center gap-2">
        {label}
        {typeof badge === 'number' && (
          <span
            className={[
              'text-[10px] px-1 rounded-full',
              active ? 'bg-white/20' : 'bg-gray-200 text-gray-700',
            ].join(' ')}
          >
            {badge}
          </span>
        )}
      </span>
    </button>
  );

  return (
    <div className="w-full px-6 py-4">
      <div className="grid grid-cols-12 gap-4">
        {/* SIDEBAR ESQUERDA */}
        <aside className="col-span-12 md:col-span-4 xl:col-span-3">
          <div className="sticky top-24 space-y-3">
            <h3 className="text-sm font-semibold text-gray-600">Ações</h3>

            {/* se preferires o texto "Criar corrida", muda o label abaixo */}
            <NavItem
              label="Criar regata"
              active={section === 'create'}
              onClick={() => go('create')}
            />

            <NavItem
              label="Editar resultados"
              active={section === 'edit'}
              onClick={() => go('edit')}
            />

            <NavItem
              label="Preencher resultados"
              active={section === 'fill'}
              onClick={() => go('fill')}
            />

            <div className="pt-2">
              <Link
                href={`/regattas/${regattaId}/overall`}
                className="inline-block w-full text-center bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
              >
                Ver Resultados Gerais 🏆
              </Link>
            </div>
          </div>
        </aside>

        {/* PAINEL PRINCIPAL */}
        <main className="col-span-12 md:col-span-8 xl:col-span-9 space-y-4">
          {section === 'create' && (
            <div className="p-4 border rounded-2xl bg-white shadow-sm max-w-2xl">
              <h4 className="text-lg font-semibold mb-3">Criar Corrida</h4>
              <RaceCreator
                regattaId={regattaId}
                onRaceCreated={(race) => setNewlyCreatedRace(race)}
              />
              <p className="text-xs text-gray-500">
                Dica: podes criar várias corridas seguidas mantendo a mesma classe.
              </p>
            </div>
          )}

          {(section === 'edit' || section === 'fill') && (
            <RaceResultsManager regattaId={regattaId} newlyCreatedRace={newlyCreatedRace} />
          )}
        </main>
      </div>
    </div>
  );
}
