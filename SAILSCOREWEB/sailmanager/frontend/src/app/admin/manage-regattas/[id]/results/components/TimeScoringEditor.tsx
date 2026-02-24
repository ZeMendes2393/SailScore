'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Entry } from '../types';
import { SailNumberDisplay } from '@/components/ui/SailNumberDisplay';
import { TimeInput } from '@/components/ui/TimeInput';

type HandicapDraftRow = {
  entryId: number;
  finishTime: string;
  finishDay: number | '';
  elapsedTime: string;
  correctedTime: string;
  code?: string | null;
  notes?: string | null;
};

export type HandicapMethod = 'manual' | 'anc' | 'orc';

interface Props {
  draft: HandicapDraftRow[];
  eligibleEntries: Entry[];
  scoringCodes: Record<string, number>;
  raceId: number | null;
  raceStartTime: string;
  handicapMethod: string;
  orcRatingMode: 'low' | 'medium' | 'high';
  onPatchRaceStart: (raceId: number, startTime: string | null) => void;
  onPatchHandicapMethod: (raceId: number, method: string | null) => void;
  onPatchOrcRatingMode: (raceId: number, mode: 'low' | 'medium' | 'high') => void;
  onAddEntry: (entryId: number) => void;
  onRemoveEntry: (entryId: number) => void;
  onUpdateField: (
    entryId: number,
    field: 'finishTime' | 'finishDay' | 'elapsedTime' | 'correctedTime',
    value: string | number
  ) => void;
  onUpdateCode: (entryId: number, code: string | null) => void;
  onUpdateNotes: (entryId: number, notes: string) => void;
  onSave: () => void;
}

// Códigos que retiram do ranking (N+1) — alinhado com o backend
const AUTO_N_PLUS_ONE_CODES = new Set([
  'DNC',
  'DNF',
  'DNS',
  'OCS',
  'UFD',
  'BFD',
  'DSQ',
  'RET',
  'NSC',
  'DNE',
  'DGM',
]);

const normCode = (c?: string | null) => {
  const s = (c ?? '').trim().toUpperCase();
  return s || null;
};

const removesFromRanking = (code?: string | null) => {
  const c = normCode(code);
  return !!c && AUTO_N_PLUS_ONE_CODES.has(c);
};

const parseTimeToSeconds = (s?: string | null): number | null => {
  if (!s || typeof s !== 'string') return null;
  const parts = s.trim().split(':');
  if (parts.length !== 3) return null;
  const [hStr, mStr, sStr] = parts;
  const h = Number(hStr);
  const m = Number(mStr);
  const sec = Number(sStr);
  if (!Number.isFinite(h) || !Number.isFinite(m) || !Number.isFinite(sec)) return null;
  if (m < 0 || m >= 60 || sec < 0 || sec >= 60) return null;
  return h * 3600 + m * 60 + sec;
};

