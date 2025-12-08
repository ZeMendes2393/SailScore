'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { useAuth } from '@/context/AuthContext';
import { useResults } from '../hooks/useResults';

import ScoringPanel from './ScoringPanel';
import RaceSelector from './RaceSelector';
import ExistingResultsTable from './ExistingResultsTable';
import AddSingleForm from './AddSingleForm';
import DraftResultsEditor from './DraftResultsEditor';

type View = 'existing' | 'draft' | 'add' | 'scoring';

interface Props {
  regattaId: number;
  newlyCreatedRace?: any | null;
  hideInnerTabs?: boolean;
  initialRaceId?: number;
}

// ordem desejada das fleets (qualifying + finals)
const FLEET_ORDER: Record<string, number> = {
  // qualifying
  Yellow: 10,
  Blue: 20,
  Red: 30,
  Green: 40,
  // finals
  Gold: 110,
  Silver: 120,
  Bronze: 130,
  Emerald: 140,
};

export default function RaceResultsManager({
  regattaId,
  newlyCreatedRace,
  hideInnerTabs = false,
  initialRaceId,
}: Props) {
  const { token } = useAuth();

  const {
    scoring,
    setScoring,
    savingScoring,
    saveScoring,
    races,
    selectedRaceId,
    setSelectedRaceId,
    selectedClass,
    existingResults,
    loadingExisting,
    availableEntries,
    draft,
    draftInput,
    setDraftInput,
    singleSail,
    setSingleSail,
    singlePos,
    setSinglePos,
    addDraftBySail,
    addDraftEntry,
    removeDraft,
    moveDraft,
    saveBulk,
    moveRow,
    savePosition,
    saveOrder,
    addSingle,
    deleteResult,
    scoringCodes,
    onSetDraftCode,
    onSetDraftPos,
    markCode,
    renameRace,
    deleteRace,
    reorderRaces,
    refreshRaces,

    // dados de fleets vindos do hook
    currentRace,
    fleetsForRace,
    selectedFleetId,
    setSelectedFleetId, // tipo: React.Dispatch<SetStateAction<number | "all">>
  } = useResults(regattaId, token ?? undefined, newlyCreatedRace ?? null);

  const search = useSearchParams();
  const router = useRouter();
  const [view, setView] = useState<View>('existing');

  // Atualiza view e pré-seleciona corrida se ?race= existir
  useEffect(() => {
    const v = (search.get('view') as View) || 'existing';
    setView(v);

    const raceParam = search.get('race');
    if (raceParam) {
      const id = Number(raceParam);
      if (!Number.isNaN(id)) setSelectedRaceId(id);
    }
  }, [search, setSelectedRaceId]);

  // selecionar corrida inicial passada por prop
  useEffect(() => {
    if (!initialRaceId) return;
    if (selectedRaceId !== initialRaceId) {
      const exists = (races ?? []).some((r) => r.id === initialRaceId);
      if (exists) setSelectedRaceId(initialRaceId);
    }
  }, [initialRaceId, races, selectedRaceId, setSelectedRaceId]);

  const setViewAndUrl = (v: View) => {
    setView(v);
    const sp = new URLSearchParams(search?.toString());
    sp.set('view', v);
    router.replace(`?${sp.toString()}`);
  };

  const handleSelectRace = (raceId: number | null) => {
    setSelectedRaceId(raceId);

    const sp = new URLSearchParams(search?.toString());
    if (raceId) sp.set('race', String(raceId));
    else sp.delete('race');
    router.replace(`?${sp.toString()}`);

    // ao mudar de corrida, limpa fleet (vai ficar "all")
    setSelectedFleetId('all');
  };

  const tabs = useMemo(
    () => [
      { key: 'existing' as View, label: 'Resultados', badge: (existingResults ?? []).length },
      { key: 'draft' as View, label: 'Rascunho', badge: (draft ?? []).length },
      { key: 'add' as View, label: 'Adicionar 1' },
      { key: 'scoring' as View, label: 'Descartes' },
    ],
    [existingResults, draft]
  );

  const orderedRaces = useMemo(() => {
    return (races ?? [])
      .slice()
      .sort((a: any, b: any) => (a.order_index ?? a.id) - (b.order_index ?? b.id));
  }, [races]);

  // fleets ordenadas pelo nome “oficial” (Yellow, Blue, ..., Gold, Silver, Bronze, Emerald)
  const orderedFleets = useMemo(() => {
    return (fleetsForRace ?? [])
      .slice()
      .sort((a: any, b: any) => {
        const wa = FLEET_ORDER[a.name] ?? 9999;
        const wb = FLEET_ORDER[b.name] ?? 9999;
        if (wa !== wb) return wa - wb;
        return a.id - b.id;
      });
  }, [fleetsForRace]);

  const hasFleets =
    !!currentRace?.fleet_set_id && (orderedFleets ?? []).length > 0;

  // --------- PRÉ-SELECIONAR PRIMEIRA FLEET QUANDO EXISTEM ----------
  useEffect(() => {
    if (!selectedRaceId) {
      // sem corrida selecionada, fica em "all"
      if (selectedFleetId !== 'all') {
        setSelectedFleetId('all');
      }
      return;
    }

    const list = orderedFleets;

    if (list.length === 0) {
      // corrida sem fleets → também "all"
      if (selectedFleetId !== 'all') {
        setSelectedFleetId('all');
      }
      return;
    }

    // se fleet atual não existe nesta race ou está em "all", escolhe a primeira
    const existsCurrent =
      selectedFleetId !== 'all' &&
      list.some((f: any) => f.id === selectedFleetId);

    if (!existsCurrent) {
      setSelectedFleetId(list[0].id);
    }
  }, [selectedRaceId, orderedFleets, selectedFleetId, setSelectedFleetId]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toolbar sticky com seletor, fleets e tabs */}
      <div className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="w-full px-6">
          <div className="py-3 flex flex-col gap-3">
            <div className="flex flex-col gap-1 lg:flex-row lg:items-end lg:justify-between">
              {/* Lado esquerdo: título + info + chips de fleets */}
              <div>
                <h1 className="text-xl font-bold">Resultados</h1>
                <p className="text-xs text-gray-600">
                  {selectedRaceId
                    ? `Corrida selecionada ${
                        selectedClass ? `— ${selectedClass}` : ''
                      }`
                    : 'Escolhe uma corrida para começar.'}
                </p>

                {/* Info de FleetSet + botões de fleets */}
                {hasFleets && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] uppercase tracking-wide text-gray-500">
                      Fleets:
                    </span>
                    {orderedFleets.map((f: any) => (
                      <button
                        key={f.id}
                        type="button"
                        className={[
                          'px-2 py-0.5 rounded-full border text-xs',
                          selectedFleetId === f.id
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 hover:bg-gray-50',
                        ].join(' ')}
                        onClick={() => setSelectedFleetId(f.id)}
                      >
                        {f.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Lado direito: RaceSelector + botão Delete race */}
              <div className="flex items-center gap-2 lg:min-w-[420px] lg:justify-end">
                <div className="min-w-[260px] lg:min-w-[320px]">
                  <RaceSelector
                    races={orderedRaces}
                    selectedRaceId={selectedRaceId}
                    onSelect={handleSelectRace}
                  />
                </div>

                {selectedRaceId && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!selectedRaceId) return;
                      if (
                        !confirm(
                          'Tens a certeza que queres eliminar esta corrida (e todos os seus resultados)?'
                        )
                      ) {
                        return;
                      }
                      await deleteRace(selectedRaceId);
                    }}
                    className="px-3 py-2 rounded border border-red-500 text-red-600 hover:bg-red-50 text-xs lg:text-sm"
                  >
                    Delete race
                  </button>
                )}
              </div>
            </div>

            {!hideInnerTabs && (
              <nav
                role="tablist"
                aria-label="Secções de resultados"
                className="flex gap-2 overflow-x-auto pb-1"
              >
                {tabs.map((t) => {
                  const active = view === t.key;
                  const disabled = !selectedRaceId;
                  return (
                    <button
                      key={t.key}
                      role="tab"
                      aria-selected={active}
                      onClick={() => setViewAndUrl(t.key)}
                      disabled={disabled}
                      className={[
                        'px-3 py-1.5 rounded-full border text-sm transition',
                        active
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 hover:bg-gray-50',
                        disabled ? 'opacity-50 cursor-not-allowed' : '',
                      ].join(' ')}
                    >
                      <span>{t.label}</span>
                      {typeof t.badge === 'number' && (
                        <span
                          className={[
                            'ml-2 inline-flex items-center justify-center min-w-5 px-1 rounded-full text-[10px]',
                            active
                              ? 'bg-white/20 text-white'
                              : 'bg-gray-200 text-gray-700',
                          ].join(' ')}
                        >
                          {t.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            )}
          </div>
        </div>
      </div>

      {/* Painel principal */}
      <div className="w-full px-6 py-4">
        {!selectedRaceId ? (
          <div className="p-6 border rounded-2xl bg-white text-gray-600">
            Seleciona uma corrida no topo.
          </div>
        ) : (
          <>
            {view === 'existing' && (
              <section className="p-4 border rounded-2xl bg-white shadow-sm">
                <header className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">
                    Resultados existentes{' '}
                    {selectedClass ? (
                      <span className="text-gray-500">— {selectedClass}</span>
                    ) : null}
                  </h2>
                  <span className="text-xs text-gray-500">
                    {loadingExisting
                      ? 'A carregar…'
                      : `${(existingResults ?? []).length} linhas`}
                  </span>
                </header>
                <div className="max-h-[66vh] overflow-auto rounded border">
                  <ExistingResultsTable
                    results={existingResults ?? []} // já filtrados por fleet no hook
                    loading={!!loadingExisting}
                    onMove={moveRow}
                    onEditPos={savePosition}
                    onSaveOrder={saveOrder}
                    onDelete={deleteResult}
                    scoringCodes={scoringCodes ?? {}}
                    onMarkCode={markCode}
                  />
                </div>
              </section>
            )}

            {view === 'draft' && (
              <section className="p-4 border rounded-2xl bg-white shadow-sm">
                <header className="mb-3">
                  <h2 className="text-lg font-semibold">
                    Rascunho &amp; Inscritos
                  </h2>
                  <p className="text-xs text-gray-500">
                    Adiciona por nº de vela ou a partir da lista filtrável.
                    {hasFleets &&
                      ' (lista já filtrada pela fleet selecionada)'}
                  </p>
                </header>
                <div className="max-h-[66vh] overflow-auto">
                  <DraftResultsEditor
                    draft={draft ?? []}
                    entries={(availableEntries ?? []).concat()}
                    available={availableEntries ?? []} // filtrados por fleet
                    draftInput={draftInput}
                    setDraftInput={setDraftInput}
                    onAddBySail={addDraftBySail}
                    onAddEntry={addDraftEntry}
                    onMove={moveDraft}
                    onRemove={removeDraft}
                    onSaveBulk={saveBulk}
                    scoringCodes={scoringCodes ?? {}}
                    onSetDraftCode={onSetDraftCode}
                    onSetDraftPos={onSetDraftPos}
                  />
                </div>
              </section>
            )}

            {view === 'add' && (
              <section className="p-4 border rounded-2xl bg-white shadow-sm">
                <h2 className="text-lg font-semibold mb-3">
                  Adicionar resultado em falta
                </h2>
                <AddSingleForm
                  singleSail={singleSail}
                  setSingleSail={setSingleSail}
                  singlePos={singlePos}
                  setSinglePos={setSinglePos}
                  onAdd={addSingle}
                />
              </section>
            )}

            {view === 'scoring' && (
              <section className="p-4 border rounded-2xl bg-white shadow-sm max-w-2xl">
                <h2 className="text-lg font-semibold mb-3">
                  Configuração de Descartes
                </h2>
                <ScoringPanel
                  scoring={scoring}
                  onChange={setScoring}
                  onSave={saveScoring}
                  saving={savingScoring}
                />
                <p className="text-xs text-gray-500">
                  O <strong>Net</strong> na classificação geral usa estes
                  valores.
                </p>
              </section>
            )}
          </>
        )}
      </div>

      {/* Action bar flutuante */}
      {selectedRaceId && view !== 'existing' && (draft ?? []).length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-30">
          <div className="w-full px-6">
            <div className="flex items-center gap-3 rounded-2xl border bg-white shadow-lg p-3">
              <span className="text-sm text-gray-700">
                {(draft ?? []).length} no rascunho — confirma para guardar em
                massa.
              </span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={saveBulk}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl"
                >
                  Guardar em massa
                </button>
                <button
                  onClick={() =>
                    (draft ?? []).forEach((d) => removeDraft(d.entryId))
                  }
                  className="px-3 py-2 rounded-xl border hover:bg-gray-50"
                  title="Limpar rascunho"
                >
                  Limpar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
