'use client';

import { TimeInput } from '@/components/ui/TimeInput';
import { SailNumberDisplay } from '@/components/ui/SailNumberDisplay';
import type { ApiResult } from '../../types';
import {
  START_DAY,
  ancCorrectedFromElapsed,
  computeElapsedFromStartAndFinish,
  computeFinishFromStartAndElapsed,
  isAdjustable,
  isAutoNPlusOne,
  parseElapsedToSeconds,
  timeStringToSeconds,
} from './shared';

type CodeGroups = {
  autoDiscardable: string[];
  autoNonDiscardable: string[];
  adjustable: string[];
  custom: string[];
};

type HandicapEdit = {
  finish_day: string;
  finish_time: string;
  elapsed_time: string;
  corrected_time: string;
};

interface Props {
  sorted: ApiResult[];
  loading: boolean;
  raceStartTime: string;
  handicapMethod: string;
  codeGroups: CodeGroups;
  pendingCode: Record<number, string>;
  pendingPoints: Record<number, string>;
  pointsOpen: Record<number, boolean>;
  pointsValue: Record<number, string>;
  handicapRankingPreviewById: Map<number, { position: number; delta: string; points: number }>;
  clearPending: (rowId: number) => void;
  openPoints: (row: ApiResult) => void;
  closePoints: (rowId: number) => void;
  setPointsValue: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  setPendingCode: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  setPendingPoints: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  resolveCrew: (row: ApiResult) => string;
  getHandicapEdit: (row: ApiResult) => HandicapEdit;
  setHandicapEditField: (
    rowId: number,
    field: 'finish_day' | 'finish_time' | 'elapsed_time' | 'corrected_time',
    value: string
  ) => void;
  onMarkCode: (rowId: number, code: string | null, points?: number | null) => void;
  onOverridePoints: (rowId: number, points: number | null) => void;
  /** Rating efetivo (ANC/ORC + modo ORC); necessário quando `row.rating` não reflete ORC. */
  resolveEffectiveRating: (row: ApiResult) => number | null;
  onUpdateHandicapResult?: (
    rowId: number,
    data: {
      finish_day: number | null;
      finish_time: string | null;
      elapsed_time: string | null;
      corrected_time: string | null;
    }
  ) => void | Promise<void>;
  showFleetColumn?: boolean;
  fleetLabelForRow?: (row: ApiResult) => string | null;
}

