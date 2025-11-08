'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

import RaceResultsManager from './components/RaceResultsManager';
import ManageResults from './components/sections/ManageResults';
import SettingsDrawer from './components/settings/SettingsDrawer';

type View = 'existing' | 'draft' | 'add' | 'scoring' | 'manage';

interface Props { regattaId: number; }

export default function AdminResultsClient({ regattaId }: Props) {
  const router = useRouter();
  const search = useSearchParams();

  const [newlyCreatedRace, setNewlyCreatedRace] = useState<{
    id: number; name: string; regatta_id: number; class_name: string;
  } | null>(null);

  const urlView = (search.get('view') as View) || 'existing';
  const [activeView, setActiveView] = useState<View>(urlView);

  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    setActiveView(((search.get('view') as View) || 'existing'));
  }, [search]);

  const setView = (v: View) => {
    const sp = new URLSearchParams(search?.toString() ?? '');
    sp.set('view', v);
    router.replace(`?${sp.toString()}`);
    setActiveView(v);
  };

  const Tab = ({ value, label }: { value: View; label: string }) => (
    <button
      type="button"
      onClick={() => setView(value)}
      className={[
        'px-4 py-2 text-sm font-medium rounded-t-lg border-b-2',
        activeView === value
          ? 'border-blue-600 text-blue-700'
          : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300',
      ].join(' ')}
      aria-selected={activeView === value}
      role="tab"
    >
      {label}
    </button>
  );

  const overallHref = useMemo(
    () => `/admin/manage-regattas/${regattaId}/overall`,
    [regattaId]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Resultados — Admin</h2>
        <div className="flex items-center gap-2">
          <Link
            href={overallHref}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Ver Resultados Gerais (Admin)
          </Link>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded border hover:bg-gray-50"
            title="Abrir definições por classe"
          >
            ⚙️ Settings
          </button>
        </div>
      </div>

      <div role="tablist" aria-label="Sections" className="flex gap-2 border-b">
        <Tab value="existing" label="Resultados" />
        <Tab value="draft" label="Rascunho" />
        <Tab value="add" label="Adicionar 1" />
        <Tab value="scoring" label="Descartes (global)" />
        <Tab value="manage" label="Gerir resultados" />
      </div>

      <div className="pt-4">
        {activeView !== 'manage' && (
          <RaceResultsManager
            regattaId={regattaId}
            newlyCreatedRace={newlyCreatedRace}
            hideInnerTabs
          />
        )}

        {activeView === 'manage' && (
          <ManageResults
            regattaId={regattaId}
            onRaceCreated={(race) => {
              setNewlyCreatedRace(race);
              const sp = new URLSearchParams(search?.toString() ?? '');
              sp.set('view', 'draft');
              router.replace(`?${sp.toString()}`);
              setActiveView('draft');
            }}
          />
        )}
      </div>

      {showSettings && (
        <SettingsDrawer onClose={() => setShowSettings(false)} regattaId={regattaId} />
      )}
    </div>
  );
}
