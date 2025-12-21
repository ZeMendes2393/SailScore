'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFleets } from '../../hooks/useFleets';

import SelectClassBar from './components/SelectClassBar';
import SelectCreateOrExistingBar from './components/SelectCreateOrExistingBar';
import ExistingFleetSet from './components/ExistingFleetSet';

import CreateQualifying from './components/CreateQualifying';
import CreateReshuffle from './components/CreateReshuffle';
import CreateFinals from './components/CreateFinals';
import CreateMedalRace from './components/CreateMedalRace';

import type { OverallRow } from "./types";

type FleetManagerProps = { 
  overall: OverallRow[];
  regattaId: number;
};

export default function FleetManager({ overall, regattaId }: FleetManagerProps) {

  // ✅ VERSÃO CERTA — o hook TEM de receber regattaId
  const {
    classes,
    selectedClass,
    setSelectedClass,
    sets,
    selectedSetId,
    setSelectedSetId,
    assignments,
    racesAvailable,
    racesInSelectedSet,
    error,
    createQualifying,
    reshuffle,
    startFinals,
    updateFleetSetRaces,
    updateSetTitle,
    publishSet,
    unpublishSet,
    createMedalRace
  } = useFleets();  // ✔️ OBRIGATÓRIO


  const [localTitle, setLocalTitle] = useState('');
  const [modeCreate, setModeCreate] = useState<
    '' | 'qualifying' | 'reshuffle' | 'finals' | 'medal'
  >('');


  // ---------------- QUALIFYING ----------------
  const [qLabel, setQLabel] = useState('Quali D1');
  const [qNum, setQNum] = useState<2 | 3 | 4>(2);
  const [qRaceIds, setQRaceIds] = useState<number[]>([]);

  // ---------------- RESHUFFLE ----------------
  const [rLabel, setRLabel] = useState('Quali D2');
  const [rNum, setRNum] = useState<2 | 3 | 4>(2);
  const [rRaceIds, setRRaceIds] = useState<number[]>([]);

  // ---------------- FINALS ----------------
  const [mode, setMode] = useState<'auto' | 'manual' | 'manual_ranges'>('auto');
  const [lockFinals, setLockFinals] = useState(true);
  const [finalGroups, setFinalGroups] = useState(['Gold', 'Silver']);
  const [manualSpec, setManualSpec] = useState([
    { name: 'Gold', size: 0 },
    { name: 'Silver', size: 0 }
  ]);
  const [manualRanges, setManualRanges] = useState([
    { name: 'Gold', from: 1, to: 50 },
    { name: 'Silver', from: 51, to: 100 }
  ]);
  const [finalRaceIds, setFinalRaceIds] = useState<number[]>([]);

  // ---------------- SELECTED SET ----------------
  const selectedSet = useMemo(
    () => sets.find((s) => s.id === selectedSetId) ?? null,
    [sets, selectedSetId]
  );

  useEffect(() => {
    setLocalTitle(selectedSet?.public_title ?? '');
  }, [selectedSet]);

  // ---------------- OVERALL POR CLASSE ----------------
  const classOverall = useMemo(
    () => selectedClass
      ? overall.filter((r) => r.class_name === selectedClass)
      : overall,
    [overall, selectedClass]
  );

  // ---------------- ORDER ASSIGNMENTS ----------------
  const sortedAssignments = useMemo(() => {
    return assignments
      .slice()
      .sort((a, b) =>
        Number(a.sail_number?.match(/\d+/)?.[0] ?? 999999) -
        Number(b.sail_number?.match(/\d+/)?.[0] ?? 999999)
      );
  }, [assignments]);


  // ---------------- RENDER ----------------
  return (
    <div className="space-y-6">

      {!!error && (
        <div className="text-sm text-red-600">
          {error instanceof Error ? error.message : String(error)}
        </div>
      )}

      <SelectClassBar
        classes={classes}
        selectedClass={selectedClass}
        setSelectedClass={setSelectedClass}
        clearSelections={() => {
          setSelectedSetId(null);
          setModeCreate('');
        }}
      />

      <SelectCreateOrExistingBar
        sets={sets}
        selectedSetId={selectedSetId}
        setSelectedSetId={setSelectedSetId}
        modeCreate={modeCreate}
        setModeCreate={setModeCreate}
      />

      {selectedSet && (
        <ExistingFleetSet
          selectedSet={selectedSet}
          localTitle={localTitle}
          setLocalTitle={setLocalTitle}

          publishSet={publishSet}
          unpublishSet={unpublishSet}
          updateSetTitle={updateSetTitle}

          racesInSelectedSet={racesInSelectedSet}
          racesAvailable={racesAvailable}
          updateFleetSetRaces={updateFleetSetRaces}

          assignments={sortedAssignments}
        />
      )}

      {modeCreate === 'qualifying' && (
        <CreateQualifying
          qLabel={qLabel}
          setQLabel={setQLabel}
          qNum={qNum}
          setQNum={setQNum}
          qRaceIds={qRaceIds}
          setQRaceIds={setQRaceIds}
          racesAvailable={racesAvailable}
          createQualifying={createQualifying}
        />
      )}

      {modeCreate === 'reshuffle' && (
        <CreateReshuffle
          rLabel={rLabel}
          setRLabel={setRLabel}
          rNum={rNum}
          setRNum={setRNum}
          rRaceIds={rRaceIds}
          setRRaceIds={setRRaceIds}
          racesAvailable={racesAvailable}
          reshuffle={reshuffle}
        />
      )}

      {modeCreate === 'finals' && (
        <CreateFinals
          classOverall={classOverall}
          mode={mode}
          setMode={setMode}
          lockFinals={lockFinals}
          setLockFinals={setLockFinals}
          finalGroups={finalGroups}
          setFinalGroups={setFinalGroups}
          manualSpec={manualSpec}
          setManualSpec={setManualSpec}
          manualRanges={manualRanges}
          setManualRanges={setManualRanges}
          finalRaceIds={finalRaceIds}
          setFinalRaceIds={setFinalRaceIds}
          racesAvailable={racesAvailable}
          startFinals={startFinals}
        />
      )}

      {modeCreate === 'medal' && (
        <CreateMedalRace 
          classOverall={classOverall}
          racesAvailable={racesAvailable}
          regattaId={regattaId}
          createMedalRace={createMedalRace}
        />
      )}
    </div>
  );
}
