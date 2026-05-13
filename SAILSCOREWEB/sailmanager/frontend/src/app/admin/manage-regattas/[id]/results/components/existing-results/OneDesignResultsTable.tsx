'use client';

import { SailNumberDisplay } from '@/components/ui/SailNumberDisplay';
import type { ApiResult } from '../../types';
import { isAdjustable, isAutoNPlusOne } from './shared';
import notify from '@/lib/notify';

type CodeGroups = {
  autoDiscardable: string[];
  autoNonDiscardable: string[];
  adjustable: string[];
  custom: string[];
};

interface Props {
  sorted: ApiResult[];
  loading: boolean;
  /** Corridas com fleet set: cada frota tem posição/pontos 1,2,3… em separado. */
  showFleetColumn?: boolean;
  fleetLabelForRow?: (row: ApiResult) => string | null;
  codeGroups: CodeGroups;
  pendingCode: Record<number, string>;
  pendingPoints: Record<number, string>;
  changeToOpen: Record<number, boolean>;
  changeToValue: Record<number, string>;
  pointsOpen: Record<number, boolean>;
  pointsValue: Record<number, string>;
  resolveCrew: (row: ApiResult) => string;
  formatCodeWithValue: (row: ApiResult) => string;
  clearPending: (rowId: number) => void;
  openChangeTo: (rowId: number, currentPos: number) => void;
  closeChangeTo: (rowId: number) => void;
  openPoints: (row: ApiResult) => void;
  closePoints: (rowId: number) => void;
  setPendingCode: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  setPendingPoints: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  setChangeToValue: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  setPointsValue: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  onMarkCode: (rowId: number, code: string | null, points?: number | null) => void;
  onEditPos: (rowId: number, newPos: number) => void;
  onOverridePoints: (rowId: number, points: number | null) => void;
}

export default function OneDesignResultsTable({
  sorted,
  loading,
  showFleetColumn = false,
  fleetLabelForRow,
  codeGroups,
  pendingCode,
  pendingPoints,
  changeToOpen,
  changeToValue,
  pointsOpen,
  pointsValue,
  resolveCrew,
  formatCodeWithValue,
  clearPending,
  openChangeTo,
  closeChangeTo,
  openPoints,
  closePoints,
  setPendingCode,
  setPendingPoints,
  setChangeToValue,
  setPointsValue,
  onMarkCode,
  onEditPos,
  onOverridePoints,
}: Props) {
  return (
    <>
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100 sticky top-0 z-10">
          <tr>
            <th className="border px-2 py-2 text-left">Sail</th>
            {showFleetColumn ? (
              <th className="border px-2 py-2 text-left whitespace-nowrap">Fleet</th>
            ) : null}
            <th className="border px-2 py-2 text-left">Crew</th>
            <th className="border px-2 py-2 text-center">Position</th>
            <th className="border px-2 py-2 text-left">Code</th>
            <th className="border px-2 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, idx) => {
            const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50';
            const codeUpper = row.code ? row.code.toUpperCase() : null;
            const showAdjustBox = !!pendingCode[row.id] && isAdjustable(pendingCode[row.id]);
            const maxPos = sorted.length;
            const isChangeOpen = !!changeToOpen[row.id];
            const rawVal = changeToValue[row.id] ?? '';
            const ptsIsOpen = !!pointsOpen[row.id];
            const rawPtsVal = pointsValue[row.id] ?? '';
            const hasOverride = row.points_override != null;
            const lockedByCode = isAutoNPlusOne(codeUpper);

            return (
              <tr key={row.id} className={rowBg}>
                <td className="border px-2 py-2">
                  <div className="flex items-center gap-2">
                    <SailNumberDisplay countryCode={row.boat_country_code} sailNumber={row.sail_number} />
                    {row.code ? (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-700"
                        title="Code + value"
                      >
                        {formatCodeWithValue(row)}
                      </span>
                    ) : null}
                    {hasOverride ? (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-900 border border-yellow-200"
                        title="Points override"
                      >
                        OVR
                      </span>
                    ) : null}
                  </div>
                </td>
                {showFleetColumn ? (
                  <td className="border px-2 py-2 text-sm text-gray-800 font-medium">
                    {fleetLabelForRow?.(row) ?? '—'}
                  </td>
                ) : null}
                <td className="border px-2 py-2">{resolveCrew(row)}</td>
                <td className="border px-2 py-2 text-center">
                  <input
                    type="number"
                    min={1}
                    className="w-24 border rounded px-2 py-1 text-center"
                    value={row.position}
                    disabled
                    readOnly
                  />
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
                      <span className="text-xs text-gray-500">
                        points: <b>{row.points}</b>
                        {hasOverride ? <span className="ml-1">(override: {row.points_override})</span> : null}
                      </span>
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
                          onChange={(e) =>
                            setPendingPoints((p) => ({ ...p, [row.id]: e.target.value }))
                          }
                        />
                        <button
                          type="button"
                          className="px-2 py-1 rounded bg-blue-600 text-white text-xs hover:bg-blue-700"
                          onClick={() => {
                            const code = pendingCode[row.id];
                            const rawPts = (pendingPoints[row.id] ?? '').trim();
                            const pts = Number(rawPts);
                            if (!Number.isFinite(pts)) {
                              notify.warning('Invalid value (points).');
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
                    {!isChangeOpen ? (
                      <button
                        disabled={loading || lockedByCode}
                        onClick={() => openChangeTo(row.id, row.position)}
                        className="px-2 py-1 rounded border hover:bg-gray-100 disabled:opacity-50 text-xs"
                        title="Move this result to a specific position"
                      >
                        Change to
                      </button>
                    ) : (
                      <div className="inline-flex items-center gap-1">
                        <input
                          type="number"
                          min={1}
                          max={maxPos}
                          className="w-16 border rounded px-2 py-1 text-center text-xs"
                          value={rawVal}
                          onChange={(e) =>
                            setChangeToValue((p) => ({ ...p, [row.id]: e.target.value }))
                          }
                        />
                        <button
                          type="button"
                          disabled={loading}
                          className="px-2 py-1 rounded bg-blue-600 text-white text-xs hover:bg-blue-700 disabled:opacity-50"
                          onClick={() => {
                            const v = Math.max(1, Math.min(maxPos, Number(rawVal) || 1));
                            onEditPos(row.id, v);
                            closeChangeTo(row.id);
                          }}
                        >
                          Apply
                        </button>
                        <button
                          type="button"
                          disabled={loading}
                          className="px-2 py-1 rounded border text-xs hover:bg-gray-100 disabled:opacity-50"
                          onClick={() => closeChangeTo(row.id)}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
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
                          onChange={(e) =>
                            setPointsValue((p) => ({ ...p, [row.id]: e.target.value }))
                          }
                        />
                        <button
                          type="button"
                          disabled={loading}
                          className="px-2 py-1 rounded bg-blue-600 text-white text-xs hover:bg-blue-700 disabled:opacity-50"
                          onClick={() => {
                            const raw = (rawPtsVal ?? '').trim();
                            const pts = Number(raw);
                            if (!Number.isFinite(pts) || pts < 0) {
                              notify.warning('Invalid value (points).');
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
    </>
  );
}
