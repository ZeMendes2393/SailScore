'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFleets } from '../../hooks/useFleets';

import SelectClassBar from './components/SelectClassBar';
import ExistingFleetSet from './components/ExistingFleetSet';

import CreateQualifying from './components/CreateQualifying';
import CreateReshuffle from './components/CreateReshuffle';
import CreateFinals from './components/CreateFinals';
import CreateMedalRace from './components/CreateMedalRace';

import type { OverallRow } from './types';

type FleetManagerProps = { 
  overall: OverallRow[];
  regattaId: number;
};

export default function FleetManager({ overall, regattaId }: FleetManagerProps) {

  // ---------------- HOOK ----------------
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
    createMedalRace,
    deleteFleetSet,
  } = useFleets();

  // ---------------- UI MODE ----------------
  const [modeCreate, setModeCreate] = useState<
    '' | 'choose' | 'qualifying' | 'reshuffle' | 'finals' | 'medal'
  >('');

  // ---------------- LOCAL STATE ----------------
  const [localTitle, setLocalTitle] = useState('');

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
    () => sets.find(s => s.id === selectedSetId) ?? null,
    [sets, selectedSetId]
  );

  useEffect(() => {
    setLocalTitle(selectedSet?.public_title ?? '');
  }, [selectedSet]);

  // ---------------- OVERALL POR CLASSE ----------------
  const classOverall = useMemo(
    () => selectedClass
      ? overall.filter(r => r.class_name === selectedClass)
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

      {/* CLASS SELECTION (mantém-se igual) */}
      <SelectClassBar
        classes={classes}
        selectedClass={selectedClass}
        setSelectedClass={setSelectedClass}
        clearSelections={() => {
          setSelectedSetId(null);
          setModeCreate('');
        }}
      />

      {/* ================= BROWSE / EDIT ================= */}
      {modeCreate === '' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* LISTA DE FLEET SETS */}
          <div className="border rounded-xl p-4 bg-white shadow space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Fleet Sets</h3>
              <button
                onClick={() => {
                  setSelectedSetId(null);
                  setModeCreate('choose');
                }}
                className="px-3 py-1 rounded bg-emerald-600 text-white text-sm"
              >
                + Create new
              </button>
            </div>

            {sets.length === 0 && (
              <div className="text-sm text-gray-500">
                No fleet sets yet.
              </div>
            )}

            <ul className="text-sm space-y-1">
              {sets.map((s) => (
                <li
                  key={s.id}
                  onClick={() => setSelectedSetId(s.id)}
                  className={`cursor-pointer px-2 py-1 rounded ${
                    selectedSetId === s.id
                      ? 'bg-emerald-100 font-medium'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  {s.public_title || 'Untitled fleet set'}
                </li>
              ))}
            </ul>
          </div>

          {/* EXISTING FLEET SET */}
          <div className="md:col-span-2">
            {selectedSet ? (
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
                deleteFleetSet={deleteFleetSet}
                assignments={sortedAssignments}
              />
            ) : (
              <div className="border rounded-xl p-6 bg-white shadow text-gray-500">
                Select a fleet set to view or edit.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= CREATE ================= */}
      {modeCreate !== '' && (
        <div className="border rounded-xl p-6 bg-white shadow space-y-6">

          <button
            onClick={() => setModeCreate('')}
            className="text-sm text-emerald-600 hover:underline"
          >
            ← Back to fleet list
          </button>

          {/* ESCOLHA DO TIPO */}
          {modeCreate === 'choose' && (
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Create new fleet set</h3>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setModeCreate('qualifying')} className="px-3 py-2 border rounded">Qualifying</button>
                <button onClick={() => setModeCreate('reshuffle')} className="px-3 py-2 border rounded">Reshuffle</button>
                <button onClick={() => setModeCreate('finals')} className="px-3 py-2 border rounded">Finals</button>
                <button onClick={() => setModeCreate('medal')} className="px-3 py-2 border rounded">🏅 Medal Race</button>
              </div>
            </div>
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
    selectedClass={selectedClass ?? ''}
    createMedalRace={createMedalRace}
  />
)}


        </div>
      )}
    </div>
  );
}
