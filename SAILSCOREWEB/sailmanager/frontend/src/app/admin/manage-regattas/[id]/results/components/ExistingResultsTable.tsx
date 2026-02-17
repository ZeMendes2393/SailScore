// src/app/admin/manage-regattas/[id]/results/components/ExistingResultsTable.tsx
'use client';

import { useMemo, useState } from 'react';
import type { ApiResult } from '../types';
import { SailNumberDisplay } from '@/components/ui/SailNumberDisplay';

interface Props {
  results?: ApiResult[];
  loading: boolean;
  onMove: (rowId: number, delta: -1 | 1) => void;
  onEditPos: (rowId: number, newPos: number) => void;
  onSaveOrder: () => void;
  onDelete: (rowId: number) => void;

  scoringCodes?: Record<string, number>;

  onMarkCode: (rowId: number, code: string | null, points?: number | null) => void;

  // ✅ agora permite null para UNDO
  onOverridePoints: (rowId: number, points: number | null) => void;
}

// --- Sets fixos do sistema ---
const AUTO_N_PLUS_ONE_DISCARDABLE = ['DNC', 'DNF', 'DNS', 'OCS', 'UFD', 'BFD', 'DSQ', 'RET', 'NSC'] as const;
const AUTO_N_PLUS_ONE_NON_DISCARDABLE = ['DNE', 'DGM'] as const;

const AUTO_N_PLUS_ONE = new Set<string>([
  ...AUTO_N_PLUS_ONE_DISCARDABLE,
  ...AUTO_N_PLUS_ONE_NON_DISCARDABLE,
]);

const ADJUSTABLE_CODES = ['RDG', 'SCP', 'ZPF', 'DPI'] as const;

const isAdjustable = (c: string | null | undefined) =>
  !!c && (ADJUSTABLE_CODES as readonly string[]).includes(c);

const isAutoNPlusOne = (c: string | null | undefined) => !!c && AUTO_N_PLUS_ONE.has(String(c).toUpperCase());