const formatDelta = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s
    .toString()
    .padStart(2, '0')}`;
};

/** Parse "HH:MM:SS" ou "HH:MM" para segundos no dia (0–86399). Usado no auto-cálculo start/finish/elapsed. */
function timeStringToSeconds(str: string): number {
  const parts = (str || '').trim().split(':').map((p) => parseInt(p, 10) || 0);
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  const s = parts[2] ?? 0;
  return Math.min(86399, Math.max(0, h * 3600 + m * 60 + s));
}

/** Total seconds → HH:MM:SS (para elapsed ou tempo do dia). */
function secondsToTime(totalSeconds: number): string {
  const t = Math.max(0, Math.round(totalSeconds)) % 86400;
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/** Dado start (day + time em segundos), elapsed em segundos → finish_day e finish_time. */
function computeFinishFromStartAndElapsed(
  startDay: number,
  startTimeSec: number,
  elapsedSec: number
): { finishDay: number; finishTime: string } {
  const totalSec = startTimeSec + elapsedSec;
  const finishDay = startDay + Math.floor(totalSec / 86400);
  const finishTimeSec = totalSec % 86400;
  return { finishDay, finishTime: secondsToTime(finishTimeSec) };
}

/** Duração em segundos → HH:MM:SS (pode ser > 24h). */
function formatElapsed(totalSeconds: number): string {
  const t = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/** Parse "HH:MM:SS" para segundos totais (duração; HH pode ser > 23). */
function parseElapsedToSeconds(str: string): number {
  const parts = (str || '').trim().split(':').map((p) => parseInt(p, 10) || 0);
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  const s = parts[2] ?? 0;
  return Math.max(0, h * 3600 + m * 60 + s);
}

/** Dado start (day + time), finish (day + time em sec) → elapsed em segundos, depois formato HH:MM:SS. */
function computeElapsedFromStartAndFinish(
  startDay: number,
  startTimeSec: number,
  finishDay: number,
  finishTimeSec: number
): string {
  const finishTotalSec = (finishDay - startDay) * 86400 + finishTimeSec;
  const elapsedSec = finishTotalSec - startTimeSec;
  return formatElapsed(Math.max(0, elapsedSec));
}

/** ANC: corrected time = round(rating × elapsed_seconds), formato HH:MM:SS. Rating ~ 1 (ex.: 1.01, 0.977). */
function ancCorrectedFromElapsed(elapsedStr: string, rating: number): string {
  const sec = parseElapsedToSeconds(elapsedStr);
  return formatElapsed(Math.round(rating * sec));
}

type RankingPreview = {
  position: number;
  delta: string;
  points: number;
};

function computeHandicapRankingPreview(rows: HandicapDraftRow[]): RankingPreview[] {
  if (!rows.length) return [];

  type Item = { idx: number; ct: number | null; code: string | null };

  const rankable: Item[] = [];
  const nonRankable: Item[] = [];

  rows.forEach((r, idx) => {
    const code = normCode(r.code);
    const ct = parseTimeToSeconds(r.correctedTime);
    if (code && removesFromRanking(code)) {
      nonRankable.push({ idx, ct, code });
    } else {
      rankable.push({ idx, ct, code });
    }
  });

  rankable.sort((a, b) => {
    const aNone = a.ct == null;
    const bNone = b.ct == null;
    if (aNone !== bNone) return aNone ? 1 : -1;
    if (a.ct == null || b.ct == null) return 0;
    return a.ct - b.ct;
  });

  let bestCorrected: number | null = null;
  for (const it of rankable) {
    if (it.ct != null) {
      bestCorrected = it.ct;
      break;
    }
  }

  const nRankable = rankable.length;
  const out: RankingPreview[] = rows.map(() => ({ position: 0, delta: '—', points: 0 }));

  let pos = 1;
  let idx = 0;
  while (idx < nRankable) {
    const baseCt = rankable[idx].ct;
    let tieCount = 1;
    while (idx + tieCount < nRankable && rankable[idx + tieCount].ct === baseCt) {
      tieCount += 1;
    }

    const ptsSum = Array.from({ length: tieCount }, (_, k) => pos + k).reduce(
      (acc, v) => acc + v,
      0
    );
    const ptsAvg = ptsSum / tieCount;

    const deltaStr =
      bestCorrected == null || baseCt == null ? '—' : formatDelta(baseCt - bestCorrected);

    for (let k = 0; k < tieCount; k += 1) {
      const orig = rankable[idx + k];
      out[orig.idx] = {
        position: pos,
        delta: baseCt != null && bestCorrected != null ? deltaStr : '—',
        points: ptsAvg,
      };
    }

    pos += tieCount;
    idx += tieCount;
  }

  const nPlusOne = nRankable + 1;
  for (const item of nonRankable) {
    out[item.idx] = {
      position: nPlusOne,
      delta: '—',
      points: nPlusOne,
    };
  }

  return out;
}

/** Start não tem dia: é sempre "dia 0". Só o finish tem day (0 = mesmo dia, 1 = dia seguinte, etc.). */
const START_DAY = 0;

/** Rating efetivo para handicap: ANC usa entry.rating, ORC usa orc_low/medium/high conforme orcRatingMode. */
function getEffectiveRating(entry: Entry | undefined, method: HandicapMethod, orcMode: 'low' | 'medium' | 'high'): number | null {
  if (!entry) return null;
  if (method === 'anc') {
    const r = entry.rating;
    return typeof r === 'number' && !Number.isNaN(r) ? r : null;
  }
  if (method === 'orc') {
    const e = entry as Entry & { orc_low?: number; orc_medium?: number; orc_high?: number };
    const val = orcMode === 'low' ? e.orc_low : orcMode === 'high' ? e.orc_high : e.orc_medium;
    return typeof val === 'number' && !Number.isNaN(val) ? val : null;
  }
  return null;
}

export default function TimeScoringEditor({
  draft,
  eligibleEntries,
  scoringCodes,
  raceId,
  raceStartTime,
  handicapMethod,
  orcRatingMode,
  onPatchRaceStart,
  onPatchHandicapMethod,
  onPatchOrcRatingMode,
  onAddEntry,
  onRemoveEntry,
  onUpdateField,
  onUpdateCode,
  onUpdateNotes,
  onSave,
}: Props) {
  const [filter, setFilter] = useState('');
  const [startTimeEdit, setStartTimeEdit] = useState(raceStartTime);
  const method = (handicapMethod === 'anc' || handicapMethod === 'orc' || handicapMethod === 'manual'
    ? handicapMethod
    : 'manual') as HandicapMethod;

  useEffect(() => {
    setStartTimeEdit(raceStartTime);
  }, [raceStartTime]);

  // Recalcular corrected time quando orcRatingMode ou method muda (ANC/ORC)
  useEffect(() => {
    if (method !== 'anc' && method !== 'orc') return;
    draft.forEach((row) => {
      const entry = entriesById.get(row.entryId);
      const rating = getEffectiveRating(entry, method, orcRatingMode);
      if (rating != null && row.elapsedTime) {
        onUpdateField(row.entryId, 'correctedTime', ancCorrectedFromElapsed(row.elapsedTime, rating));
      }
    });
  }, [method, orcRatingMode]); // eslint-disable-line react-hooks/exhaustive-deps -- só recalcular quando método/ORC muda

  const handleBlurRaceStart = useCallback(() => {
    if (raceId == null) return;
    onPatchRaceStart(raceId, startTimeEdit || null);
  }, [raceId, startTimeEdit, onPatchRaceStart]);

  const entriesById = useMemo(() => {
    const m = new Map<number, Entry>();
    for (const e of eligibleEntries) m.set(e.id, e);
    return m;
  }, [eligibleEntries]);

  const availableToAdd = useMemo(() => {
    const usedIds = new Set(draft.map((r) => r.entryId));
    return eligibleEntries.filter((e) => !usedIds.has(e.id));
  }, [eligibleEntries, draft]);

  const filteredAvailable = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return availableToAdd;
    return availableToAdd.filter(
      (e) =>
        (e.sail_number || '').toLowerCase().includes(f) ||
        (`${e.first_name} ${e.last_name}` || '').toLowerCase().includes(f) ||
        (e.club || '').toLowerCase().includes(f)
    );
  }, [availableToAdd, filter]);

  const codeOptions = useMemo(() => {
    const custom = Object.keys(scoringCodes || {})
      .map((c) => c.toUpperCase())
      .sort();
    const all = new Set<string>();
    AUTO_N_PLUS_ONE_CODES.forEach((c) => all.add(c));
    ['RDG', 'SCP', 'ZPF', 'DPI'].forEach((c) => all.add(c));
    custom.forEach((c) => all.add(c));
    return Array.from(all);
  }, [scoringCodes]);

  const rankingPreview = useMemo(() => computeHandicapRankingPreview(draft), [draft]);

  const rows = useMemo(() => {
    return draft
      .map((r, idx) => {
        const entry = entriesById.get(r.entryId);
        const preview = rankingPreview[idx] ?? { position: idx + 1, delta: '—', points: 0 };
        return { row: r, entry, preview };
      })
      .sort((a, b) => a.preview.position - b.preview.position);
  }, [draft, entriesById, rankingPreview]);

  const entriesWithoutRatingInDraft = useMemo(() => {
    if (method === 'anc') {
      return draft.filter((r) => getEffectiveRating(entriesById.get(r.entryId), 'anc', orcRatingMode) == null);
    }
    if (method === 'orc') {
      return draft.filter((r) => getEffectiveRating(entriesById.get(r.entryId), 'orc', orcRatingMode) == null);
    }
    return [];
  }, [draft, entriesById, method, orcRatingMode]);

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-700">
        <p className="mb-1">
          <strong>Time Scoring (Handicap)</strong> — insere tempos em HH:MM:SS.
        </p>
        <p className="text-xs text-gray-500">
          A posição, delta e pontos são calculados automaticamente a partir do Corrected Time.
        </p>
      </div>

      {raceId != null && (
        <>
          <div className="flex flex-wrap items-center gap-3 p-3 border rounded bg-gray-50">
            <span className="text-sm font-medium">Método de score:</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onPatchHandicapMethod(raceId, 'manual')}
                className={`px-3 py-1.5 rounded text-sm ${method === 'manual' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
              >
                Manual
              </button>
              <button
                type="button"
                onClick={() => onPatchHandicapMethod(raceId, 'anc')}
                className={`px-3 py-1.5 rounded text-sm ${method === 'anc' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
              >
                ANC
              </button>
              <button
                type="button"
                onClick={() => onPatchHandicapMethod(raceId, 'orc')}
                className={`px-3 py-1.5 rounded text-sm ${method === 'orc' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
              >
                ORC
              </button>
            </div>
          </div>
          {method === 'orc' && (
            <div className="flex flex-wrap items-center gap-3 mt-2 p-3 border rounded bg-gray-50">
              <span className="text-sm font-medium">Rating ORC:</span>
              <div className="flex gap-2">
                {(['low', 'medium', 'high'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onPatchOrcRatingMode(raceId, m)}
                    className={`px-3 py-1.5 rounded text-sm capitalize ${orcRatingMode === m ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {method === 'anc' && entriesWithoutRatingInDraft.length > 0 && (
        <div className="p-3 border border-amber-300 rounded bg-amber-50 text-amber-900 text-sm" role="alert">
          Some boats are missing ANC rating. Fill in the ANC rating in the entries.
        </div>
      )}
      {method === 'orc' && entriesWithoutRatingInDraft.length > 0 && (
        <div className="p-3 border border-amber-300 rounded bg-amber-50 text-amber-900 text-sm" role="alert">
          Some boats are missing ORC rating ({orcRatingMode}). Fill in the ORC {orcRatingMode} in the entries.
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold">
            Eligible entries for this race ({eligibleEntries.length})
          </h4>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search by sail / name / club"
            className="border rounded px-3 py-1.5 text-sm w-64"
            aria-label="Search available entries"
          />
        </div>

        {filteredAvailable.length === 0 ? (
          <p className="text-xs text-gray-500">No entries match the filter.</p>
        ) : (
          <ul className="space-y-1 max-h-56 overflow-auto pr-1">
            {filteredAvailable.map((entry) => (
              <li
                key={entry.id}
                className="flex justify-between items-center p-2 border rounded bg-white hover:bg-gray-50"
              >
                <span className="truncate">
                  <SailNumberDisplay
                    countryCode={(entry as any).boat_country_code}
                    sailNumber={entry.sail_number}
                  />
                  {' — '}
                  {entry.first_name} {entry.last_name}
                  {entry.club ? <span className="text-gray-500"> ({entry.club})</span> : null}
                  {getEffectiveRating(entry, method, orcRatingMode) != null ? (
                    <span className="ml-2 text-xs text-gray-600">
                      rating: {getEffectiveRating(entry, method, orcRatingMode)}
                    </span>
                  ) : null}
                </span>
                <button
                  onClick={() => onAddEntry(entry.id)}
                  className="text-sm text-green-700 hover:underline"
                >
                  Add
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {raceId != null && (
        <div className="flex flex-wrap items-center gap-4 p-3 border rounded bg-gray-50">
          <span className="text-sm font-medium">Race start (time of day, common to all):</span>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600">Start time</label>
            <TimeInput
              value={startTimeEdit}
              onChange={setStartTimeEdit}
              onBlur={handleBlurRaceStart}
              placeholder="HH:MM:SS"
              className="w-24 border rounded px-1 py-0.5 text-center text-sm"
              aria-label="Race start time"
            />
          </div>
          <button
            type="button"
            onClick={handleBlurRaceStart}
            className="text-xs text-blue-600 hover:underline"
          >
            Apply
          </button>
        </div>
      )}

      <div className="space-y-2">
        <h4 className="text-sm font-semibold">
          Time table ({draft.length}) — ranking preview
        </h4>

        {rows.length === 0 ? (
          <p className="text-xs text-gray-500">
            No boats added to the time table yet. Choose from above to start.
          </p>
        ) : (
          <div className="max-h-[60vh] overflow-auto border rounded">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-100 sticky top-0 z-10">
                <tr>
                  <th className="border px-2 py-2 text-center">Pos</th>
                  <th className="border px-2 py-2 text-left">Sail / Boat</th>
                  <th className="border px-2 py-2 text-left">Skipper</th>
                  <th className="border px-2 py-2 text-center">Rating</th>
                  <th className="border px-2 py-2 text-center">Start time</th>
                  <th className="border px-2 py-2 text-center">Finish Day</th>
                  <th className="border px-2 py-2 text-center">Finish Time</th>
                  <th className="border px-2 py-2 text-center">Elapsed</th>
                  <th className="border px-2 py-2 text-center">Corrected</th>
                  <th className="border px-2 py-2 text-center">Delta</th>
                  <th className="border px-2 py-2 text-center">Points</th>
                  <th className="border px-2 py-2 text-center">Code</th>
                  <th className="border px-2 py-2 text-left">Notes</th>
                  <th className="border px-2 py-2 text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ row, entry, preview }, idx) => {
                  const bg = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50';
                  const codeValue = normCode(row.code) ?? '';
                  return (
                    <tr key={row.entryId} className={bg}>
                      <td className="border px-1 py-1 text-center font-semibold">
                        {preview.position}
                      </td>
                      <td className="border px-2 py-1">
                        <div className="flex items-center gap-2">
                          <SailNumberDisplay
                            countryCode={(entry as any)?.boat_country_code}
                            sailNumber={entry?.sail_number}
                          />
                          <div className="min-w-0">
                            <div className="truncate text-gray-800">
                              {entry?.boat_name || '(no name)'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="border px-2 py-1">
                        {entry ? (
                          <span className="truncate">
                            {entry.first_name} {entry.last_name}
                            {entry.club ? <span className="text-gray-500"> ({entry.club})</span> : null}
                          </span>
                        ) : (
                          <span className="text-gray-400">entry missing</span>
                        )}
                      </td>
                      <td className="border px-2 py-1 text-center">
                        {getEffectiveRating(entry, method, orcRatingMode) ?? '—'}
                      </td>
                      <td className="border px-1 py-1 text-center text-gray-600">
                        {raceStartTime || '—'}
                      </td>
                      <td className="border px-1 py-1 text-center">
                        <input
                          type="number"
                          min={0}
                          value={row.finishDay === '' ? '' : row.finishDay}
                          onChange={(e) => {
                            const v = e.target.value;
                            const n = v === '' ? '' : Math.max(0, parseInt(v, 10) || 0);
                            onUpdateField(row.entryId, 'finishDay', n);
                            if (raceStartTime && raceId != null) {
                              const fd = typeof n === 'number' ? n : 0;
                              const elapsedStr = computeElapsedFromStartAndFinish(
                                START_DAY,
                                timeStringToSeconds(raceStartTime),
                                fd,
                                timeStringToSeconds(row.finishTime)
                              );
                              onUpdateField(row.entryId, 'elapsedTime', elapsedStr);
                              const rating = getEffectiveRating(entry, method, orcRatingMode);
                              if (rating != null) {
                                onUpdateField(row.entryId, 'correctedTime', ancCorrectedFromElapsed(elapsedStr, rating));
                              }
                            }
                          }}
                          className="w-12 border rounded px-1 py-0.5 text-center text-sm"
                          aria-label="Dias após o start (0 = mesmo dia)"
                        />
                      </td>
                      <td className="border px-1 py-1 text-center">
                        <TimeInput
                          value={row.finishTime}
                          onChange={(v) => {
                            onUpdateField(row.entryId, 'finishTime', v);
                            if (raceStartTime && raceId != null) {
                              const fd = typeof row.finishDay === 'number' ? row.finishDay : 0;
                              const elapsedStr = computeElapsedFromStartAndFinish(
                                START_DAY,
                                timeStringToSeconds(raceStartTime),
                                fd,
                                timeStringToSeconds(v)
                              );
                              onUpdateField(row.entryId, 'elapsedTime', elapsedStr);
                              const rating = getEffectiveRating(entry, method, orcRatingMode);
                              if (rating != null) {
                                onUpdateField(row.entryId, 'correctedTime', ancCorrectedFromElapsed(elapsedStr, rating));
                              }
                            }
                          }}
                          className="w-24 border rounded px-1 py-0.5 text-center text-sm"
                          placeholder="HH:MM:SS"
                        />
                      </td>
                      <td className="border px-1 py-1 text-center">
                        <TimeInput
                          value={row.elapsedTime}
                          onChange={(v) => {
                            onUpdateField(row.entryId, 'elapsedTime', v);
                            if (raceStartTime && raceId != null) {
                              const startSec = timeStringToSeconds(raceStartTime);
                              const elapsedSec = parseElapsedToSeconds(v);
                              const { finishDay, finishTime } = computeFinishFromStartAndElapsed(
                                START_DAY,
                                startSec,
                                elapsedSec
                              );
                              onUpdateField(row.entryId, 'finishTime', finishTime);
                              onUpdateField(row.entryId, 'finishDay', finishDay);
                            }
                            const rating = getEffectiveRating(entry, method, orcRatingMode);
                            if (rating != null) {
                              onUpdateField(row.entryId, 'correctedTime', ancCorrectedFromElapsed(v, rating));
                            }
                          }}
                          className="w-24 border rounded px-1 py-0.5 text-center text-sm"
                          placeholder="HH:MM:SS"
                        />
                      </td>
                      <td className="border px-1 py-1 text-center">
                        {(method === 'anc' || method === 'orc') ? (
                          <span className="text-sm text-gray-800">{row.correctedTime || '—'}</span>
                        ) : (
                          <TimeInput
                            value={row.correctedTime}
                            onChange={(v) => onUpdateField(row.entryId, 'correctedTime', v)}
                            className="w-24 border rounded px-1 py-0.5 text-center text-sm"
                            placeholder="HH:MM:SS"
                          />
                        )}
                      </td>
                      <td className="border px-1 py-1 text-center">{preview.delta}</td>
                      <td className="border px-1 py-1 text-center">
                        {Number.isFinite(preview.points) ? preview.points.toFixed(1) : '—'}
                      </td>
                      <td className="border px-1 py-1 text-center">
                        <select
                          className="border rounded px-1 py-0.5 text-xs"
                          value={codeValue}
                          onChange={(e) => onUpdateCode(row.entryId, e.target.value || null)}
                        >
                          <option value="">(none)</option>
                          {codeOptions.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="border px-1 py-1">
                        <input
                          type="text"
                          value={row.notes ?? ''}
                          onChange={(e) => onUpdateNotes(row.entryId, e.target.value)}
                          className="w-40 border rounded px-1 py-0.5"
                          placeholder="Notes (optional)"
                        />
                      </td>
                      <td className="border px-1 py-1 text-center">
                        <button
                          type="button"
                          onClick={() => onRemoveEntry(row.entryId)}
                          className="px-2 py-1 rounded border text-red-600 hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {rows.length > 0 && (
          <div className="pt-2 text-right">
            <button
              type="button"
              onClick={onSave}
              className="bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-800 text-sm"
            >
              Save Handicap results
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

