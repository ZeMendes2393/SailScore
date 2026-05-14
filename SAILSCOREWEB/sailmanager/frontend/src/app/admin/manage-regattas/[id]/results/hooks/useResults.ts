'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, apiSend, apiDelete } from '@/lib/api';
import type { Entry, Race, ApiResult, DraftResult, ScoringConfig } from '../types';
import notify from '@/lib/notify';
import { useConfirm } from '@/components/ConfirmDialog';

type EntryWithStatus = Entry & {
  paid?: boolean | null;
  confirmed?: boolean | null;
};

// 👇 tipos auxiliares para Fleets
type FleetLite = {
  id: number;
  name: string;
};

type AssignmentLite = {
  entry_id: number;
  fleet_id: number;
};

// =====================================================
// ✅ NOVO: sets de codes especiais
// =====================================================

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

const ADJUSTABLE_CODES = new Set(['RDG', 'SCP', 'ZPF', 'DPI']);

const normCode = (c?: string | null) => {
  const s = (c ?? '').trim().toUpperCase();
  return s || null;
};

const isAutoNPlusOne = (c?: string | null) => {
  const k = normCode(c);
  return !!k && AUTO_N_PLUS_ONE_CODES.has(k);
};

const isAdjustable = (c?: string | null) => {
  const k = normCode(c);
  return !!k && ADJUSTABLE_CODES.has(k);
};

// =====================================================
// ✅ Draft com points manual por linha (apenas para RDG/SCP/ZPF/DPI)
// (não precisas mexer no ../types, TS é estrutural)
// =====================================================
type DraftLine = DraftResult & {
  code?: string | null;
  manualPoints?: number | null;
};

// =====================================================
// ✅ Handicap Time Scoring: rascunho por linha
// =====================================================
type HandicapDraftLine = {
  entryId: number;
  finishTime: string;
  finishDay: number | '';
  elapsedTime: string;
  correctedTime: string;
  code?: string | null;
};

