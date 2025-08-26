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

import type { Race } from '../types';

type View = 'existing' | 'draft' | 'add' | 'scoring';

interface Props {
  regattaId: number;
  newlyCreatedRace?: Race | null;
}

export default function RaceResultsManager({ regattaId, newlyCreatedRace }: Props) {
  const { token } = useAuth();

  const {
    scoring, setScoring, savingScoring, saveScoring,
    races, selectedRaceId, setSelectedRaceId, selectedClass,
    existingResults, loadingExisting,
    availableEntries, draft, draftInput, setDraftInput,
    singleSail, setSingleSail, singlePos, setSinglePos,
    addDraftBySail, addDraftEntry, removeDraft, moveDraft, saveBulk,
    moveRow, savePosition, saveOrder, addSingle, deleteResult,
    scoringCodes, onSetDraftCode, onSetDraftPos, markCode,
    renameRace, deleteRace, reorderRaces,
  } = useResults(regattaId, token ?? undefined, newlyCreatedRace ?? null);

  const search = useSearchParams();
  const router = useRouter();
  const [view, setView] = useState<View>('existing');

  useEffect(() => {
    const v = (search.get('view') as View) || 'existing';
    setView(v);
  }, [search]);

  const setViewAndUrl = (v: View) => {
    setView(v);
    const sp = new URLSearchParams(search?.toString());
    sp.set('view', v);
    router.replace(`?${sp.toString()}`);
  };

  const tabs = useMemo(
    () => ([
      { key: 'existing' as View, label: 'Resultados', badge: (existingResults ?? []).length },
      { key: 'draft'    as View, label: 'Rascunho',   badge: (draft ?? []).length },
      { key: 'add'      as View, label: 'Adicionar 1' },
      { key: 'scoring'  as View, label: 'Descartes' },
    ]),
    [existingResults, draft]
  );

  // helpers de ordem para UI
  const orderedRaces = useMemo(() => {
    return (races ?? []).slice().sort((a: any, b: any) =>
      (a.order_index ?? a.id) - (b.order_index ?? b.id)
    );
  }, [races]);

  const moveRaceUp = async (raceId: number) => {
    const ids = orderedRaces.map(r => r.id);
    const i = ids.indexOf(raceId);
    if (i <= 0) return;
    [ids[i-1], ids[i]] = [ids[i], ids[i-1]];
    await reorderRaces(ids);
  };

  const moveRaceDown = async (raceId: number) => {
    const ids = orderedRaces.map(r => r.id);
    const i = ids.indexOf(raceId);
    if (i < 0 || i >= ids.length - 1) return;
    [ids[i], ids[i+1]] = [ids[i+1], ids[i]];
    await reorderRaces(ids);
  };

  const promptRename = async (race: Race) => {
    const base = race.name.replace(` (${race.class_name})`, '');
    const name = prompt('Novo nome da corrida:', base);
    if (name && name.trim()) {
      await renameRace(race.id, name.trim());
    }
  };

  const confirmDelete = async (race: Race) => {
    if (confirm(`Eliminar a corrida "${race.name}"? (resultados desta corrida serão apagados)`)) {
      await deleteRace(race.id);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toolbar sticky com seletor e tabs */}
      <div className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="w-full px-6">
          <div className="py-3 flex flex-col gap-3">
            <div className="flex flex-col gap-1 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-xl font-bold">Gerir Resultados</h1>
                <p className="text-xs text-gray-600">
                  {selectedRaceId
                    ? `Corrida selecionada ${selectedClass ? `— ${selectedClass}` : ''}`
                    : 'Escolhe uma corrida para começar.'}
                </p>
              </div>
              <div className="lg:min-w-[420px]">
                <RaceSelector
                  races={orderedRaces}
                  selectedRaceId={selectedRaceId}
                  onSelect={setSelectedRaceId}
                />
              </div>
            </div>

            {/* Secção de gestão das corridas */}
            <div className="rounded-lg border bg-white p-2">
              <h4 className="text-sm font-semibold mb-2">Gerir corridas</h4>
              <ul className="max-h-52 overflow-auto divide-y">
                {orderedRaces.map((r) => (
                  <li key={`mgr-${r.id}`} className="py-2 flex items-center gap-2">
                    <span className="flex-1 truncate">
                      {r.name} <span className="text-gray-500">({r.class_name})</span>
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
                      onClick={() => promptRename(r)}
                    >Renomear</button>
                    <button
                      className="px-2 py-1 rounded border hover:bg-red-50 text-red-600"
                      title="Eliminar"
                      onClick={() => confirmDelete(r)}
                    >🗑</button>
                  </li>
                ))}
              </ul>
            </div>

            {/* NAV TABS */}
            <nav role="tablist" aria-label="Secções de resultados" className="flex gap-2 overflow-x-auto pb-1">
              {tabs.map(t => {
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
                      "px-3 py-1.5 rounded-full border text-sm transition",
                      active ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 hover:bg-gray-50",
                      disabled ? "opacity-50 cursor-not-allowed" : ""
                    ].join(' ')}
                  >
                    <span>{t.label}</span>
                    {typeof t.badge === 'number' && (
                      <span
                        className={[
                          "ml-2 inline-flex items-center justify-center min-w-5 px-1 rounded-full text-[10px]",
                          active ? "bg-white/20 text-white" : "bg-gray-200 text-gray-700"
                        ].join(' ')}
                      >
                        {t.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
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
                    Resultados existentes {selectedClass ? <span className="text-gray-500">— {selectedClass}</span> : null}
                  </h2>
                  <span className="text-xs text-gray-500">
                    {loadingExisting ? 'A carregar…' : `${(existingResults ?? []).length} linhas`}
                  </span>
                </header>
                <div className="max-h-[66vh] overflow-auto rounded border">
                  <ExistingResultsTable
                    results={existingResults ?? []}
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
                  <h2 className="text-lg font-semibold">Rascunho & Inscritos</h2>
                  <p className="text-xs text-gray-500">Adiciona por nº de vela ou a partir da lista filtrável.</p>
                </header>
                <div className="max-h-[66vh] overflow-auto">
                  <DraftResultsEditor
                    draft={draft ?? []}
                    entries={(availableEntries ?? []).concat()}
                    available={availableEntries ?? []}
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
                <h2 className="text-lg font-semibold mb-3">Adicionar resultado em falta</h2>
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
                <h2 className="text-lg font-semibold mb-3">Configuração de Descartes</h2>
                <ScoringPanel
                  scoring={scoring}
                  onChange={setScoring}
                  onSave={saveScoring}
                  saving={savingScoring}
                />
                <p className="text-xs text-gray-500">
                  O <strong>Net</strong> na classificação geral usa estes valores.
                </p>
              </section>
            )}
          </>
        )}
      </div>

      {/* Action bar flutuante (apenas quando há rascunho) */}
      {selectedRaceId && view !== 'existing' && (draft ?? []).length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-30">
          <div className="w-full px-6">
            <div className="flex items-center gap-3 rounded-2xl border bg-white shadow-lg p-3">
              <span className="text-sm text-gray-700">
                {(draft ?? []).length} no rascunho — confirma para guardar em massa.
              </span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={saveBulk}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl"
                >
                  Guardar em massa
                </button>
                <button
                  onClick={() => (draft ?? []).forEach(d => removeDraft(d.entryId))}
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
