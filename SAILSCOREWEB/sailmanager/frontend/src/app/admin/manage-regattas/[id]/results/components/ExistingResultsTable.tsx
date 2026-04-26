// src/app/admin/manage-regattas/[id]/results/components/ExistingResultsTable.tsx
'use client';

import { useCallback, useMemo, useState } from 'react';
import type { ApiResult } from '../types';
import type { Entry } from '../types';
import HandicapResultsTable from './existing-results/HandicapResultsTable';
import OneDesignResultsTable from './existing-results/OneDesignResultsTable';
import {
  ADJUSTABLE_CODES,
  AUTO_N_PLUS_ONE,
  AUTO_N_PLUS_ONE_DISCARDABLE,
  AUTO_N_PLUS_ONE_NON_DISCARDABLE,
  formatDelta,
  getEffectiveHandicapRating,
  isAutoNPlusOne,
  parseTimeToSeconds,
  type OrcRatingMode,
} from './existing-results/shared';

interface ExistingResultsTableProps {
  results?: ApiResult[];
  entries?: Entry[];
  /** Quando a corrida tem fleet set: nome da frota por entry (para mostrar que posição/pontos são por frota). */
  fleetNameByEntryId?: ReadonlyMap<number, string>;
  loading: boolean;
  onMove: (rowId: number, delta: -1 | 1) => void;
  onEditPos: (rowId: number, newPos: number) => void;
  onDelete: (rowId: number) => void;

  scoringCodes?: Record<string, number>;

  onMarkCode: (rowId: number, code: string | null, points?: number | null) => void;

  // ✅ agora permite null para UNDO
  onOverridePoints: (rowId: number, points: number | null) => void;

  // Quando true, mostra layout expandido para Handicap (tempo)
  isHandicapClass?: boolean;
  onUpdateHandicapResult?: (
    rowId: number,
    data: {
      finish_day: number | null;
      finish_time: string | null;
      elapsed_time: string | null;
      corrected_time: string | null;
    }
  ) => void | Promise<void>;
  raceStartTime?: string | null;
  handicapMethod?: string | null;
  orcRatingMode?: 'low' | 'medium' | 'high' | string | null;
}