export default function ExistingResultsTable({
  results,
  loading,
  onMove,
  onEditPos,
  onSaveOrder,
  onDelete,
  scoringCodes,
  onMarkCode,
  onOverridePoints,
}: Props) {
  const safeResults = Array.isArray(results) ? results : [];
  const customMap = scoringCodes ?? {};

  const sorted = useMemo(
    () => safeResults.slice().sort((a, b) => a.position - b.position),
    [safeResults]
  );

  const codeGroups = useMemo(() => {
    const custom = Object.keys(customMap)
      .map((x) => x.toUpperCase())
      .filter(
        (c) =>
          !AUTO_N_PLUS_ONE.has(c) &&
          !(ADJUSTABLE_CODES as readonly string[]).includes(c)
      )
      .sort();

    return {
      autoDiscardable: [...AUTO_N_PLUS_ONE_DISCARDABLE],
      autoNonDiscardable: [...AUTO_N_PLUS_ONE_NON_DISCARDABLE],
      adjustable: [...ADJUSTABLE_CODES],
      custom,
    };
  }, [customMap]);

  const [pendingCode, setPendingCode] = useState<Record<number, string>>({});
  const [pendingPoints, setPendingPoints] = useState<Record<number, string>>({});

  const clearPending = (rowId: number) => {
    setPendingCode((prev) => {
      const n = { ...prev };
      delete n[rowId];
      return n;
    });
    setPendingPoints((prev) => {
      const n = { ...prev };
      delete n[rowId];
      return n;
    });
  };

  const formatCodeWithValue = (row: ApiResult) => {
    const c = (row.code || '').toUpperCase();
    if (!c) return '';
    const ptsStr = Number.isFinite(Number(row.points)) ? String(row.points) : '';
    return ptsStr ? `${c} ${ptsStr}` : c;
  };

  // Change-to UI
  const [changeToOpen, setChangeToOpen] = useState<Record<number, boolean>>({});
  const [changeToValue, setChangeToValue] = useState<Record<number, string>>({});

  const openChangeTo = (rowId: number, currentPos: number) => {
    setChangeToOpen((p) => ({ ...p, [rowId]: true }));
    setChangeToValue((p) => ({ ...p, [rowId]: String(currentPos) }));
  };

  const closeChangeTo = (rowId: number) => {
    setChangeToOpen((p) => {
      const n = { ...p };
      delete n[rowId];
      return n;
    });
    setChangeToValue((p) => {
      const n = { ...p };
      delete n[rowId];
      return n;
    });
  };

  // Override points UI
  const [pointsOpen, setPointsOpen] = useState<Record<number, boolean>>({});
  const [pointsValue, setPointsValue] = useState<Record<number, string>>({});

  const openPoints = (row: ApiResult) => {
    setPointsOpen((p) => ({ ...p, [row.id]: true }));

    // ✅ se já existe override, mostra o override no input
    const seed = row.points_override != null ? row.points_override : row.points;
    setPointsValue((p) => ({ ...p, [row.id]: String(seed ?? '') }));
  };

  const closePoints = (rowId: number) => {
    setPointsOpen((p) => {
      const n = { ...p };
      delete n[rowId];
      return n;
    });
    setPointsValue((p) => {
      const n = { ...p };
      delete n[rowId];
      return n;
    });
  };

  if (loading) return <p className="p-4 text-gray-500">Loading…</p>;
  if (sorted.length === 0) return <p className="p-4 text-gray-500">No saved results for this race.</p>;

  return (
    <>
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100 sticky top-0 z-10">
          <tr>
            <th className="border px-2 py-2 text-left">Sail</th>
            <th className="border px-2 py-2 text-left">Skipper</th>
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

            // ✅ só bloqueia ações quando é N+1 (DNC/DNF/...)
            const lockedByCode = isAutoNPlusOne(codeUpper);

            return (
              <tr key={row.id} className={rowBg}>
                <td className="border px-2 py-2">
                  <div className="flex items-center gap-2">
                    <SailNumberDisplay countryCode={row.boat_country_code} sailNumber={row.sail_number} />

                    {/* badge do code (se existir) */}
                    {row.code ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-700" title="Code + value">
                        {formatCodeWithValue(row)}
                      </span>
                    ) : null}

                    {/* ✅ badge de override */}
                    {hasOverride ? (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-900 border border-yellow-200"
                        title="Pontos com override"
                      >
                        OVR
                      </span>
                    ) : null}
                  </div>
                </td>

                <td className="border px-2 py-2">{row.skipper_name}</td>

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

                          // (opcional) se mudares code, podes querer limpar override
                          // onOverridePoints(row.id, null);

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
                        aria-label="Código de pontuação"
                      >
                        <option value="">(nenhum)</option>

                        <optgroup label="Auto (N+1) — discardable">
                          {codeGroups.autoDiscardable.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </optgroup>

                        <optgroup label="Auto (N+1) — NÃO discardable">
                          {codeGroups.autoNonDiscardable.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </optgroup>

                        <optgroup label="Ajustável (pede valor)">
                          {codeGroups.adjustable.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </optgroup>

                        {codeGroups.custom.length > 0 && (
                          <optgroup label="Custom (fixos)">
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
                    {/* Change to */}
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
                          onChange={(e) => setChangeToValue((p) => ({ ...p, [row.id]: e.target.value }))}
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

                    {/* Override points + Undo */}
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

                        {/* ✅ UNDO: limpar override */}
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

                    <button
                      disabled={loading}
                      onClick={() => {
                        if (confirm('Delete this result? Following positions will be adjusted.')) onDelete(row.id);
                      }}
                      className="px-2 py-1 rounded border hover:bg-red-50 text-red-600 disabled:opacity-50"
                      title="Delete"
                    >
                      🗑
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="sticky bottom-0 bg-white/80 backdrop-blur border-t p-2 text-right">
        <button
          disabled={loading}
          onClick={onSaveOrder}
          className="text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded disabled:opacity-50"
        >
          Save order
        </button>
      </div>
    </>
  );
}
