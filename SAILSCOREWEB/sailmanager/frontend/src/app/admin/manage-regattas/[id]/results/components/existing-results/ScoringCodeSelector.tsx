'use client';

import { useState } from 'react';
import notify from '@/lib/notify';
import { CUSTOM_TEMPLATE_CODE, normalizeCustomCodeName } from './scoringCodeMap';
import {
  AUTO_N1_DISCARDABLE_TEMPLATE,
  AUTO_N1_NON_DISCARDABLE_TEMPLATE,
  buildPrpCode,
  extractPrpName,
  isAdjustable,
  isAutoN1DiscardableTemplate,
  isAutoN1NonDiscardableTemplate,
  isAutoN1TemplatePending,
  isAutoNPlusOne,
  isCustomPenaltyCode,
  isPrpCode,
  PRP_TEMPLATE_CODE,
} from './shared';
import type { ApiResult } from '../../types';

export type ScoringCodeGroups = {
  autoDiscardable: string[];
  autoNonDiscardable: string[];
  adjustable: string[];
};

type Props = {
  row: ApiResult;
  loading: boolean;
  codeGroups: ScoringCodeGroups;
  pendingCode: Record<number, string>;
  pendingPoints: Record<number, string>;
  setPendingCode: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  setPendingPoints: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  clearPending: (rowId: number) => void;
  onMarkCode: (
    rowId: number,
    code: string | null,
    points?: number | null,
    shiftsPlacesBehind?: boolean,
    discardable?: boolean
  ) => void;
  /** Mostrar "points: X" ao lado do select (One Design). */
  showPointsSummary?: boolean;
};