export default function ExistingResultsTable({
  results,
  entries = [],
  fleetNameByEntryId,
  loading,
  onEditPos,
  scoringCodes,
  onMarkCode,
  onOverridePoints,
  isHandicapClass = false,
  onUpdateHandicapResult,
  raceStartTime = '',
  handicapMethod = 'manual',
  orcRatingMode = 'medium',
}: ExistingResultsTableProps) {
  const normalizedEntries = useMemo(
    () => (Array.isArray(entries) ? entries : []),
    [entries]
  );
  const normalizeText = (v: string | null | undefined) => (v ?? '').trim().toUpperCase();
  const boatKeyFromParts = (
    sailNumber?: string | null,
    boatCountryCode?: string | null,
    boatName?: string | null,
    className?: string | null
  ) =>
    `${normalizeText(sailNumber)}|${normalizeText(boatCountryCode)}|${normalizeText(
      boatName
    )}|${normalizeText(className)}`;
  const boatLooseKeyFromParts = (
    sailNumber?: string | null,
    boatCountryCode?: string | null,
    className?: string | null
  ) => `${normalizeText(sailNumber)}|${normalizeText(boatCountryCode)}|${normalizeText(className)}`;
  const sailClassKeyFromParts = (sailNumber?: string | null, className?: string | null) =>
    `${normalizeText(sailNumber)}|${normalizeText(className)}`;
  const crewByBoatKey = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const e of normalizedEntries) {
      const helmName = `${(e.first_name ?? '').trim()} ${(e.last_name ?? '').trim()}`.trim();
      const crewNames = Array.isArray(e.crew_members)
        ? e.crew_members
            .map((m) => `${(m?.first_name ?? '').trim()} ${(m?.last_name ?? '').trim()}`.trim())
            .filter(Boolean)
        : [];
      const allBoatNames = [helmName, ...crewNames].filter(Boolean);
      if (allBoatNames.length === 0) continue;
      const keys = [
        boatKeyFromParts(e.sail_number, e.boat_country_code, e.boat_name, e.class_name),
        boatLooseKeyFromParts(e.sail_number, e.boat_country_code, e.class_name),
        sailClassKeyFromParts(e.sail_number, e.class_name),
      ];
      for (const key of keys) {
        if (!key.replace(/\|/g, '')) continue;
        const existing = map.get(key) ?? [];
        for (const personName of allBoatNames) {
          if (!existing.some((n) => n.toUpperCase() === personName.toUpperCase())) {
            existing.push(personName);
          }
        }
        map.set(key, existing);
      }
    }
    return map;
  }, [normalizedEntries]);
  const resolveCrew = (row: ApiResult) => {
    const keys = [
      boatKeyFromParts(row.sail_number, row.boat_country_code, row.boat_name, row.class_name),
      boatLooseKeyFromParts(row.sail_number, row.boat_country_code, row.class_name),
      sailClassKeyFromParts(row.sail_number, row.class_name),
    ];
    const names = keys.map((k) => crewByBoatKey.get(k) ?? []).find((arr) => arr.length > 0) ?? [];
    if (names.length > 0) return names.join(', ');
    return row.skipper_name || '—';
  };

  const entryByKeys = useMemo(() => {
    const map = new Map<string, Entry>();
    for (const e of normalizedEntries) {
      const keys = [
        boatKeyFromParts(e.sail_number, e.boat_country_code, e.boat_name, e.class_name),
        boatLooseKeyFromParts(e.sail_number, e.boat_country_code, e.class_name),
        sailClassKeyFromParts(e.sail_number, e.class_name),
      ];
      for (const k of keys) {
        if (!k.replace(/\|/g, '')) continue;
        if (!map.has(k)) map.set(k, e);
      }
    }
    return map;
  }, [normalizedEntries]);

  const resolveEntryForResult = useCallback(
    (row: ApiResult): Entry | undefined => {
      const keys = [
        boatKeyFromParts(row.sail_number, row.boat_country_code, row.boat_name, row.class_name),
        boatLooseKeyFromParts(row.sail_number, row.boat_country_code, row.class_name),
        sailClassKeyFromParts(row.sail_number, row.class_name),
      ];
      for (const k of keys) {
        const e = entryByKeys.get(k);
        if (e) return e;
      }
      return undefined;
    },
    [entryByKeys]
  );

  const fleetLabelForRow = useCallback(
    (row: ApiResult): string | null => {
      if (!fleetNameByEntryId?.size) return null;
      const entry = resolveEntryForResult(row);
      if (!entry) return null;
      return fleetNameByEntryId.get(entry.id) ?? null;
    },
    [fleetNameByEntryId, resolveEntryForResult]
  );

  const getEffectiveRatingForRow = useCallback(
    (row: ApiResult): number | null => {
      const method = (handicapMethod || 'manual').toLowerCase();
      const entry = resolveEntryForResult(row);
      const raw = (orcRatingMode ?? 'medium').toString().toLowerCase();
      const orcMode = (raw === 'low' || raw === 'high' ? raw : 'medium') as OrcRatingMode;
      const fromEntry = getEffectiveHandicapRating(entry, method, orcMode);
      if (fromEntry != null) return fromEntry;
      const r = row.rating;
      return typeof r === 'number' && !Number.isNaN(r) ? r : null;
    },
    [resolveEntryForResult, handicapMethod, orcRatingMode]
  );

  const safeResults = Array.isArray(results) ? results : [];
  const customMap = scoringCodes ?? {};

  const sorted = useMemo(() => {
    const base = safeResults.slice();
    if (!fleetNameByEntryId?.size) {
      return base.sort((a, b) => a.position - b.position);
    }
    return base.sort((a, b) => {
      const fa = fleetLabelForRow(a) ?? '\uFFFF';
      const fb = fleetLabelForRow(b) ?? '\uFFFF';
      if (fa !== fb) return fa.localeCompare(fb);
      return a.position - b.position;
    });
  }, [safeResults, fleetNameByEntryId, fleetLabelForRow]);

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
  const [handicapEdits, setHandicapEdits] = useState<
    Record<
      number,
      {
        finish_day: string;
        finish_time: string;
        elapsed_time: string;
        corrected_time: string;
      }
    >
  >({});

  const getHandicapEdit = (row: ApiResult) =>
    handicapEdits[row.id] ?? {
      finish_day: row.finish_day == null ? '' : String(row.finish_day),
      finish_time: row.finish_time ?? '',
      elapsed_time: row.elapsed_time ?? '',
      corrected_time: row.corrected_time ?? '',
    };

  const setHandicapEditField = (
    rowId: number,
    field: 'finish_day' | 'finish_time' | 'elapsed_time' | 'corrected_time',
    value: string
  ) => {
    setHandicapEdits((prev) => ({
      ...prev,
      [rowId]: {
        ...(prev[rowId] ?? {
          finish_day: '',
          finish_time: '',
          elapsed_time: '',
          corrected_time: '',
        }),
        [field]: value,
      },
    }));
  };

  const handicapRankingPreviewById = useMemo(() => {
    if (!isHandicapClass || sorted.length === 0) return new Map<number, { position: number; delta: string; points: number }>();

    const rankedRows = sorted
      .map((row) => {
        const he = handicapEdits[row.id];
        const corrected = (he?.corrected_time ?? row.corrected_time ?? '').trim();
        const code = (row.code ?? '').toUpperCase();
        return { id: row.id, corrected, code };
      })
      .filter((r) => !isAutoNPlusOne(r.code));

    const nonRanked = sorted
      .map((row) => ({ id: row.id, code: (row.code ?? '').toUpperCase() }))
      .filter((r) => isAutoNPlusOne(r.code));

    const items = rankedRows.map((r) => ({
      id: r.id,
      ct: parseTimeToSeconds(r.corrected),
    }));

    items.sort((a, b) => {
      const aNone = a.ct == null;
      const bNone = b.ct == null;
      if (aNone !== bNone) return aNone ? 1 : -1;
      if (a.ct == null || b.ct == null) return 0;
      return a.ct - b.ct;
    });

    const out = new Map<number, { position: number; delta: string; points: number }>();
    let bestCt: number | null = null;
    for (const it of items) {
      if (it.ct != null) {
        bestCt = it.ct;
        break;
      }
    }

    let pos = 1;
    let i = 0;
    while (i < items.length) {
      const baseCt = items[i].ct;
      let tieCount = 1;
      while (i + tieCount < items.length && items[i + tieCount].ct === baseCt) tieCount += 1;
      const ptsAvg = Array.from({ length: tieCount }, (_, k) => pos + k).reduce((a, v) => a + v, 0) / tieCount;
      const deltaStr = bestCt == null || baseCt == null ? '—' : formatDelta(baseCt - bestCt);
      for (let k = 0; k < tieCount; k += 1) {
        out.set(items[i + k].id, { position: pos, delta: deltaStr, points: ptsAvg });
      }
      pos += tieCount;
      i += tieCount;
    }

    const nPlusOne = sorted.length + 1;
    for (const r of nonRanked) {
      out.set(r.id, { position: nPlusOne, delta: '—', points: nPlusOne });
    }
    return out;
  }, [isHandicapClass, sorted, handicapEdits]);

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

  if (isHandicapClass) {
    return (
      <HandicapResultsTable
        sorted={sorted}
        loading={loading}
        showFleetColumn={!!fleetNameByEntryId?.size}
        fleetLabelForRow={fleetLabelForRow}
        raceStartTime={raceStartTime ?? ''}
        handicapMethod={handicapMethod ?? 'manual'}
        codeGroups={codeGroups}
        pendingCode={pendingCode}
        pendingPoints={pendingPoints}
        pointsOpen={pointsOpen}
        pointsValue={pointsValue}
        handicapRankingPreviewById={handicapRankingPreviewById}
        clearPending={clearPending}
        openPoints={openPoints}
        closePoints={closePoints}
        setPointsValue={setPointsValue}
        setPendingCode={setPendingCode}
        setPendingPoints={setPendingPoints}
        resolveCrew={resolveCrew}
        getHandicapEdit={getHandicapEdit}
        setHandicapEditField={setHandicapEditField}
        onMarkCode={onMarkCode}
        onOverridePoints={onOverridePoints}
        onUpdateHandicapResult={onUpdateHandicapResult}
        resolveEffectiveRating={getEffectiveRatingForRow}
      />
    );
  }

  return (
    <OneDesignResultsTable
      sorted={sorted}
      loading={loading}
      showFleetColumn={!!fleetNameByEntryId?.size}
      fleetLabelForRow={fleetLabelForRow}
      codeGroups={codeGroups}
      pendingCode={pendingCode}
      pendingPoints={pendingPoints}
      changeToOpen={changeToOpen}
      changeToValue={changeToValue}
      pointsOpen={pointsOpen}
      pointsValue={pointsValue}
      resolveCrew={resolveCrew}
      formatCodeWithValue={formatCodeWithValue}
      clearPending={clearPending}
      openChangeTo={openChangeTo}
      closeChangeTo={closeChangeTo}
      openPoints={openPoints}
      closePoints={closePoints}
      setPendingCode={setPendingCode}
      setPendingPoints={setPendingPoints}
      setChangeToValue={setChangeToValue}
      setPointsValue={setPointsValue}
      onMarkCode={onMarkCode}
      onEditPos={onEditPos}
      onOverridePoints={onOverridePoints}
    />
  );
}
