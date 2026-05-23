'use client';

import { SailNumberDisplay } from '@/components/ui/SailNumberDisplay';
import type { ApiResult } from '../../types';
import { isAutoNPlusOne } from './shared';
import ScoringCodeSelector from './ScoringCodeSelector';
import notify from '@/lib/notify';

type CodeGroups = {
  autoDiscardable: string[];
  autoNonDiscardable: string[];
  adjustable: string[];
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
  codeBadgeTitle?: (row: ApiResult) => string | undefined;
  clearPending: (rowId: number) => void;
  openChangeTo: (rowId: number, currentPos: number) => void;
  closeChangeTo: (rowId: number) => void;
  openPoints: (row: ApiResult) => void;
  closePoints: (rowId: number) => void;
  setPendingCode: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  setPendingPoints: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  setChangeToValue: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  setPointsValue: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  onMarkCode: (
    rowId: number,
    code: string | null,
    points?: number | null,
    shiftsPlacesBehind?: boolean,
    discardable?: boolean
  ) => void;
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
  codeBadgeTitle,
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
      <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-sm">
        <table className="min-w-full border-collapse text-sm text-slate-800">
          <thead className="bg-slate-50/95 sticky top-0 z-10 backdrop-blur-sm shadow-[0_1px_0_0_rgb(226_232_240)]">
            <tr>
              <th className="border-b border-slate-200 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Sail
              </th>
              {showFleetColumn ? (
                <th className="border-b border-slate-200 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 whitespace-nowrap">
                  Fleet
                </th>
              ) : null}
              <th className="border-b border-slate-200 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Crew
              </th>
              <th className="border-b border-slate-200 px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">
                Position
              </th>
              <th className="border-b border-slate-200 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Code
              </th>
              <th className="border-b border-slate-200 px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, idx) => {
              const rowBg =
                idx % 2 === 0 ? 'bg-white hover:bg-slate-50/80' : 'bg-slate-50/40 hover:bg-slate-100/60';
              const codeUpper = row.code ? row.code.trim().toUpperCase() : null;
              const maxPos = sorted.length;
              const isChangeOpen = !!changeToOpen[row.id];
              const rawVal = changeToValue[row.id] ?? '';
              const ptsIsOpen = !!pointsOpen[row.id];
              const rawPtsVal = pointsValue[row.id] ?? '';
              const hasOverride = row.points_override != null;
              const lockedByCode = isAutoNPlusOne(codeUpper);
              return (
                <tr key={row.id} className={rowBg}>
                  <td className="border-b border-slate-100 px-3 py-2.5 align-middle">
                    <div className="flex items-center gap-2">
                      <SailNumberDisplay countryCode={row.boat_country_code} sailNumber={row.sail_number} />
                      {row.code ? (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-700"
                          title={codeBadgeTitle?.(row) ?? 'Code + value'}
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
                    <td className="border-b border-slate-100 px-3 py-2.5 align-middle text-sm text-gray-800 font-medium">
                      {fleetLabelForRow?.(row) ?? '—'}
                    </td>
                  ) : null}
                  <td className="border-b border-slate-100 px-3 py-2.5 align-middle">{resolveCrew(row)}</td>
                  <td className="border-b border-slate-100 px-3 py-2.5 align-middle text-center">
                    <input
                      type="number"
                      min={1}
                      className="w-24 border rounded px-2 py-1 text-center"
                      value={row.position}
                      disabled
                      readOnly
                    />
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2.5 align-middle">
                    <ScoringCodeSelector
                      row={row}
                      loading={loading}
                      codeGroups={codeGroups}
                      pendingCode={pendingCode}
                      pendingPoints={pendingPoints}
                      setPendingCode={setPendingCode}
                      setPendingPoints={setPendingPoints}
                      clearPending={clearPending}
                      onMarkCode={onMarkCode}
                      showPointsSummary
                    />
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2.5 align-middle text-right">
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
      </div>
    </>
  );
}