export default function HandicapResultsTable({
  sorted,
  loading,
  raceStartTime,
  handicapMethod,
  codeGroups,
  pendingCode,
  pendingPoints,
  pointsOpen,
  pointsValue,
  handicapRankingPreviewById,
  clearPending,
  openPoints,
  closePoints,
  setPointsValue,
  setPendingCode,
  setPendingPoints,
  resolveCrew,
  getHandicapEdit,
  setHandicapEditField,
  onMarkCode,
  onOverridePoints,
  resolveEffectiveRating,
  onUpdateHandicapResult,
  showFleetColumn = false,
  fleetLabelForRow,
}: Props) {
  return (
    <table className="min-w-full text-xs">
      <thead className="bg-gray-100 sticky top-0 z-10">
        <tr>
          <th className="border px-2 py-2 text-center">Pos</th>
          <th className="border px-2 py-2 text-left">Sail No</th>
          {showFleetColumn ? (
            <th className="border px-2 py-2 text-left whitespace-nowrap">Fleet</th>
          ) : null}
          <th className="border px-2 py-2 text-left">Boat / Sponsor</th>
          <th className="border px-2 py-2 text-left">Crew</th>
          <th className="border px-2 py-2 text-center">Rating</th>
          <th className="border px-2 py-2 text-center">Finish Time</th>
          <th className="border px-2 py-2 text-center">Days after start</th>
          <th className="border px-2 py-2 text-center">Elapsed</th>
          <th className="border px-2 py-2 text-center">Corrected</th>
          <th className="border px-2 py-2 text-center">Delta</th>
          <th className="border px-2 py-2 text-center">Points</th>
          <th className="border px-2 py-2 text-center">Code</th>
          <th className="border px-2 py-2 text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((row, idx) => {
          const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50';
          const codeUpper = row.code ? row.code.toUpperCase() : null;
          const showAdjustBox = !!pendingCode[row.id] && isAdjustable(pendingCode[row.id]);
          const ptsIsOpen = !!pointsOpen[row.id];
          const rawPtsVal = pointsValue[row.id] ?? '';
          const he = getHandicapEdit(row);
          const preview = handicapRankingPreviewById.get(row.id);
          const hasOverride = row.points_override != null;
          const lockedByCode = isAutoNPlusOne(codeUpper);
          const effRating = resolveEffectiveRating(row);

          return (
            <tr key={row.id} className={rowBg}>
              <td className="border px-2 py-2 text-center font-semibold">
                {preview?.position ?? row.position}
              </td>
              <td className="border px-2 py-2">
                <div className="flex items-center gap-2">
                  <SailNumberDisplay countryCode={row.boat_country_code} sailNumber={row.sail_number} />
                </div>
              </td>
              {showFleetColumn ? (
                <td className="border px-2 py-2 text-sm text-gray-800 font-medium">
                  {fleetLabelForRow?.(row) ?? '—'}
                </td>
              ) : null}
              <td className="border px-2 py-2">
                <span className="text-sm text-gray-800">{row.boat_name || '—'}</span>
              </td>
              <td className="border px-2 py-2">{resolveCrew(row)}</td>
              <td className="border px-2 py-2 text-center">
                {effRating != null ? effRating : '—'}
              </td>
              <td className="border px-2 py-2 text-center">
                <TimeInput
                  value={he.finish_time}
                  onChange={(v) => {
                    setHandicapEditField(row.id, 'finish_time', v);
                    if (raceStartTime) {
                      const fd = Number(he.finish_day || 0);
                      const elapsedStr = computeElapsedFromStartAndFinish(
                        START_DAY,
                        timeStringToSeconds(raceStartTime),
                        fd,
                        timeStringToSeconds(v)
                      );
                      setHandicapEditField(row.id, 'elapsed_time', elapsedStr);
                      if (
                        (handicapMethod === 'anc' || handicapMethod === 'orc') &&
                        effRating != null
                      ) {
                        setHandicapEditField(
                          row.id,
                          'corrected_time',
                          ancCorrectedFromElapsed(elapsedStr, effRating)
                        );
                      }
                    }
                  }}
                  className="w-24 border rounded px-1 py-0.5 text-center text-xs"
                  placeholder="HH:MM:SS"
                />
              </td>
              <td className="border px-2 py-2 text-center">
                <input
                  type="number"
                  min={0}
                  value={he.finish_day}
                  onChange={(e) => {
                    setHandicapEditField(row.id, 'finish_day', e.target.value);
                    if (raceStartTime && he.finish_time) {
                      const fd = Number(e.target.value || 0);
                      const elapsedStr = computeElapsedFromStartAndFinish(
                        START_DAY,
                        timeStringToSeconds(raceStartTime),
                        fd,
                        timeStringToSeconds(he.finish_time)
                      );
                      setHandicapEditField(row.id, 'elapsed_time', elapsedStr);
                      if (
                        (handicapMethod === 'anc' || handicapMethod === 'orc') &&
                        effRating != null
                      ) {
                        setHandicapEditField(
                          row.id,
                          'corrected_time',
                          ancCorrectedFromElapsed(elapsedStr, effRating)
                        );
                      }
                    }
                  }}
                  className="w-14 border rounded px-1 py-0.5 text-center text-xs"
                  placeholder="0"
                />
              </td>
              <td className="border px-2 py-2 text-center">
                <TimeInput
                  value={he.elapsed_time}
                  onChange={(v) => {
                    setHandicapEditField(row.id, 'elapsed_time', v);
                    if (raceStartTime) {
                      const computed = computeFinishFromStartAndElapsed(
                        START_DAY,
                        timeStringToSeconds(raceStartTime),
                        parseElapsedToSeconds(v)
                      );
                      setHandicapEditField(row.id, 'finish_day', String(computed.finishDay));
                      setHandicapEditField(row.id, 'finish_time', computed.finishTime);
                    }
                    if (
                      (handicapMethod === 'anc' || handicapMethod === 'orc') &&
                      effRating != null
                    ) {
                      setHandicapEditField(row.id, 'corrected_time', ancCorrectedFromElapsed(v, effRating));
                    }
                  }}
                  className="w-24 border rounded px-1 py-0.5 text-center text-xs"
                  placeholder="HH:MM:SS"
                />
              </td>
              <td className="border px-2 py-2 text-center">
                {handicapMethod === 'anc' || handicapMethod === 'orc' ? (
                  <span className="text-xs">{he.corrected_time || row.corrected_time || '—'}</span>
                ) : (
                  <TimeInput
                    value={he.corrected_time}
                    onChange={(v) => setHandicapEditField(row.id, 'corrected_time', v)}
                    className="w-24 border rounded px-1 py-0.5 text-center text-xs"
                    placeholder="HH:MM:SS"
                  />
                )}
              </td>
              <td className="border px-2 py-2 text-center">
                {preview?.delta ?? (row.delta || (row.code ? '—' : ''))}
              </td>
              <td className="border px-2 py-2 text-center">
                <span className="text-sm">
                  {preview
                    ? Number.isInteger(preview.points)
                      ? preview.points
                      : preview.points.toFixed(1)
                    : row.points}
                  {hasOverride ? (
                    <span className="ml-1 text-[10px] text-yellow-700">(OVR: {row.points_override})</span>
                  ) : null}
                </span>
              </td>
              <td className="border px-2 py-2">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <select
                      className="border rounded px-2 py-1"
                      value={row.code ?? ''}
                      disabled={loading}
                      onChange={(ev) => {
                        const raw = (ev.target.value || '').trim();
                        const next = raw ? raw.toUpperCase() : null;
                        clearPending(row.id);
                        if (!next) {
                          onMarkCode(row.id, null, null);
                          return;
                        }
                        if (isAdjustable(next)) {
                          setPendingCode((p) => ({ ...p, [row.id]: next }));
                          setPendingPoints((p) => ({
                            ...p,
                            [row.id]: row.points != null ? String(row.points) : '',
                          }));
                          return;
                        }
                        onMarkCode(row.id, next, null);
                      }}
                      aria-label="Scoring code"
                    >
                      <option value="">(none)</option>
                      <optgroup label="Auto (N+1) — discardable">
                        {codeGroups.autoDiscardable.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Auto (N+1) — non-discardable">
                        {codeGroups.autoNonDiscardable.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Adjustable (requires value)">
                        {codeGroups.adjustable.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </optgroup>
                      {codeGroups.custom.length > 0 && (
                        <optgroup label="Custom (fixed)">
                          {codeGroups.custom.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                  {showAdjustBox && (
                    <div className="flex items-center gap-2 bg-gray-50 border rounded p-2">
                      <span className="text-xs text-gray-600 w-20">{pendingCode[row.id]}</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        className="border rounded px-2 py-1 w-32"
                        value={pendingPoints[row.id] ?? ''}
                        placeholder="ex: 4.5"
                        onChange={(e) => setPendingPoints((p) => ({ ...p, [row.id]: e.target.value }))}
                      />
                      <button
                        type="button"
                        className="px-2 py-1 rounded bg-blue-600 text-white text-xs hover:bg-blue-700"
                        onClick={() => {
                          const code = pendingCode[row.id];
                          const rawPts = (pendingPoints[row.id] ?? '').trim();
                          const pts = Number(rawPts);
                          if (!Number.isFinite(pts)) {
                            alert('Invalid value (points).');
                            return;
                          }
                          onMarkCode(row.id, code, pts);
                          clearPending(row.id);
                        }}
                      >
                        Apply
                      </button>
                      <button
                        type="button"
                        className="ml-auto px-2 py-1 rounded border text-xs hover:bg-gray-100"
                        onClick={() => clearPending(row.id)}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </td>
              <td className="border px-2 py-2 text-right">
                <div className="inline-flex gap-2 items-center">
                  <button
                    type="button"
                    disabled={loading || !onUpdateHandicapResult}
                    onClick={async () => {
                      if (!onUpdateHandicapResult) return;
                      const dayRaw = he.finish_day.trim();
                      const finishDay = dayRaw === '' ? null : Math.max(0, Number(dayRaw) || 0);
                      const methodLower = (handicapMethod || '').toLowerCase();
                      let correctedOut = he.corrected_time.trim();
                      if (
                        !correctedOut &&
                        (methodLower === 'anc' || methodLower === 'orc') &&
                        effRating != null
                      ) {
                        const el = he.elapsed_time.trim();
                        if (el) correctedOut = ancCorrectedFromElapsed(el, effRating);
                      }
                      await onUpdateHandicapResult(row.id, {
                        finish_day: finishDay,
                        finish_time: he.finish_time.trim() || null,
                        elapsed_time: he.elapsed_time.trim() || null,
                        corrected_time: correctedOut || null,
                      });
                    }}
                    className="px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 text-xs"
                    title="Save handicap time fields"
                  >
                    Save times
                  </button>
                  {!ptsIsOpen ? (
                    <button
                      disabled={loading || lockedByCode}
                      onClick={() => openPoints(row)}
                      className="px-2 py-1 rounded border hover:bg-gray-100 disabled:opacity-50 text-xs"
                      title="Manually set points without changing positions"
                    >
                      {hasOverride ? 'Edit override' : 'Override points'}
                    </button>
                  ) : (
                    <div className="inline-flex items-center gap-1">
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        className="w-20 border rounded px-2 py-1 text-center text-xs"
                        value={rawPtsVal}
                        onChange={(e) => setPointsValue((p) => ({ ...p, [row.id]: e.target.value }))}
                      />
                      <button
                        type="button"
                        disabled={loading}
                        className="px-2 py-1 rounded bg-blue-600 text-white text-xs hover:bg-blue-700 disabled:opacity-50"
                        onClick={() => {
                          const raw = (rawPtsVal ?? '').trim();
                          const pts = Number(raw);
                          if (!Number.isFinite(pts) || pts < 0) {
                            alert('Invalid value (points).');
                            return;
                          }
                          onOverridePoints(row.id, pts);
                          closePoints(row.id);
                        }}
                      >
                        Apply
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        className="px-2 py-1 rounded border text-xs hover:bg-gray-100 disabled:opacity-50"
                        onClick={() => {
                          onOverridePoints(row.id, null);
                          closePoints(row.id);
                        }}
                        title="Remove override and go back to normal scoring"
                      >
                        Undo
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        className="px-2 py-1 rounded border text-xs hover:bg-gray-100 disabled:opacity-50"
                        onClick={() => closePoints(row.id)}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
