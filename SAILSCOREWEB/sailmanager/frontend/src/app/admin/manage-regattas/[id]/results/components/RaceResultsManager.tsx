'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { useAuth } from '@/context/AuthContext';
import { useResults } from '../hooks/useResults';

import RaceSelector from './RaceSelector';
import ExistingResultsTable from './ExistingResultsTable';
import DraftResultsEditor from './DraftResultsEditor';
import TimeScoringEditor from './TimeScoringEditor';
import ImportRaceCsvModal from './ImportRaceCsvModal';
import { SailNumberDisplay } from '@/components/ui/SailNumberDisplay';
import { BASE_URL } from '@/lib/api';
import { filenameFromContentDisposition } from '@/lib/filenameFromContentDisposition';
import { safeRaceDownloadFilename } from '@/lib/safeRaceDownloadFilename';
import notify from '@/lib/notify';
import { useConfirm } from '@/components/ConfirmDialog';

type View = 'existing' | 'draft' | 'time';

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

const ALLOWED_VIEWS: View[] = ['existing', 'draft', 'time'];

export default function RaceResultsManager({
  regattaId,
  newlyCreatedRace,
  hideInnerTabs = false,
  initialRaceId,
}: Props) {
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const confirm = useConfirm();

  const {
    races,
    scoresBootstrapPending,
    allEntries,
    selectedRaceId,
    setSelectedRaceId,
    selectedClass,
    isHandicapClass,
    existingResults,
    loadingExisting,
    availableEntries,
    draft,
    draftInput,
    setDraftInput,
    addDraftBySail,
    addDraftEntry,
    removeDraft,
    moveDraft,
    saveBulk,
    moveRow,
    savePosition,
    deleteResult,
    refreshExisting,
    scoringCodes,
    onSetDraftCode,
    onSetDraftPos,
    markCode,
    deleteRace,

    sailChoicePending,
    addDraftByChosenEntry,
    clearSailChoicePending,

    // fleets
    currentRace,
    regattaNameForExport,
    fleetsForRace,
    entryIdToFleetName,
    selectedFleetId,
    setSelectedFleetId,

    // toggle discardable
    setRaceDiscardable,
    patchRaceStart,
    patchRaceHandicapMethod,
    patchRaceOrcMode,

    // Handicap / Time Scoring
    handicapEligibleEntries,
    handicapDraft,
    addHandicapEntry,
    removeHandicapEntry,
    updateHandicapField,
    updateHandicapCode,
    patchHandicapResultFields,
    saveHandicap,
  } = useResults(regattaId, token ?? undefined, newlyCreatedRace ?? null);

  const [view, setView] = useState<View>('draft');

  const [showImportCsvModal, setShowImportCsvModal] = useState(false);

  const lastAppliedInitialRaceIdRef = useRef<number | null>(null);
  const lastClassRef = useRef<string | null>(null);

  // bloquear toggle enquanto guarda
  const [savingRaceFlags, setSavingRaceFlags] = useState(false);

  // bloquear override enquanto guarda
  const [savingOverridePoints, setSavingOverridePoints] = useState(false);

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';

  // ✅ handler “Override points” com suporte a UNDO (points = null)
  const handleOverridePoints = useCallback(
    async (rowId: number, points: number | null) => {
      if (!token) {
        notify.error('No authentication token. Please log in again.');
        return;
      }

      // se não for undo, valida o número
      if (points !== null) {
        if (!Number.isFinite(points) || points < 0) {
          notify.warning('Invalid points value.');
          return;
        }
      }

      setSavingOverridePoints(true);
      try {
        const res = await fetch(`${apiBase}/results/${rowId}/override-points`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          credentials: 'include',
          body: JSON.stringify({ points }), // ✅ pode ser number ou null
        });

        if (!res.ok) {
          const msg = await res.text().catch(() => '');
          throw new Error(msg || `Error ${res.status}`);
        }

        // Força refresh para re-fetch do hook/route
        if (selectedRaceId) {
          await refreshExisting(selectedRaceId);
        }
        router.refresh();
      } catch (e: any) {
        notify.error(e?.message || 'Error updating points.');
      } finally {
        setSavingOverridePoints(false);
      }
    },
    [apiBase, token, router, refreshExisting, selectedRaceId]
  );

  // -----------------------------
  // Races: ordenar e filtrar por classe
  // -----------------------------
  const orderedRaces = useMemo(() => {
    return (races ?? [])
      .slice()
      .sort((a: any, b: any) => (a.order_index ?? a.id) - (b.order_index ?? b.id));
  }, [races]);

  const racesForSelectedClass = useMemo(() => {
    if (!selectedClass) return orderedRaces;
    return orderedRaces.filter((r: any) => r.class_name === selectedClass);
  }, [orderedRaces, selectedClass]);

  const defaultScoringView: View = isHandicapClass ? 'time' : 'draft';

  // -----------------------------
  // URL -> state (view e race)
  // -----------------------------
  useEffect(() => {
    const raw = (search.get('view') || defaultScoringView) as string;
    const v: View = (ALLOWED_VIEWS as string[]).includes(raw) ? (raw as View) : defaultScoringView;
    setView(v);

    const raceParam = search.get('race');
    if (!raceParam) return;

    const urlRaceId = Number(raceParam);
    if (Number.isNaN(urlRaceId)) return;

    const exists = (races ?? []).some((r: any) => r.id === urlRaceId);
    if (!exists) return;

    if (selectedRaceId !== urlRaceId) {
      setSelectedRaceId(urlRaceId);
      setSelectedFleetId('all');
    }
  }, [search, races, selectedRaceId, setSelectedRaceId, setSelectedFleetId, defaultScoringView]);

  // -----------------------------
  // initialRaceId (do path /races/[raceId]) -> aplica assim que races carregar
  // -----------------------------
  useEffect(() => {
    const id = initialRaceId != null && Number.isFinite(initialRaceId) ? initialRaceId : null;
    if (!id) return;
    if (lastAppliedInitialRaceIdRef.current === id) return;

    const exists = (races ?? []).some((r: any) => r.id === id);
    if (!exists) return;

    lastAppliedInitialRaceIdRef.current = id;

    if (selectedRaceId !== id) {
      setSelectedRaceId(id);

      const sp = new URLSearchParams(search?.toString() ?? '');
      sp.set('race', String(id));
      const rawView = sp.get('view');
      if (!rawView || !(ALLOWED_VIEWS as string[]).includes(rawView)) sp.set('view', defaultScoringView);
      router.replace(`?${sp.toString()}`);

      setSelectedFleetId('all');
    }
  }, [initialRaceId, races, selectedRaceId, setSelectedRaceId, search, router, setSelectedFleetId, defaultScoringView]);

  // -----------------------------
  // Mudança de classe -> garantir race da classe
  // -----------------------------
  useEffect(() => {
    if (!selectedClass) {
      lastClassRef.current = null;
      return;
    }

    if (lastClassRef.current === selectedClass) return;
    lastClassRef.current = selectedClass;

    const list = racesForSelectedClass;
    const firstId = list[0]?.id ?? null;

    const currentOk = !!selectedRaceId && list.some((r: any) => r.id === selectedRaceId);
    if (currentOk) return;

    setSelectedRaceId(firstId);

    const sp = new URLSearchParams(search?.toString() ?? '');
    if (firstId) sp.set('race', String(firstId));
    else sp.delete('race');
    if (firstId) sp.set('view', defaultScoringView);
    router.replace(`?${sp.toString()}`);

    setSelectedFleetId('all');
  }, [selectedClass, racesForSelectedClass, selectedRaceId, setSelectedRaceId, search, router, setSelectedFleetId, defaultScoringView]);

  const setViewAndUrl = (v: View) => {
    setView(v);
    const sp = new URLSearchParams(search?.toString() ?? '');
    sp.set('view', v);
    router.replace(`?${sp.toString()}`);
  };

  const handleSelectRace = (raceId: number | null) => {
    if ((raceId ?? null) === (selectedRaceId ?? null)) return;

    setSelectedRaceId(raceId);

    const sp = new URLSearchParams(search?.toString() ?? '');
    if (raceId) sp.set('race', String(raceId));
    else sp.delete('race');
    // Let the class/view sync effect choose the correct view for the selected race
    // (avoids stale view values when switching between one-design and handicap races).
    if (raceId) sp.delete('view');
    else sp.set('view', 'existing');
    router.replace(`?${sp.toString()}`);

    setView(raceId ? view : 'existing');
    setSelectedFleetId('all');
  };

  // Keep view aligned with selected race class to prevent flicker/wrong tab when switching classes.
  useEffect(() => {
    if (!selectedRaceId) return;
    const desired: View = isHandicapClass ? 'time' : 'draft';
    const invalidCurrent =
      (isHandicapClass && view === 'draft') || (!isHandicapClass && view === 'time');
    if (!invalidCurrent) return;

    setView(desired);
    const sp = new URLSearchParams(search?.toString() ?? '');
    sp.set('view', desired);
    router.replace(`?${sp.toString()}`);
  }, [selectedRaceId, isHandicapClass, view, search, router]);

  const tabs = useMemo(() => {
    if (isHandicapClass) {
      return [
        { key: 'time', label: 'Time Scoring (Handicap)', badge: (handicapDraft ?? []).length },
        { key: 'existing', label: 'Existing Results', badge: (existingResults ?? []).length },
      ] as { key: View; label: string; badge?: number }[];
    }
    return [
      { key: 'draft', label: 'Score Race', badge: (draft ?? []).length },
      { key: 'existing', label: 'Existing Results', badge: (existingResults ?? []).length },
    ] as { key: View; label: string; badge?: number }[];
  }, [existingResults, draft, isHandicapClass, handicapDraft]);

  // fleets ordenadas
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

  const hasFleets = !!currentRace?.fleet_set_id && (orderedFleets ?? []).length > 0;

  // pré-selecionar fleet
  useEffect(() => {
    if (!selectedRaceId) {
      if (selectedFleetId !== 'all') setSelectedFleetId('all');
      return;
    }

    const list = orderedFleets;

    if (list.length === 0) {
      if (selectedFleetId !== 'all') setSelectedFleetId('all');
      return;
    }

    const existsCurrent = selectedFleetId !== 'all' && list.some((f: any) => f.id === selectedFleetId);
    if (!existsCurrent) setSelectedFleetId(list[0].id);
  }, [selectedRaceId, orderedFleets, selectedFleetId, setSelectedFleetId]);

  if (authLoading || scoresBootstrapPending) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 px-6">
        <div
          className="h-12 w-12 rounded-full border-[3px] border-slate-200 border-t-blue-600 animate-spin"
          aria-hidden
        />
        <p className="text-base text-slate-600 font-medium text-center">A carregar a pontuação…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toolbar sticky */}
      <div className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="w-full px-6">
          <div className="py-3 flex flex-col gap-3">
            <div className="flex flex-col gap-1 lg:flex-row lg:items-end lg:justify-between">
              {/* Left */}
              <div>
                <h1 className="text-2xl font-bold">Race Scoring</h1>
                <p className="text-base text-gray-600">
                  {selectedRaceId
                    ? `Race selected${selectedClass ? ` — ${selectedClass}` : ''}`
                    : 'Select a race to get started.'}
                </p>

                {hasFleets && (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <span className="text-sm font-semibold uppercase tracking-wide text-gray-500">Fleets:</span>
                    {orderedFleets.map((f: any) => (
                      <button
                        key={f.id}
                        type="button"
                        className={[
                          'min-h-[40px] px-4 py-1.5 rounded-full border text-base font-semibold transition',
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

              {/* Right */}
              <div className="flex items-center gap-2 lg:min-w-[420px] lg:justify-end">
                <div className="min-w-[260px] lg:min-w-[320px]">
                  <RaceSelector races={racesForSelectedClass} selectedRaceId={selectedRaceId} onSelect={handleSelectRace} />
                </div>
              </div>
            </div>

            {!hideInnerTabs && (
              <nav role="tablist" aria-label="Race scoring sections" className="flex flex-wrap items-center gap-3 overflow-x-auto pb-2 pt-1">
                <div className="flex flex-wrap gap-3">
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
                          'min-h-[44px] px-5 py-2.5 rounded-xl border-2 text-base font-semibold shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
                          active
                            ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                            : 'bg-white text-gray-800 border-gray-300 hover:bg-blue-50 hover:border-blue-400',
                          disabled ? 'opacity-50 cursor-not-allowed shadow-none' : '',
                        ].join(' ')}
                      >
                        <span>{t.label}</span>
                        {typeof t.badge === 'number' && (
                          <span
                            className={[
                              'ml-2 inline-flex items-center justify-center min-w-[1.75rem] px-2 py-0.5 rounded-full text-xs font-bold tabular-nums',
                              active ? 'bg-white/25 text-white' : 'bg-gray-200 text-gray-800',
                            ].join(' ')}
                          >
                            {t.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {selectedRaceId && (
                  <div className="ml-auto flex items-center gap-2 shrink-0">
                    {currentRace && (
                      <>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!token || !selectedRaceId) return;
                            try {
                              const url = `${BASE_URL}/results/races/${selectedRaceId}/export/csv`;
                              const res = await fetch(url, {
                                headers: { Authorization: `Bearer ${token}` },
                              });
                              if (!res.ok) throw new Error(await res.text());
                              const blob = await res.blob();
                              const a = document.createElement('a');
                              a.href = URL.createObjectURL(blob);
                              const fromHeader = filenameFromContentDisposition(
                                res.headers.get('Content-Disposition')
                              );
                              a.download =
                                fromHeader ??
                                safeRaceDownloadFilename(
                                  regattaNameForExport,
                                  (currentRace as { name?: string } | null)?.name,
                                  selectedRaceId,
                                  'csv',
                                  (currentRace as { class_name?: string } | null)?.class_name
                                );
                              a.click();
                              URL.revokeObjectURL(a.href);
                            } catch (e: any) {
                              notify.error(e?.message || 'Export failed.');
                            }
                          }}
                          className="px-3 py-1.5 rounded-full border border-gray-300 bg-white hover:bg-gray-50 text-xs lg:text-sm"
                        >
                          Export this race (CSV)
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowImportCsvModal(true)}
                          className="px-3 py-1.5 rounded-full border border-gray-300 bg-white hover:bg-gray-50 text-xs lg:text-sm"
                        >
                          Import into this race (CSV)
                        </button>
                      </>
                    )}
                    {currentRace && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!selectedRaceId) return;
                          try {
                            const url = `${BASE_URL}/results/races/${selectedRaceId}/results/pdf`;
                            const res = await fetch(url, {
                              headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                            });
                            if (!res.ok) throw new Error(await res.text());
                            const blob = await res.blob();
                            const a = document.createElement('a');
                            a.href = URL.createObjectURL(blob);
                            const fromHeader = filenameFromContentDisposition(
                              res.headers.get('Content-Disposition')
                            );
                            a.download =
                              fromHeader ??
                              safeRaceDownloadFilename(
                                regattaNameForExport,
                                (currentRace as { name?: string } | null)?.name,
                                selectedRaceId,
                                'pdf',
                                (currentRace as { class_name?: string } | null)?.class_name
                              );
                            a.click();
                            URL.revokeObjectURL(a.href);
                          } catch (e: any) {
                            notify.error(e?.message || 'PDF download failed.');
                          }
                        }}
                        className="px-3 py-1.5 rounded-full border border-gray-300 bg-white hover:bg-gray-50 text-xs lg:text-sm text-blue-700"
                      >
                        Download race PDF
                      </button>
                    )}
                    {currentRace && (
                      <label className="flex items-center gap-2 px-3 py-1.5 rounded-full border bg-white text-xs lg:text-sm">
                        <span className="text-gray-700">Discardable</span>
                        <input
                          type="checkbox"
                          checked={!!(currentRace as any).discardable}
                          disabled={savingRaceFlags}
                          onChange={(e) => {
                            const next = e.target.checked;
                            (async () => {
                              setSavingRaceFlags(true);
                              try {
                                await setRaceDiscardable(selectedRaceId, next);
                              } finally {
                                setSavingRaceFlags(false);
                              }
                            })();
                          }}
                        />
                      </label>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await confirm({
                          title: 'Delete this race?',
                          description: 'The race and all its results will be permanently removed. This cannot be undone.',
                          tone: 'danger',
                          confirmLabel: 'Delete race',
                        });
                        if (!ok) return;
                        await deleteRace(selectedRaceId);
                      }}
                      className="px-3 py-1.5 rounded-full border border-red-500 text-red-600 hover:bg-red-50 text-xs lg:text-sm"
                    >
                      Delete race
                    </button>
                  </div>
                )}
              </nav>
            )}
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="w-full px-6 py-4">
        {!selectedRaceId ? (
          <div className="p-6 border rounded-2xl bg-white text-gray-600">Select a race at the top.</div>
        ) : (
          <>
            {view === 'existing' && (
              <section className="p-4 border rounded-2xl bg-white shadow-sm">
                <header className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">
                    Existing Results {selectedClass ? <span className="text-gray-500">— {selectedClass}</span> : null}
                  </h2>
                  <span className="text-xs text-gray-500">
                    {loadingExisting ? 'Loading…' : `${(existingResults ?? []).length} rows`}
                  </span>
                </header>

                <div className="max-h-[66vh] overflow-auto rounded border">
                  <ExistingResultsTable
                    results={existingResults ?? []}
                    entries={allEntries ?? []}
                    fleetNameByEntryId={entryIdToFleetName}
                    loading={!!loadingExisting || savingOverridePoints}
                    onMove={moveRow}
                    onEditPos={savePosition}
                    onDelete={deleteResult}
                    scoringCodes={scoringCodes ?? {}}
                    onMarkCode={markCode}
                    onOverridePoints={handleOverridePoints}
                    isHandicapClass={isHandicapClass}
                    onUpdateHandicapResult={patchHandicapResultFields}
                    raceStartTime={currentRace?.start_time ?? ''}
                    handicapMethod={currentRace?.handicap_method || 'manual'}
                    orcRatingMode={(currentRace as any)?.orc_rating_mode || 'medium'}
                  />
                </div>
              </section>
            )}

            {view === 'draft' && (
              <section className="p-4 border rounded-2xl bg-white shadow-sm">
                <header className="mb-3">
                  <h2 className="text-lg font-semibold">Score Race</h2>
                  <p className="text-xs text-gray-500">
                    Add competitors by sail number or from the filterable list, then save the race results.
                    {hasFleets && ' (list filtered by selected fleet)'}
                  </p>
                </header>
                <div className="max-h-[66vh] overflow-auto">
                  <DraftResultsEditor
                    draft={draft ?? []}
                    entries={allEntries ?? []}
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

            {view === 'time' && isHandicapClass && (
              <section className="p-4 border rounded-2xl bg-white shadow-sm">
                <header className="mb-3">
                  <h2 className="text-lg font-semibold">Time Scoring (Handicap)</h2>
                  <p className="text-xs text-gray-500">
                    Enter times in HH:MM:SS. Position, delta and points are calculated automatically
                    from Corrected Time. On save, results move to &quot;Existing Results&quot;.
                  </p>
                </header>
                <TimeScoringEditor
                  draft={handicapDraft ?? []}
                  eligibleEntries={handicapEligibleEntries ?? []}
                  scoringCodes={scoringCodes ?? {}}
                  raceId={currentRace?.id ?? null}
                  raceStartTime={currentRace?.start_time ?? ''}
                  handicapMethod={currentRace?.handicap_method || 'manual'}
                  orcRatingMode={(currentRace as any)?.orc_rating_mode || 'medium'}
                  onPatchRaceStart={patchRaceStart}
                  onPatchHandicapMethod={patchRaceHandicapMethod}
                  onPatchOrcRatingMode={patchRaceOrcMode}
                  onAddEntry={addHandicapEntry}
                  onRemoveEntry={removeHandicapEntry}
                  onUpdateField={updateHandicapField}
                  onUpdateCode={updateHandicapCode}
                  onSave={async () => {
                    const ok = await saveHandicap();
                    if (ok) setViewAndUrl('existing');
                  }}
                />
              </section>
            )}
          </>
        )}
      </div>

      {/* Action bar flutuante (apenas para o rascunho clássico de posições) */}
      {selectedRaceId && view === 'draft' && (draft ?? []).length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-30">
          <div className="w-full px-6">
            <div className="flex items-center gap-3 rounded-2xl border bg-white shadow-lg p-3">
              <span className="text-sm text-gray-700">
                {(draft ?? []).length} in Score Race — confirm to save in bulk.
              </span>
              <div className="ml-auto flex items-center gap-2">
                <button onClick={saveBulk} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl">
                  Save Results
                </button>
                <button
                  onClick={() => (draft ?? []).forEach((d) => removeDraft(d.entryId))}
                  className="px-3 py-2 rounded-xl border hover:bg-gray-50"
                  title="Clear Score Race"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: escolher qual entry quando há vários barcos com o mesmo nº de vela */}
      {sailChoicePending && sailChoicePending.candidates.length > 1 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="sail-choice-title">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5">
            <h3 id="sail-choice-title" className="text-lg font-semibold text-gray-900 mb-1">
              Multiple boats with this sail number
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Choose which boat to add to Score Race:
            </p>
            <ul className="space-y-2 mb-4">
              {sailChoicePending.candidates.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3 p-3 border rounded-xl bg-gray-50 hover:bg-gray-100"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <SailNumberDisplay
                      countryCode={(entry as any).boat_country_code}
                      sailNumber={entry.sail_number}
                    />
                    <span className="text-gray-700 truncate">
                      {entry.first_name} {entry.last_name}
                      {entry.club ? ` (${entry.club})` : ''}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => addDraftByChosenEntry(entry.id)}
                    className="shrink-0 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium"
                  >
                    Select
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={clearSailChoicePending}
                className="px-4 py-2 rounded-xl border border-gray-300 hover:bg-gray-50 text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showImportCsvModal && selectedRaceId && (
        <ImportRaceCsvModal
          raceId={selectedRaceId}
          raceName={currentRace?.name}
          token={token ?? undefined}
          onClose={() => setShowImportCsvModal(false)}
          onSuccess={() => refreshExisting(selectedRaceId)}
        />
      )}
    </div>
  );
}