export function useResults(regattaId: number, token?: string, newlyCreatedRace?: Race | null) {
  const router = useRouter();
  const confirm = useConfirm();

  // ---- Scoring / Descartes + Códigos (globais da regata)
  const [scoring, setScoring] = useState<ScoringConfig>({
    discard_count: 0,
    discard_threshold: 4,
    code_points: {},
  });
  const [savingScoring, setSavingScoring] = useState(false);

  /** Regatta display name (for export filenames; matches backend Content-Disposition). */
  const [regattaNameForExport, setRegattaNameForExport] = useState('');

  // ---- Dados base
  const [entryList, setEntryList] = useState<EntryWithStatus[]>([]);
  const [races, setRaces] = useState<Race[]>([]);
  /** True until the first fetch of entries + races for this regatta finishes (avoids empty “select a race” flash on refresh). */
  const [scoresBootstrapPending, setScoresBootstrapPending] = useState(true);
  const [selectedRaceId, setSelectedRaceId] = useState<number | null>(null);

  const selectedRace = useMemo(
    () => races.find((r) => r.id === selectedRaceId) ?? null,
    [races, selectedRaceId]
  );
  const selectedClass = selectedRace?.class_name ?? null;

  // 👇 alias mais explícito para usar no RaceResultsManager
  const currentRace = selectedRace;

  // ---- Resultados existentes (estado "bruto")
  const [existingResultsRaw, setExistingResultsRaw] = useState<ApiResult[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);

  const DRAFT_STORAGE_KEY = `sailscore-results-draft-${regattaId}`;

  function loadDraftFromStorage(): {
    draftByRace: Record<number, DraftLine[]>;
    handicapDraftByRace: Record<number, HandicapDraftLine[]>;
  } {
    if (typeof window === 'undefined') return { draftByRace: {}, handicapDraftByRace: {} };
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return { draftByRace: {}, handicapDraftByRace: {} };
      const parsed = JSON.parse(raw);
      const draftByRace: Record<number, DraftLine[]> = {};
      const handicapDraftByRace: Record<number, HandicapDraftLine[]> = {};
      if (parsed?.draftByRace && typeof parsed.draftByRace === 'object') {
        for (const [k, v] of Object.entries(parsed.draftByRace)) {
          const raceId = Number(k);
          if (!Number.isNaN(raceId) && Array.isArray(v)) {
            draftByRace[raceId] = v as DraftLine[];
          }
        }
      }
      if (parsed?.handicapDraftByRace && typeof parsed.handicapDraftByRace === 'object') {
        for (const [k, v] of Object.entries(parsed.handicapDraftByRace)) {
          const raceId = Number(k);
          if (!Number.isNaN(raceId) && Array.isArray(v)) {
            handicapDraftByRace[raceId] = v as HandicapDraftLine[];
          }
        }
      }
      return { draftByRace, handicapDraftByRace };
    } catch {
      return { draftByRace: {}, handicapDraftByRace: {} };
    }
  }

  // ---- Rascunho (bulk) — um por race, persistido em localStorage (lazy init para sobreviver ao refresh)
  const [draftByRace, setDraftByRace] = useState<Record<number, DraftLine[]>>(() =>
    loadDraftFromStorage().draftByRace
  );
  const [handicapDraftByRace, setHandicapDraftByRace] = useState<Record<number, HandicapDraftLine[]>>(() =>
    loadDraftFromStorage().handicapDraftByRace
  );
  const [draftInput, setDraftInput] = useState('');

  // Recarregar draft quando mudar de regatta (navegação)
  const prevRegattaIdRef = useRef(regattaId);
  useEffect(() => {
    if (prevRegattaIdRef.current !== regattaId) {
      prevRegattaIdRef.current = regattaId;
      const { draftByRace: d, handicapDraftByRace: h } = loadDraftFromStorage();
      setDraftByRace(d);
      setHandicapDraftByRace(h);
    }
  }, [regattaId]);

  // Persistir draft em localStorage quando mudar (debounce leve para evitar writes excessivos)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(
          DRAFT_STORAGE_KEY,
          JSON.stringify({
            draftByRace: { ...draftByRace },
            handicapDraftByRace: { ...handicapDraftByRace },
          })
        );
      } catch {
        // ignorar (quota, modo privado, etc.)
      }
    }, 50);
    return () => clearTimeout(t);
  }, [draftByRace, handicapDraftByRace, DRAFT_STORAGE_KEY]);

  // Derive draft corrente da race selecionada
  const draft = useMemo(
    () => (selectedRaceId ? (draftByRace[selectedRaceId] ?? []) : []),
    [selectedRaceId, draftByRace]
  );
  const handicapDraft = useMemo(
    () => (selectedRaceId ? (handicapDraftByRace[selectedRaceId] ?? []) : []),
    [selectedRaceId, handicapDraftByRace]
  );

  const setDraftForCurrentRace = useCallback(
    (updater: (prev: DraftLine[]) => DraftLine[]) => {
      if (!selectedRaceId) return;
      setDraftByRace((prev) => ({
        ...prev,
        [selectedRaceId]: updater(prev[selectedRaceId] ?? []),
      }));
    },
    [selectedRaceId]
  );
  const setHandicapDraftForCurrentRace = useCallback(
    (updater: (prev: HandicapDraftLine[]) => HandicapDraftLine[]) => {
      if (!selectedRaceId) return;
      setHandicapDraftByRace((prev) => ({
        ...prev,
        [selectedRaceId]: updater(prev[selectedRaceId] ?? []),
      }));
    },
    [selectedRaceId]
  );

  // ---- Adicionar 1 em falta
  const [singleSail, setSingleSail] = useState('');
  const [singlePos, setSinglePos] = useState<number | ''>('');

  // ---- Escolha de entry quando há vários barcos com o mesmo nº de vela (ex.: POR 1 e ESP 1)
  const [sailChoicePending, setSailChoicePending] = useState<{
    context: 'draft' | 'single';
    sail: string;
    candidates: EntryWithStatus[];
    singlePos?: number;
  } | null>(null);

  // ---- Helpers elegibilidade / escolha melhor entry quando há duplicados
  const isEligible = (e: EntryWithStatus) => !!e.paid && !!e.confirmed;

  /** Todas as entries com esse sail na classe, elegíveis (para mostrar escolha ao user). */
  function getCandidatesBySail(
    entries: EntryWithStatus[],
    sailLower: string,
    wantedClass: string | null
  ): EntryWithStatus[] {
    const sameSail = entries.filter((e) => (e.sail_number || '').toLowerCase() === sailLower);
    if (!wantedClass || !sameSail.length) return [];
    return sameSail.filter((e) => e.class_name === wantedClass && isEligible(e));
  }

  function pickBestEntryBySail(
    entries: EntryWithStatus[],
    sailLower: string,
    wantedClass: string | null
  ): {
    best: EntryWithStatus | null;
    reason: 'ok' | 'not-found' | 'same-class-not-eligible' | 'diff-class';
  } {
    const sameSail = entries.filter((e) => (e.sail_number || '').toLowerCase() === sailLower);
    if (!sameSail.length) return { best: null, reason: 'not-found' };

    if (wantedClass) {
      const sameClassEligible = sameSail.find((e) => e.class_name === wantedClass && isEligible(e));
      if (sameClassEligible) return { best: sameClassEligible, reason: 'ok' };

      const sameClassAny = sameSail.find((e) => e.class_name === wantedClass);
      if (sameClassAny) return { best: sameClassAny, reason: 'same-class-not-eligible' };
    }

    return { best: sameSail[0], reason: 'diff-class' };
  }

  // Carregar scoring global + listas
  const refreshEntries = useCallback(async () => {
    try {
      const entries = await apiGet<EntryWithStatus[]>(`/entries/by_regatta/${regattaId}`);
      setEntryList(entries);
      return entries;
    } catch {
      return null;
    }
  }, [regattaId]);

  useEffect(() => {
    let cancelled = false;
    setScoresBootstrapPending(true);
    (async () => {
      try {
        const regatta = await apiGet<any>(`/regattas/${regattaId}`);
        if (!cancelled) {
          setRegattaNameForExport(String(regatta?.name ?? '').trim());
          setScoring({
            discard_count: typeof regatta.discard_count === 'number' ? regatta.discard_count : 0,
            discard_threshold:
              typeof regatta.discard_threshold === 'number' ? regatta.discard_threshold : 4,
            code_points: regatta.scoring_codes ?? {},
          });
        }
      } catch {}

      try {
        const [entries, rcs] = await Promise.all([
          apiGet<EntryWithStatus[]>(`/entries/by_regatta/${regattaId}`),
          apiGet<Race[]>(`/races/by_regatta/${regattaId}`), // já vem ordenado
        ]);
        if (!cancelled) {
          setEntryList(entries);
          setRaces(rcs);
        }
      } catch {}
    })()
      .finally(() => {
        if (!cancelled) setScoresBootstrapPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [regattaId]);

  // Integrar nova corrida criada — não limpa drafts das outras races
  useEffect(() => {
    if (!newlyCreatedRace) return;
    setRaces((prev) => {
      const exists = prev.some((r) => r.id === newlyCreatedRace.id);
      const next = exists ? prev : [...prev, newlyCreatedRace];
      return next.slice().sort((a: any, b: any) => (a.order_index ?? a.id) - (b.order_index ?? b.id));
    });
    setSelectedRaceId(newlyCreatedRace.id);
    setExistingResultsRaw([]);
  }, [newlyCreatedRace]);

  const refreshExisting = useCallback(async (raceId: number) => {
    setLoadingExisting(true);
    try {
      const data = await apiGet<ApiResult[]>(`/results/races/${raceId}/results`);
      setExistingResultsRaw(data);
    } catch {
      setExistingResultsRaw([]);
    } finally {
      setLoadingExisting(false);
    }
  }, []);

  const refreshRaces = useCallback(async () => {
    try {
      const rcs = await apiGet<Race[]>(`/races/by_regatta/${regattaId}`);
      setRaces(rcs);
    } catch {}
  }, [regattaId]);

  useEffect(() => {
    if (!selectedRaceId) return;
    refreshExisting(selectedRaceId);
    // Sempre que muda de race, buscar entries mais recentes (inclui ratings).
    refreshEntries();
  }, [selectedRaceId, refreshExisting, refreshEntries]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const refreshOnFocus = () => {
      if (selectedRaceId) refreshEntries();
    };
    const refreshOnVisibility = () => {
      if (document.visibilityState === 'visible' && selectedRaceId) refreshEntries();
    };
    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshOnVisibility);
    return () => {
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshOnVisibility);
    };
  }, [selectedRaceId, refreshEntries]);

  // ---------- Classes detailed (para class_type: handicap vs one_design)
  const [classesDetailed, setClassesDetailed] = useState<{ class_name: string; class_type?: string }[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const arr = await apiGet<{ class_name: string; class_type?: string }[]>(
          `/regattas/${regattaId}/classes/detailed`
        );
        setClassesDetailed(Array.isArray(arr) ? arr : []);
      } catch {
        setClassesDetailed([]);
      }
    })();
  }, [regattaId]);
  const isHandicapClass = useMemo(() => {
    if (!selectedClass) return false;
    const c = classesDetailed.find(
      (x) => (x.class_name || '').toLowerCase() === (selectedClass || '').toLowerCase()
    );
    return (c?.class_type || '').toLowerCase() === 'handicap';
  }, [classesDetailed, selectedClass]);

  // ---------- Settings por classe ----------
  const [classSettings, setClassSettings] = useState<{
    discard_count: number;
    discard_threshold: number;
    scoring_codes: Record<string, number>;
  } | null>(null);

  useEffect(() => {
    (async () => {
      if (!selectedClass) {
        setClassSettings(null);
        return;
      }
      try {
        const res = await apiGet<any>(
          `/regattas/${regattaId}/class-settings/${encodeURIComponent(selectedClass)}`
        );
        const resolved = (res?.resolved ?? res) || {};
        setClassSettings({
          discard_count: Number(
            typeof resolved.discard_count === 'number'
              ? resolved.discard_count
              : typeof scoring.discard_count === 'number'
              ? scoring.discard_count
              : 0
          ),
          discard_threshold: Number(
            typeof resolved.discard_threshold === 'number'
              ? resolved.discard_threshold
              : typeof scoring.discard_threshold === 'number'
              ? scoring.discard_threshold
              : 0
          ),
          scoring_codes: resolved.scoring_codes ? resolved.scoring_codes : {},
        });
      } catch {
        setClassSettings(null);
      }
    })();
    // sem scoring nas deps intencionalmente
  }, [regattaId, selectedClass]);

  // *Merge* de códigos fixos: globais (regata) + override por classe (classe ganha)
  // ⚠️ estes são os "fixos" do mapping. Não incluem auto N+1 nem adjustable.
  const scoringCodes = useMemo(() => {
    const global = scoring.code_points ?? {};
    const perClass = classSettings?.scoring_codes ?? {};
    const merged: Record<string, number> = {};

    for (const [k, v] of Object.entries(global)) merged[String(k).toUpperCase()] = Number(v);
    for (const [k, v] of Object.entries(perClass)) merged[String(k).toUpperCase()] = Number(v);

    return merged;
  }, [scoring.code_points, classSettings]);

  const effectiveDiscardCount = classSettings?.discard_count ?? scoring.discard_count ?? 0;
  const effectiveDiscardThreshold = classSettings?.discard_threshold ?? scoring.discard_threshold ?? 0;

  // ---------- Fleets para a corrida selecionada ----------
  const [fleetsForRace, setFleetsForRace] = useState<FleetLite[]>([]);
  const [fleetAssignments, setFleetAssignments] = useState<AssignmentLite[]>([]);
  const [selectedFleetId, setSelectedFleetId] = useState<number | 'all'>('all');

  useEffect(() => {
    (async () => {
      if (!currentRace || !selectedClass) {
        setFleetsForRace([]);
        setFleetAssignments([]);
        setSelectedFleetId('all');
        return;
      }
      if (!('fleet_set_id' in currentRace) || !currentRace.fleet_set_id) {
        setFleetsForRace([]);
        setFleetAssignments([]);
        setSelectedFleetId('all');
        return;
      }

      try {
        const sets = await apiGet<any[]>(
          `/regattas/${regattaId}/classes/${encodeURIComponent(selectedClass)}/fleet-sets`
        );
        const fs = (sets || []).find((s) => s.id === (currentRace as any).fleet_set_id);
        if (!fs) {
          setFleetsForRace([]);
          setFleetAssignments([]);
          setSelectedFleetId('all');
          return;
        }

        const fleets: FleetLite[] = (fs.fleets ?? []).map((f: any) => ({
          id: f.id,
          name: f.name,
        }));
        setFleetsForRace(fleets);

        const assResp = await apiGet<{
          fleet_set_id: number;
          assignments: { entry_id: number; fleet_id: number }[];
        }>(
          `/regattas/${regattaId}/classes/${encodeURIComponent(
            selectedClass
          )}/fleet-sets/${fs.id}/assignments`
        );

        setFleetAssignments(assResp.assignments ?? []);
        setSelectedFleetId('all');
      } catch (e) {
        console.error('Falha ao carregar fleets da corrida:', e);
        setFleetsForRace([]);
        setFleetAssignments([]);
        setSelectedFleetId('all');
      }
    })();
  }, [regattaId, selectedClass, currentRace]);

  const fleetEntryIdSet = useMemo<Set<number> | null>(() => {
    if (!currentRace || !('fleet_set_id' in currentRace) || !(currentRace as any).fleet_set_id) return null;
    if (!fleetAssignments.length) return null;

    if (selectedFleetId === 'all') return new Set(fleetAssignments.map((a) => a.entry_id));

    return new Set(
      fleetAssignments.filter((a) => a.fleet_id === selectedFleetId).map((a) => a.entry_id)
    );
  }, [currentRace, fleetAssignments, selectedFleetId]);

  /** Para mostrar qual frota (Yellow/Blue/…) quando a corrida tem fleet set — posições são por frota. */
  const entryIdToFleetName = useMemo(() => {
    if (!fleetsForRace.length || !fleetAssignments.length) return new Map<number, string>();
    const fleetIdToName = new Map<number, string>(
      fleetsForRace.map((f) => [f.id, f.name])
    );
    const m = new Map<number, string>();
    for (const a of fleetAssignments) {
      const n = fleetIdToName.get(a.fleet_id);
      if (n) m.set(a.entry_id, n);
    }
    return m;
  }, [fleetsForRace, fleetAssignments]);

  const resultIdentityKey = useCallback(
    (sailNumber?: string | null, boatCountryCode?: string | null) => {
      const sn = (sailNumber ?? '').trim().toUpperCase();
      const cc = (boatCountryCode ?? '').trim().toUpperCase();
      if (!sn) return '';
      return `${sn}|${cc}`;
    },
    []
  );

  const resultIdentityToEntryIds = useMemo(() => {
    const map = new Map<string, number[]>();
    entryList.forEach((e) => {
      const key = resultIdentityKey(e.sail_number, (e as any).boat_country_code ?? null);
      if (!key) return;
      const arr = map.get(key) ?? [];
      arr.push(e.id);
      map.set(key, arr);
    });
    return map;
  }, [entryList, resultIdentityKey]);

  const availableEntries = useMemo(() => {
    let filtered = entryList.filter(
      (e) => e.class_name === selectedClass && isEligible(e) && !draft.some((r) => r.entryId === e.id)
    );

    if (fleetEntryIdSet) filtered = filtered.filter((e) => fleetEntryIdSet.has(e.id));

    return filtered;
  }, [entryList, selectedClass, draft, fleetEntryIdSet]);

  // Para Handicap / Time Scoring: todos os inscritos elegíveis (classe + fleet), sem filtrar por draft
  const handicapEligibleEntries = useMemo(() => {
    let filtered = entryList.filter(
      (e) => e.class_name === selectedClass && isEligible(e)
    );
    if (fleetEntryIdSet) {
      filtered = filtered.filter((e) => fleetEntryIdSet.has(e.id));
    }
    return filtered;
  }, [entryList, selectedClass, fleetEntryIdSet]);

  const existingResults = useMemo(() => {
    if (!fleetEntryIdSet) return existingResultsRaw;

    return existingResultsRaw.filter((r) => {
      const key = resultIdentityKey(r.sail_number, (r as any).boat_country_code ?? null);
      if (!key) return false;
      const ids = resultIdentityToEntryIds.get(key);
      if (!ids || !ids.length) return false;
      return ids.some((id) => fleetEntryIdSet.has(id));
    });
  }, [existingResultsRaw, fleetEntryIdSet, resultIdentityToEntryIds, resultIdentityKey]);

  // =====================================================
  // ✅ NOVO: RESCORE helper — apaga o que existia antes (no scope certo)
  // =====================================================
  const deleteExistingResultsInScope = useCallback(async () => {
  if (!selectedRaceId || !token) return;

  const raceHasFleets = !!(
    currentRace &&
    'fleet_set_id' in currentRace &&
    (currentRace as any).fleet_set_id
  );

  // Verifica se a fleet está definida
  const replaceWholeRace =
    !raceHasFleets || selectedFleetId === 'all' || !fleetEntryIdSet;

  const allRows = existingResultsRaw ?? [];
  let toDeleteIds: number[] = [];

  if (replaceWholeRace) {
    // Apaga todos os resultados se não houver fleets ou se a fleet for "all"
    toDeleteIds = allRows.map((r) => r.id);
  } else {
    // Apaga apenas os resultados pertencentes à fleet selecionada (sail + country).
    const fleetIdentities = new Set<string>();
    entryList.forEach((e) => {
      if (!fleetEntryIdSet.has(e.id)) return;
      const key = resultIdentityKey(e.sail_number, (e as any).boat_country_code ?? null);
      if (key) fleetIdentities.add(key);
    });

    toDeleteIds = allRows
      .filter((r) => {
        const key = resultIdentityKey(r.sail_number, (r as any).boat_country_code ?? null);
        return !!key && fleetIdentities.has(key);
      })
      .map((r) => r.id);
  }

  for (const id of toDeleteIds) {
    try {
      await apiDelete(`/results/${id}`, token);
    } catch (e) {
      console.error('Falha a apagar resultado', id, e);
    }
  }
}, [
  selectedRaceId,
  token,
  currentRace,
  selectedFleetId,
  fleetEntryIdSet,
  existingResultsRaw,
  entryList,
  resultIdentityKey,
]);


  // ---- Ações: scoring (globais da regata)
  const saveScoring = async () => {
    if (!token) { notify.error('Token missing. Please log in again.'); return; }
    setSavingScoring(true);
    try {
      await apiSend(
        `/regattas/${regattaId}/scoring`,
        'PATCH',
        {
          discard_count: scoring.discard_count,
          discard_threshold: scoring.discard_threshold,
          code_points: scoring.code_points ?? {},
        },
        token
      );
      window.dispatchEvent(new CustomEvent('regatta-scoring-updated', { detail: { regattaId } }));
      notify.success('Discard rules / codes saved.');
    } catch {
      notify.error('Failed to save global discard rules / codes.');
    } finally {
      setSavingScoring(false);
    }
  };

  // ---- RASCUNHO
  const addDraftBySail = () => {
    const trimmed = draftInput.trim().toLowerCase();
    if (!trimmed || !selectedClass) return;

    const candidates = getCandidatesBySail(entryList, trimmed, selectedClass)
      .filter((e) => !(fleetEntryIdSet && !fleetEntryIdSet.has(e.id)))
      .filter((e) => !draft.some((r) => r.entryId === e.id));

    if (candidates.length === 0) {
      const { best } = pickBestEntryBySail(entryList, trimmed, selectedClass);
      if (!best) { notify.warning('Boat not found with this sail number.'); return; }
      if (best.class_name !== selectedClass) { notify.warning(`This boat does not belong to class ${selectedClass}.`); return; }
      if (!isEligible(best)) { notify.warning('This entry is not eligible (must be PAID and CONFIRMED).'); return; }
      if (draft.some((r) => r.entryId === best.id)) { notify.info('This boat is already in the draft.'); return; }
      if (fleetEntryIdSet && !fleetEntryIdSet.has(best.id)) {
        notify.warning('This boat does not belong to the selected fleet for this race.');
        return;
      }
      setDraftForCurrentRace((d) => [...d, { position: d.length + 1, entryId: best.id, code: null, manualPoints: null }]);
      setDraftInput('');
      return;
    }

    if (candidates.length > 1) {
      setSailChoicePending({ context: 'draft', sail: trimmed, candidates });
      return;
    }

    setDraftForCurrentRace((d) => [...d, { position: d.length + 1, entryId: candidates[0].id, code: null, manualPoints: null }]);
    setDraftInput('');
  };

  const addDraftByChosenEntry = useCallback((entryId: number) => {
    if (!sailChoicePending || sailChoicePending.context !== 'draft') return;
    const entry = sailChoicePending.candidates.find((c) => c.id === entryId);
    if (!entry) return;
    if (fleetEntryIdSet && !fleetEntryIdSet.has(entryId)) {
      notify.warning('This boat does not belong to the selected fleet for this race.');
      return;
    }
    if (draft.some((r) => r.entryId === entryId)) { notify.info('This boat is already in the draft.'); return; }
    setDraftForCurrentRace((d) => [...d, { position: d.length + 1, entryId, code: null, manualPoints: null }]);
    setDraftInput('');
    setSailChoicePending(null);
  }, [sailChoicePending, fleetEntryIdSet, draft]);

  const clearSailChoicePending = useCallback(() => {
    setSailChoicePending(null);
  }, []);

  const addDraftEntry = (entryId: number) => {
    if (fleetEntryIdSet && !fleetEntryIdSet.has(entryId)) {
      notify.warning('This boat does not belong to the selected fleet for this race.');
      return;
    }

  setDraftForCurrentRace((d) => {
    if (d.some((r) => r.entryId === entryId)) return d;
    return [...d, { position: d.length + 1, entryId, code: null, manualPoints: null }];
  });
  };

  const removeDraft = (entryId: number) => {
    setDraftForCurrentRace((d) => d.filter((r) => r.entryId !== entryId).map((r, i) => ({ ...r, position: i + 1 })));
  };

  const moveDraft = (index: number, dir: -1 | 1) => {
    setDraftForCurrentRace((d) => {
      const tgt = index + dir;
      if (tgt < 0 || tgt >= d.length) return d;
      const copy = [...d];
      [copy[index], copy[tgt]] = [copy[tgt], copy[index]];
      return copy.map((r, i) => ({ ...r, position: i + 1 }));
    });
  };

  const onSetDraftPos = (entryId: number, pos: number) => {
    const newPos = Math.max(1, Number(pos) || 1);
    setDraftForCurrentRace((d) => {
      const copy = d.map((r) => (r.entryId === entryId ? { ...r, position: newPos } : r));
      return copy.sort((a, b) => a.position - b.position).map((r, i) => ({ ...r, position: i + 1 }));
    });
  };

  const onSetDraftCode = (entryId: number, code: string | null) => {
    const c = normCode(code);
    setDraftForCurrentRace((d) =>
      d.map((r) => {
        if (r.entryId !== entryId) return r;
        const keepManual = isAdjustable(c);
        return { ...r, code: c, manualPoints: keepManual ? (r.manualPoints ?? null) : null };
      })
    );
  };

  const onSetDraftPoints = (entryId: number, points: number | null) => {
    const v = points == null ? null : Number(points);
    setDraftForCurrentRace((d) => d.map((r) => (r.entryId === entryId ? { ...r, manualPoints: v } : r)));
  };

  // =====================================================
  // Handicap / Time Scoring: helpers de rascunho
  // =====================================================

  const addHandicapEntry = (entryId: number) => {
    if (!isHandicapClass) {
      notify.warning('"Time Scoring (Handicap)" is only available for handicap classes.');
      return;
    }

    if (fleetEntryIdSet && !fleetEntryIdSet.has(entryId)) {
      notify.warning('This boat does not belong to the selected fleet for this race.');
      return;
    }

    if (handicapDraft.some((r) => r.entryId === entryId)) {
      notify.info('This boat is already in the time table.');
      return;
    }

    setHandicapDraftForCurrentRace((prev) => [
      ...prev,
      {
        entryId,
        finishTime: '',
        finishDay: 0,
        elapsedTime: '',
        correctedTime: '',
        code: null,
      },
    ]);
  };

  const removeHandicapEntry = (entryId: number) => {
    setHandicapDraftForCurrentRace((prev) => prev.filter((r) => r.entryId !== entryId));
  };

  const updateHandicapField = (
    entryId: number,
    field: 'finishTime' | 'finishDay' | 'elapsedTime' | 'correctedTime',
    value: string | number
  ) => {
    setHandicapDraftForCurrentRace((prev) =>
      prev.map((r) => {
        if (r.entryId !== entryId) return r;
        if (field === 'finishDay') {
          const n = value === '' || value === null ? '' : Number(value);
          return { ...r, finishDay: n === '' || Number.isNaN(n) ? '' : Math.max(0, Math.floor(n)) };
        }
        return { ...r, [field]: value } as HandicapDraftLine;
      })
    );
  };

  const updateHandicapCode = (entryId: number, code: string | null) => {
    const c = normCode(code);
    setHandicapDraftForCurrentRace((prev) =>
      prev.map((r) => (r.entryId === entryId ? { ...r, code: c } : r))
    );
  };

  // ---- EXISTENTES: aplicar code (agora aceita points opcional para RDG/SCP/ZPF/DPI)
  const markCode = async (rowId: number, code: string | null, points?: number | null) => {
    if (!selectedRaceId || !token) return;

    const normalized = normCode(code);

    setExistingResultsRaw((prev) => prev.map((r) => (r.id === rowId ? { ...r, code: normalized } : r)));

    try {
      await apiSend(
        `/results/${rowId}/code`,
        'PATCH',
        {
          code: normalized ?? '',
          points: isAdjustable(normalized) ? (points ?? null) : null,
        },
        token
      );
      await refreshExisting(selectedRaceId);
    } catch (err) {
      console.error('markCode falhou:', err);
      await refreshExisting(selectedRaceId);
      notify.error('Could not apply the code to this result.');
    }
  };

  // ---- Handicap / Time Scoring: guardar em massa
  const saveHandicap = async (): Promise<boolean> => {
    if (!selectedRaceId) {
      notify.warning('Select a race first.');
      return false;
    }
    if (!token) {
      notify.error('Admin session missing or expired. Please log in again.');
      return false;
    }
    if (!isHandicapClass) {
      notify.warning('Time Scoring is only available for handicap classes.');
      return false;
    }
    if (!handicapDraft.length) {
      notify.warning('No rows in the time table to save.');
      return false;
    }

    // Garante que validações e payload usam os ratings mais recentes das entries.
    const latestEntries = await refreshEntries();
    const sourceEntries = latestEntries ?? entryList;

    if (currentRace?.handicap_method === 'anc') {
      const withoutRating = handicapDraft.filter((r) => {
        const entry = sourceEntries.find((e) => e.id === r.entryId);
        return !entry || typeof entry.rating !== 'number' || Number.isNaN(entry.rating);
      });
      if (withoutRating.length > 0) {
        notify.warning(
          'Some boats are missing Simple Rating. Fill in the Simple Rating in the entries before using Simple Rating mode.'
        );
        return false;
      }
    }

    if (currentRace?.handicap_method === 'orc') {
      const orcMode = (currentRace as any).orc_rating_mode || 'medium';
      const fieldMap = { low: 'orc_low', medium: 'orc_medium', high: 'orc_high' } as const;
      const field = fieldMap[orcMode as keyof typeof fieldMap] ?? 'orc_medium';
      const withoutOrc = handicapDraft.filter((r) => {
        const entry = sourceEntries.find((e) => e.id === r.entryId);
        const val = entry ? (entry as any)[field] : null;
        return !entry || typeof val !== 'number' || Number.isNaN(val);
      });
      if (withoutOrc.length > 0) {
        notify.warning(
          `Some boats are missing ORC rating (${orcMode}). Fill in the ORC ${orcMode} in the entries before using ORC mode.`
        );
        return false;
      }
    }

    const isValidClockHHMMSS = (v: string) => /^\d{1,2}:[0-5]\d:[0-5]\d$/.test((v ?? '').trim());
    const isValidDurationHHMMSS = (v: string) => /^\d{1,2}:[0-5]\d:[0-5]\d$/.test((v ?? '').trim());

    // validação dos tempos para barcos em ranking:
    // - corrected_time é obrigatório (HH:MM:SS)
    // - finish_time e elapsed_time são opcionais; se vierem, devem estar em HH:MM:SS
    for (const r of handicapDraft) {
      const entry = sourceEntries.find((e) => e.id === r.entryId);
      if (!entry) {
        console.warn('Entry em falta para handicapDraft', r.entryId);
        notify.error('There are rows with unknown entry. Reload the page.');
        return false;
      }

      const codeNorm = normCode(r.code);
      const outOfRanking = isAutoNPlusOne(codeNorm);

      if (!outOfRanking) {
        if (!isValidDurationHHMMSS(r.correctedTime)) {
          notify.warning(
            `Invalid corrected time for boat ${entry.sail_number}. Corrected Time is required in HH:MM:SS format.`
          );
          return false;
        }
        if (r.finishTime && !isValidClockHHMMSS(r.finishTime)) {
          notify.warning(
            `Invalid finish time for boat ${entry.sail_number}. Use HH:MM:SS format.`
          );
          return false;
        }
        if (r.elapsedTime && !isValidDurationHHMMSS(r.elapsedTime)) {
          notify.warning(
            `Invalid elapsed time for boat ${entry.sail_number}. Use HH:MM:SS format.`
          );
          return false;
        }
      }

      if (!((entry as any).boat_country_code || '').trim()) {
        notify.warning(`Missing boat country code for sail number ${entry.sail_number || '(unknown)'}.`);
        return false;
      }
    }

    // RESCORE: se já existem resultados, apagamos no scope certo
    if ((existingResultsRaw?.length ?? 0) > 0) {
      const raceHasFleets = !!(
        currentRace &&
        'fleet_set_id' in currentRace &&
        (currentRace as any).fleet_set_id
      );

      const replacingFleet = raceHasFleets && selectedFleetId !== 'all';
      const ok = await confirm({
        title: replacingFleet
          ? 'Replace results for this fleet?'
          : 'Replace all results for this race?',
        description: replacingFleet
          ? 'This will overwrite the existing results of this fleet in this race (Handicap mode).'
          : 'This will overwrite all existing results of this race (Handicap mode).',
        tone: 'warning',
        confirmLabel: 'Replace results',
      });
      if (!ok) return false;

      await deleteExistingResultsInScope();
      setExistingResultsRaw([]);
    }

    const payload = handicapDraft
      .map((r) => {
        const entry = sourceEntries.find((e) => e.id === r.entryId);
        if (!entry) {
          console.warn('Entry em falta para handicapDraft', r.entryId);
          return null;
        }

        const codeNorm = normCode(r.code);

        const finishDayNum =
          r.finishDay !== '' && r.finishDay != null && !Number.isNaN(Number(r.finishDay))
            ? Math.max(0, Math.floor(Number(r.finishDay)))
            : null;

        return {
          regatta_id: regattaId,
          race_id: selectedRaceId,
          sail_number: entry.sail_number,
          boat_country_code: (entry as any).boat_country_code ?? undefined,
          boat_name: entry.boat_name,
          helm_name: `${entry.first_name} ${entry.last_name}`,
          position: null,
          points: null,
          code: codeNorm,
          finish_time: r.finishTime || null,
          finish_day: finishDayNum,
          elapsed_time: r.elapsedTime || null,
          corrected_time: r.correctedTime || null,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (!payload.length) {
      notify.warning('No valid entries to save (check console).');
      return false;
    }

    const fleetParam =
      currentRace && 'fleet_set_id' in currentRace && currentRace.fleet_set_id && selectedFleetId !== 'all'
        ? `?fleet_id=${selectedFleetId}`
        : '';

    try {
      await apiSend(
        `/results/races/${selectedRaceId}/results${fleetParam}`,
        'POST',
        payload,
        token
      );

      // Após guardar, limpar time scoring draft da race atual
      setHandicapDraftForCurrentRace(() => []);
      await refreshExisting(selectedRaceId);
      notify.success('Handicap results saved successfully.');
      return true;
    } catch (err) {
      console.error('Error saving Handicap results:', err);
      notify.error('Error saving Handicap results.');
      return false;
    }
  };

  const patchHandicapResultFields = async (
    rowId: number,
    data: {
      finish_day: number | null;
      finish_time: string | null;
      elapsed_time: string | null;
      corrected_time: string | null;
    }
  ) => {
    if (!token || !selectedRaceId) return;
    try {
      await apiSend(`/results/${rowId}/handicap-fields`, 'PATCH', data, token);
      await refreshExisting(selectedRaceId);
    } catch (e: any) {
      notify.error(e?.message || 'Could not update handicap result fields.');
    }
  };

 const saveBulk = async () => {
  if (!selectedRaceId) { notify.warning('Select a race first.'); return; }
  if (!token) { notify.error('Admin session missing or expired. Please log in again.'); return; }
  if (!draft.length) { notify.warning('No rows in the draft to save.'); return; }

  // valida: todos os adjustable têm manualPoints
  for (const r of draft) {
    const c = normCode(r.code);
    if (isAdjustable(c) && (r.manualPoints == null || Number.isNaN(Number(r.manualPoints)))) {
      notify.warning(`Please define points for code ${c} (RDG/SCP/ZPF/DPI).`);
      return;
    }

    const entry = entryList.find((e) => e.id === r.entryId);
    if (!entry || !((entry as any).boat_country_code || '').trim()) {
      notify.warning(`Missing boat country code for sail number ${entry?.sail_number || '(unknown)'}.`);
      return;
    }
  }

  // ✅ RESCORE: se já existem resultados, apagamos antes de gravar os novos
  if ((existingResultsRaw?.length ?? 0) > 0) {
    const raceHasFleets = !!(
      currentRace &&
      'fleet_set_id' in currentRace &&
      (currentRace as any).fleet_set_id
    );

    const replacingFleet = raceHasFleets && selectedFleetId !== 'all';
    const ok = await confirm({
      title: replacingFleet
        ? 'Replace results for this fleet?'
        : 'Replace all results for this race?',
      description: replacingFleet
        ? 'This will overwrite the existing results of this fleet in this race.'
        : 'This will overwrite all existing results of this race.',
      tone: 'warning',
      confirmLabel: 'Replace results',
    });
    if (!ok) return;

    await deleteExistingResultsInScope();
    setExistingResultsRaw([]); // evita “mistura” visual enquanto faz POST
  }

  const payload = draft
    .map((r) => {
      const entry = entryList.find((e) => e.id === r.entryId);
      if (!entry) {
        console.warn('Entry em falta para draft', r.entryId);
        return null;
      }

      // Assegurar que position é um número
      const pos = Number(r.position);
      if (isNaN(pos)) {
        console.warn('Position inválido', r.position);
        return null;  // Ignorar se position não for válido
      }

      // Assegurar que points é um número
      const pts = isAdjustable(r.code) ? (isNaN(Number(r.manualPoints)) ? 0 : Number(r.manualPoints)) : pos;

      if (isNaN(pts)) {
        console.warn('Points inválido', r.manualPoints);
        return null;  // Ignorar se points não for válido
      }

      return {
        regatta_id: regattaId,
        race_id: selectedRaceId,
        sail_number: entry.sail_number,
        boat_country_code: (entry as any).boat_country_code ?? undefined,
        boat_name: entry.boat_name,
        helm_name: `${entry.first_name} ${entry.last_name}`,
        position: pos,  // Enviar como número
        points: pts,    // Enviar como número
        code: r.code || null, // Code pode ser null
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  console.log('Payload enviado:', payload);

  if (!payload.length) { notify.warning('No valid entries to save (check console).'); return; }

  // Add fleet_id param if a specific fleet is selected
  const fleetParam =
    currentRace && 'fleet_set_id' in currentRace && currentRace.fleet_set_id && selectedFleetId !== 'all'
      ? `?fleet_id=${selectedFleetId}`
      : '';

  try {
    // Enviar os resultados ao backend com o parâmetro fleet_id, se necessário
    await apiSend(
      `/results/races/${selectedRaceId}/results${fleetParam}`,
      'POST',
      payload,
      token
    );

    // Limpa o draft desta race após guardar com sucesso
    setDraftForCurrentRace(() => []);
    await refreshExisting(selectedRaceId); // Atualiza os resultados
    notify.success('Results saved. You can now view them in Existing Results.');
  } catch (err) {
    console.error('Error saving results in bulk:', err);
    notify.error('Error saving results.');
  }
};




  // ---- EXISTENTES: mover / guardar ordem / posição / apagar
  const moveRow = async (rowId: number, delta: -1 | 1) => {
    if (!selectedRaceId || !token || loadingExisting) return;
    const sorted = existingResults.slice().sort((a, b) => a.position - b.position);
    const idx = sorted.findIndex((r) => r.id === rowId);
    const targetIdx = idx + delta;
    if (idx < 0 || targetIdx < 0 || targetIdx >= sorted.length) return;

    const newPos = sorted[targetIdx].position;
    try {
      await apiSend(`/results/${rowId}/position`, 'PATCH', { new_position: newPos }, token);
      await refreshExisting(selectedRaceId);
    } catch {
      notify.error('Could not move the result.');
    }
  };

  const savePosition = async (rowId: number, newPos: number) => {
    if (!selectedRaceId || !token || newPos <= 0) return;
    try {
      await apiSend(`/results/${rowId}/position`, 'PATCH', { new_position: newPos }, token);
      await refreshExisting(selectedRaceId);
    } catch {
      notify.error('Could not update the position.');
    }
  };

  const deleteResult = async (rowId: number) => {
    if (!selectedRaceId || !token) return;
    try {
      await apiDelete(`/results/${rowId}`, token);
      await refreshExisting(selectedRaceId);
    } catch (e) {
      console.error('DELETE resultado falhou:', e);
      notify.error('Could not delete the result.');
    }
  };

  const postSingleResult = useCallback(
    async (entry: EntryWithStatus, position: number) => {
      if (!selectedRaceId || !token) return;
      const payload = {
        regatta_id: regattaId,
        sail_number: entry.sail_number ?? null,
        boat_name: entry.boat_name ?? null,
        helm_name: `${entry.first_name} ${entry.last_name}`,
        points: position,
        desired_position: position,
      };
      await apiSend(`/results/races/${selectedRaceId}/result`, 'POST', payload, token);
      setSingleSail('');
      setSinglePos('');
      await refreshExisting(selectedRaceId);
    },
    [selectedRaceId, token, regattaId, refreshExisting]
  );

  // ---- Adicionar 1 em falta — validação com duplicados; se vários com mesmo sail, pedir escolha
  const addSingle = useCallback(async () => {
    if (!selectedRaceId || !token || !selectedClass) return;

    const sail = (singleSail ?? '').trim().toLowerCase();
    const pos = Number(singlePos);
    if (!sail || !pos) { notify.warning('Fill in sail number and position.'); return; }

    const candidates = getCandidatesBySail(entryList, sail, selectedClass).filter(
      (e) => !fleetEntryIdSet || fleetEntryIdSet.has(e.id)
    );

    if (candidates.length === 0) {
      const { best } = pickBestEntryBySail(entryList, sail, selectedClass);
      if (!best) { notify.warning('Entry not found for this class.'); return; }
      if (best.class_name !== selectedClass) {
        notify.warning(`There is an entry with that number, but not in class ${selectedClass}.`);
        return;
      }
      if (!isEligible(best)) { notify.warning('This entry is not eligible (must be PAID and CONFIRMED).'); return; }
      if (fleetEntryIdSet && !fleetEntryIdSet.has(best.id)) {
        notify.warning('This boat does not belong to the selected fleet for this race.');
        return;
      }
      await postSingleResult(best, pos);
      return;
    }

    if (candidates.length > 1) {
      setSailChoicePending({ context: 'single', sail, candidates, singlePos: pos });
      return;
    }

    await postSingleResult(candidates[0], pos);
  }, [
    selectedRaceId,
    token,
    selectedClass,
    singleSail,
    singlePos,
    entryList,
    fleetEntryIdSet,
    postSingleResult,
  ]);

  const addSingleWithChosenEntry = useCallback(
    async (entryId: number) => {
      if (!sailChoicePending || sailChoicePending.context !== 'single' || sailChoicePending.singlePos == null)
        return;
      const entry = sailChoicePending.candidates.find((c) => c.id === entryId);
      if (!entry) return;
      setSailChoicePending(null);
      try {
        await postSingleResult(entry, sailChoicePending.singlePos);
      } catch {
        notify.error('Could not add result.');
      }
    },
    [sailChoicePending, postSingleResult]
  );

  // ---- Corridas: renomear / apagar / reordenar
  const renameRace = async (raceId: number, newName: string) => {
    if (!token) return;
    try {
      const updated = await apiSend<Race>(`/races/${raceId}`, 'PATCH', { name: newName }, token);
      setRaces((prev) => prev.map((r) => (r.id === raceId ? { ...r, ...updated } : r)));
    } catch (e) {
      console.error('renameRace falhou:', e);
      notify.error('Could not rename the race.');
    }
  };

  const deleteRace = async (raceId: number) => {
    if (!token) return;
    try {
      await apiDelete(`/races/${raceId}`, token);
      setRaces((prev) => prev.filter((r) => r.id !== raceId));
      // Remove apenas o draft dessa race (outras races mantêm os seus)
      setDraftByRace((prev) => {
        const next = { ...prev };
        delete next[raceId];
        return next;
      });
      setHandicapDraftByRace((prev) => {
        const next = { ...prev };
        delete next[raceId];
        return next;
      });
      if (selectedRaceId === raceId) {
        setSelectedRaceId(null);
        setExistingResultsRaw([]);
      }
    } catch (e) {
      console.error('deleteRace falhou:', e);
      notify.error('Could not delete the race.');
    }
  };

  const reorderRaces = async (orderedIds: number[]) => {
    if (!token) return;
    try {
      const rcs = await apiSend<Race[]>(
        `/races/regattas/${regattaId}/reorder`,
        'PUT',
        { ordered_ids: orderedIds },
        token
      );
      setRaces(rcs);
    } catch (e: any) {
      console.error('reorderRaces falhou:', e?.status, e?.message);
      notify.error(e?.message || 'Could not reorder the races.');
    }
  };


    // ---- Corridas: flags (discardable / medal / double_points)
  const setRaceDiscardable = async (raceId: number, discardable: boolean): Promise<void> => {
    if (!token) { notify.error('Admin session missing or expired. Please log in again.'); return; }

    try {
      const updated = await apiSend<Race>(`/races/${raceId}`, 'PATCH', { discardable }, token);

      // atualiza races localmente
      setRaces((prev) => prev.map((r) => (r.id === raceId ? { ...r, ...updated } : r)));

      // se esta race estiver selecionada, garante refresh da lista de results
      // (porque overall e lógica podem depender do discardable e tu podes querer refletir já)
      if (selectedRaceId === raceId) {
        // opcional: se queres refletir algo no UI imediatamente
        // await refreshExisting(raceId);
      }
    } catch (e) {
      console.error('setRaceDiscardable falhou:', e);
      notify.error('Could not update the discardable flag for this race.');
    }
  };

  // ---- Handicap: atualizar start time da corrida (apenas hora do dia; não há "dia de partida")
  const patchRaceStart = async (
    raceId: number,
    startTime: string | null
  ): Promise<void> => {
    if (!token) return;

    try {
      const updated = await apiSend<Race>(
        `/races/${raceId}`,
        'PATCH',
        { start_time: startTime || null },
        token
      );
      setRaces((prev) => prev.map((r) => (r.id === raceId ? { ...r, ...updated } : r)));
    } catch (e) {
      console.error('patchRaceStart falhou:', e);
      notify.error('Could not save the race start time.');
    }
  };

  // ---- Handicap: atualizar método de score (manual | anc | orc)
  const patchRaceHandicapMethod = async (
    raceId: number,
    handicapMethod: string | null
  ): Promise<void> => {
    if (!token) {
      router.replace('/admin/login');
      return;
    }

    const value = handicapMethod || 'manual';
    const payload: Record<string, unknown> = { handicap_method: value };
    if (value === 'orc') {
      const current = races.find((r) => r.id === raceId);
      const hasMode = current && (current as any).orc_rating_mode;
      if (!hasMode) payload.orc_rating_mode = 'medium';
    }
    try {
      const updated = await apiSend<Race>(
        `/races/${raceId}`,
        'PATCH',
        payload,
        token
      );
      setRaces((prev) =>
        prev.map((r) =>
          r.id === raceId
            ? { ...r, ...updated, handicap_method: (updated as any)?.handicap_method ?? value }
            : r
        )
      );
    } catch (e) {
      console.error('patchRaceHandicapMethod falhou:', e);
      notify.error('Could not save the scoring method.');
    }
  };

  // ---- Handicap: atualizar modo ORC (low | medium | high)
  const patchRaceOrcMode = async (
    raceId: number,
    orcMode: 'low' | 'medium' | 'high'
  ): Promise<void> => {
    if (!token) {
      router.replace('/admin/login');
      return;
    }
    try {
      const updated = await apiSend<Race>(
        `/races/${raceId}`,
        'PATCH',
        { orc_rating_mode: orcMode },
        token
      );
      setRaces((prev) =>
        prev.map((r) =>
          r.id === raceId ? { ...r, ...updated } : r
        )
      );
    } catch (e) {
      console.error('patchRaceOrcMode falhou:', e);
      notify.error('Could not save the ORC mode.');
    }
  };

  return {
    // state
    scoring,
    setScoring,
    savingScoring,
    races,
    scoresBootstrapPending,
    selectedRaceId,
    setSelectedRaceId,
    selectedClass,
    isHandicapClass,
    currentRace,
    regattaNameForExport,
    existingResults,
    loadingExisting,
    availableEntries,
    allEntries: entryList,
    handicapEligibleEntries,
    draft, // DraftLine[] compatível com DraftResult[]
    draftInput,
    setDraftInput,
    handicapDraft,
    singleSail,
    setSingleSail,
    singlePos,
    setSinglePos,

    // Fleets
    fleetsForRace,
    entryIdToFleetName,
    selectedFleetId,
    setSelectedFleetId,

    // códigos e descartes efetivos (classe > global)
    scoringCodes, // só mapping fixo
    effectiveDiscardCount,
    effectiveDiscardThreshold,
    classSettings,

    // helpers (úteis no UI)
    isAutoNPlusOne,
    isAdjustable,

    // escolha quando há vários barcos com o mesmo nº de vela
    sailChoicePending,
    addDraftByChosenEntry,
    addSingleWithChosenEntry,
    clearSailChoicePending,

    // actions
    saveScoring,
    addDraftBySail,
    addDraftEntry,
    removeDraft,
    moveDraft,
    onSetDraftPos,
    onSetDraftCode,
    onSetDraftPoints, // ✅ NOVO para RDG/SCP/ZPF/DPI
    saveBulk,
    addHandicapEntry,
    removeHandicapEntry,
    updateHandicapField,
    updateHandicapCode,
    patchHandicapResultFields,
    saveHandicap,
    moveRow,
    savePosition,
    addSingle,
    markCode, // ✅ agora: (rowId, code, points?)
    deleteResult,

    // races management
    renameRace,
    deleteRace,
    reorderRaces,
    refreshRaces,
    refreshExisting,

    setRaceDiscardable,
    patchRaceStart,
    patchRaceHandicapMethod,
    patchRaceOrcMode,
  };
}