export default function ScoringCodeSelector({
  row,
  loading,
  codeGroups,
  pendingCode,
  pendingPoints,
  setPendingCode,
  setPendingPoints,
  clearPending,
  onMarkCode,
  showPointsSummary = false,
}: Props) {
  const [pendingPenaltyName, setPendingPenaltyName] = useState<Record<number, string>>({});
  const [pendingCustomName, setPendingCustomName] = useState<Record<number, string>>({});
  const [pendingCustomShifts, setPendingCustomShifts] = useState<Record<number, boolean>>({});
  const [pendingCustomDiscardable, setPendingCustomDiscardable] = useState<Record<number, boolean>>(
    {}
  );

  const codeUpper = row.code ? row.code.trim().toUpperCase() : null;
  const pending = pendingCode[row.id];
  const isPrpPending = pending === PRP_TEMPLATE_CODE || isPrpCode(pending);
  const isCustomPending = pending === CUSTOM_TEMPLATE_CODE;
  const isAutoN1Pending = isAutoN1TemplatePending(pending);
  const showAdjustBox =
    !!pending && (isAdjustable(pending) || isPrpPending || isCustomPending);
  const hasOverride = row.points_override != null;

  const activePrpCode = isPrpCode(row.code) ? String(row.code).trim() : null;
  const activePrpLabel = activePrpCode ? extractPrpName(activePrpCode) || activePrpCode : null;

  const selectValue = (() => {
    if (isAutoN1TemplatePending(pending)) return pending!;
    if (pending === CUSTOM_TEMPLATE_CODE) return CUSTOM_TEMPLATE_CODE;
    if (pending === PRP_TEMPLATE_CODE || isPrpCode(pending)) return PRP_TEMPLATE_CODE;
    if (activePrpCode) return activePrpCode;
    return codeUpper ?? '';
  })();

  const showCurrentCodeAsOption =
    !!codeUpper &&
    !isPrpCode(codeUpper) &&
    !isAutoN1TemplatePending(codeUpper) &&
    codeUpper !== CUSTOM_TEMPLATE_CODE &&
    codeUpper !== PRP_TEMPLATE_CODE &&
    (isAutoNPlusOne(codeUpper) ||
      isAdjustable(codeUpper) ||
      isCustomPenaltyCode(codeUpper));

  const handleMainChange = (raw: string) => {
    const next = raw ? raw.toUpperCase() : null;

    if (!next) {
      clearPending(row.id);
      onMarkCode(row.id, null, null);
      return;
    }

    if (
      next === AUTO_N1_DISCARDABLE_TEMPLATE ||
      next === AUTO_N1_NON_DISCARDABLE_TEMPLATE ||
      isAdjustable(next) ||
      next === PRP_TEMPLATE_CODE ||
      isPrpCode(next) ||
      next === CUSTOM_TEMPLATE_CODE
    ) {
      setPendingPenaltyName((p) => ({ ...p, [row.id]: extractPrpName(row.code) || '' }));
      setPendingCode((p) => ({ ...p, [row.id]: next }));
      if (isAdjustable(next) || isPrpCode(next) || next === PRP_TEMPLATE_CODE) {
        setPendingPoints((p) => ({ ...p, [row.id]: '' }));
      }
      if (next === CUSTOM_TEMPLATE_CODE) {
        setPendingPoints((p) => ({ ...p, [row.id]: '' }));
        setPendingCustomName((p) => ({
          ...p,
          [row.id]: isCustomPenaltyCode(row.code) ? (row.code ?? '') : '',
        }));
        setPendingCustomShifts((p) => ({
          ...p,
          [row.id]: !!row.code_shifts_places,
        }));
        setPendingCustomDiscardable((p) => ({
          ...p,
          [row.id]: row.code_discardable !== false,
        }));
      }
      return;
    }

    clearPending(row.id);
    onMarkCode(row.id, next, null);
  };

  const autoN1Codes = isAutoN1DiscardableTemplate(pending)
    ? codeGroups.autoDiscardable
    : isAutoN1NonDiscardableTemplate(pending)
      ? codeGroups.autoNonDiscardable
      : [];

  const showFinishOrder =
    !!codeUpper &&
    (isAutoNPlusOne(codeUpper) || row.code_shifts_places) &&
    row.finish_position != null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <select
          className="border rounded px-2 py-1"
          value={selectValue}
          disabled={loading}
          onChange={(ev) => handleMainChange((ev.target.value || '').trim())}
          aria-label="Scoring code"
        >
          <option value="">(none)</option>
          {activePrpCode && activePrpLabel ? (
            <option value={activePrpCode}>{activePrpLabel}</option>
          ) : null}
          {showCurrentCodeAsOption ? <option value={codeUpper!}>{codeUpper}</option> : null}
          <optgroup label="Auto (N+1)">
            <option value={AUTO_N1_DISCARDABLE_TEMPLATE}>N+1 — discardable…</option>
            <option value={AUTO_N1_NON_DISCARDABLE_TEMPLATE}>N+1 — non-discardable…</option>
          </optgroup>
          <optgroup label="Adjustable (requires value)">
            {codeGroups.adjustable.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </optgroup>
          <optgroup label="Penalty (name + percentage)">
            <option value={PRP_TEMPLATE_CODE}>Choose penalty name + percentage</option>
          </optgroup>
          <optgroup label="Custom (name + points per result)">
            <option value={CUSTOM_TEMPLATE_CODE}>Create custom code…</option>
          </optgroup>
        </select>
        {showPointsSummary ? (
          <span className="text-xs text-gray-500">
            points: <b>{row.points}</b>
            {hasOverride ? <span className="ml-1">(override: {row.points_override})</span> : null}
          </span>
        ) : null}
      </div>

      {showFinishOrder ? (
        <span className="text-[10px] text-gray-500" title="Stored finish order — used when the code is removed">
          Finish: {row.finish_position}
        </span>
      ) : null}

      {isAutoN1Pending && (
        <div className="flex flex-wrap items-center gap-2 bg-gray-50 border rounded p-2">
          <span className="text-xs text-gray-600">
            {isAutoN1DiscardableTemplate(pending) ? 'N+1 discardable' : 'N+1 non-discardable'}
          </span>
          <select
            key={`n1-${row.id}-${pending}`}
            className="border rounded px-2 py-1 text-sm"
            defaultValue=""
            disabled={loading}
            onChange={(ev) => {
              const code = (ev.target.value || '').trim().toUpperCase();
              if (!code) return;
              onMarkCode(row.id, code, null);
              clearPending(row.id);
            }}
            aria-label="Choose N+1 code"
          >
            <option value="">Choose code…</option>
            {autoN1Codes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="ml-auto px-2 py-1 rounded border text-xs hover:bg-gray-100"
            onClick={() => clearPending(row.id)}
          >
            Cancel
          </button>
        </div>
      )}

      {showAdjustBox && (
        <div className="flex flex-wrap items-center gap-2 bg-gray-50 border rounded p-2">
          <span className="text-xs text-gray-600 w-20">
            {isPrpPending ? 'Penalty' : isCustomPending ? 'Custom' : pendingCode[row.id]}
          </span>
          {isCustomPending && (
            <>
              <input
                type="text"
                className="border rounded px-2 py-1 w-36 uppercase"
                value={pendingCustomName[row.id] ?? ''}
                placeholder="Code name"
                onChange={(e) =>
                  setPendingCustomName((p) => ({ ...p, [row.id]: e.target.value }))
                }
              />
              <label
                className="inline-flex items-center gap-1 text-xs text-gray-700 max-w-[220px]"
                title="When enabled, this boat leaves the finish order and boats behind move up one place."
              >
                <input
                  type="checkbox"
                  checked={pendingCustomShifts[row.id] === true}
                  onChange={(e) =>
                    setPendingCustomShifts((p) => ({
                      ...p,
                      [row.id]: e.target.checked,
                    }))
                  }
                />
                Shift places behind
              </label>
              <label
                className="inline-flex items-center gap-1 text-xs text-gray-700"
                title="When disabled, this result will not be considered for discards in overall."
              >
                <input
                  type="checkbox"
                  checked={pendingCustomDiscardable[row.id] !== false}
                  onChange={(e) =>
                    setPendingCustomDiscardable((p) => ({
                      ...p,
                      [row.id]: e.target.checked,
                    }))
                  }
                />
                Discardable
              </label>
            </>
          )}
          {isPrpPending && (
            <input
              type="text"
              className="border rounded px-2 py-1 w-40"
              value={pendingPenaltyName[row.id] ?? ''}
              placeholder="Name"
              onChange={(e) => setPendingPenaltyName((p) => ({ ...p, [row.id]: e.target.value }))}
            />
          )}
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            className="border rounded px-2 py-1 w-32"
            value={pendingPoints[row.id] ?? ''}
            placeholder={
              isPrpPending ? 'ex: 50 (% of N+1 to add)' : isCustomPending ? 'ex: 10 (points)' : 'ex: 4.5'
            }
            onChange={(e) => setPendingPoints((p) => ({ ...p, [row.id]: e.target.value }))}
          />
          <button
            type="button"
            className="px-2 py-1 rounded bg-blue-600 text-white text-xs hover:bg-blue-700"
            onClick={async () => {
              const code = pendingCode[row.id];
              const rawPts = (pendingPoints[row.id] ?? '').trim();
              const pts = Number(rawPts);
              if (!Number.isFinite(pts) || pts < 0) {
                notify.warning(
                  isPrpPending ? 'Invalid value (percentage).' : 'Invalid value (points).'
                );
                return;
              }
              if (isPrpPending) {
                const name = (pendingPenaltyName[row.id] ?? '').trim();
                if (!name) {
                  notify.warning('Please set a penalty name.');
                  return;
                }
                onMarkCode(row.id, buildPrpCode(name), pts);
              } else if (isCustomPending) {
                const name = (pendingCustomName[row.id] ?? '').trim();
                if (!name) {
                  notify.warning('Please set a code name.');
                  return;
                }
                let customCode: string;
                try {
                  customCode = normalizeCustomCodeName(name);
                } catch (e: unknown) {
                  notify.warning(e instanceof Error ? e.message : 'Invalid code name.');
                  return;
                }
                onMarkCode(
                  row.id,
                  customCode,
                  pts,
                  pendingCustomShifts[row.id] === true,
                  pendingCustomDiscardable[row.id] !== false
                );
              } else {
                onMarkCode(row.id, code, pts);
              }
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
  );
}
