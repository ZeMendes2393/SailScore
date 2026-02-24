'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, apiSend, apiDelete } from '@/lib/api';
import type { Entry, Race, ApiResult, DraftResult, ScoringConfig } from '../types';

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
  notes?: string | null;
};

export function useResults(regattaId: number, token?: string, newlyCreatedRace?: Race | null) {
  const router = useRouter();

  // ---- Scoring / Descartes + Códigos (globais da regata)
  const [scoring, setScoring] = useState<ScoringConfig>({
    discard_count: 0,
    discard_threshold: 4,
    code_points: {},
  });
  const [savingScoring, setSavingScoring] = useState(false);

  // ---- Dados base
  const [entryList, setEntryList] = useState<EntryWithStatus[]>([]);
  const [races, setRaces] = useState<Race[]>([]);
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

  // ---- Rascunho (bulk)
  const [draft, setDraft] = useState<DraftLine[]>([]);
  const [draftInput, setDraftInput] = useState('');

  // ---- Handicap / Time Scoring (bulk por tempos)
  const [handicapDraft, setHandicapDraft] = useState<HandicapDraftLine[]>([]);

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
  useEffect(() => {
    (async () => {
      try {
        const regatta = await apiGet<any>(`/regattas/${regattaId}`);
        setScoring({
          discard_count: typeof regatta.discard_count === 'number' ? regatta.discard_count : 0,
          discard_threshold:
            typeof regatta.discard_threshold === 'number' ? regatta.discard_threshold : 4,
          code_points: regatta.scoring_codes ?? {},
        });
      } catch {}

      try {
        const [entries, rcs] = await Promise.all([
          apiGet<EntryWithStatus[]>(`/entries/by_regatta/${regattaId}`),
          apiGet<Race[]>(`/races/by_regatta/${regattaId}`), // já vem ordenado
        ]);
        setEntryList(entries);
        setRaces(rcs);
      } catch {}
    })();
  }, [regattaId]);

  // Integrar nova corrida criada
  useEffect(() => {
    if (!newlyCreatedRace) return;
    setRaces((prev) => {
      const exists = prev.some((r) => r.id === newlyCreatedRace.id);
      const next = exists ? prev : [...prev, newlyCreatedRace];
      return next.slice().sort((a: any, b: any) => (a.order_index ?? a.id) - (b.order_index ?? b.id));
    });
    setSelectedRaceId(newlyCreatedRace.id);
    setDraft([]);
    setHandicapDraft([]);
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
    if (selectedRaceId) refreshExisting(selectedRaceId);
  }, [selectedRaceId, refreshExisting]);

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

  const sailToEntryIds = useMemo(() => {
    const map = new Map<string, number[]>();
    entryList.forEach((e) => {
      const sn = (e.sail_number ?? '').trim().toUpperCase();
      if (!sn) return;
      const arr = map.get(sn) ?? [];
      arr.push(e.id);
      map.set(sn, arr);
    });
    return map;
  }, [entryList]);

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
      const sn = (r.sail_number ?? '').trim().toUpperCase();
      if (!sn) return false;
      const ids = sailToEntryIds.get(sn);
      if (!ids || !ids.length) return false;
      return ids.some((id) => fleetEntryIdSet.has(id));
    });
  }, [existingResultsRaw, fleetEntryIdSet, sailToEntryIds]);

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
    // Apaga apenas os resultados pertencentes à fleet selecionada
    const fleetSails = new Set<string>();
    entryList.forEach((e) => {
      if (!fleetEntryIdSet.has(e.id)) return;
      const sn = (e.sail_number ?? '').trim().toUpperCase();
      if (sn) fleetSails.add(sn);
    });

    toDeleteIds = allRows
      .filter((r) => {
        const sn = (r.sail_number ?? '').trim().toUpperCase();
        return sn && fleetSails.has(sn);
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
]);


  // ---- Ações: scoring (globais da regata)
  const saveScoring = async () => {
    if (!token) return alert('Token em falta. Faz login novamente.');
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
      alert('Regras de descarte / códigos (globais) guardadas com sucesso.');
    } catch {
      alert('Falha ao guardar regras globais de descarte / códigos.');
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
      if (!best) return alert('Embarcação não encontrada com esse número de vela.');
      if (best.class_name !== selectedClass) return alert(`Esta embarcação não pertence à classe ${selectedClass}.`);
      if (!isEligible(best)) return alert('Esta inscrição não está elegível (necessita estar PAGA e CONFIRMADA).');
      if (draft.some((r) => r.entryId === best.id)) return alert('Essa embarcação já está no rascunho.');
      if (fleetEntryIdSet && !fleetEntryIdSet.has(best.id))
        return alert('Esta embarcação não pertence à fleet selecionada para esta corrida.');
      setDraft((d) => [...d, { position: d.length + 1, entryId: best.id, code: null, manualPoints: null }]);
      setDraftInput('');
      return;
    }

    if (candidates.length > 1) {
      setSailChoicePending({ context: 'draft', sail: trimmed, candidates });
      return;
    }

    setDraft((d) => [...d, { position: d.length + 1, entryId: candidates[0].id, code: null, manualPoints: null }]);
    setDraftInput('');
  };

  const addDraftByChosenEntry = useCallback((entryId: number) => {
    if (!sailChoicePending || sailChoicePending.context !== 'draft') return;
    const entry = sailChoicePending.candidates.find((c) => c.id === entryId);
    if (!entry) return;
    if (fleetEntryIdSet && !fleetEntryIdSet.has(entryId))
      return alert('Esta embarcação não pertence à fleet selecionada para esta corrida.');
    if (draft.some((r) => r.entryId === entryId)) return alert('Essa embarcação já está no rascunho.');
    setDraft((d) => [...d, { position: d.length + 1, entryId, code: null, manualPoints: null }]);
    setDraftInput('');
    setSailChoicePending(null);
  }, [sailChoicePending, fleetEntryIdSet, draft]);

  const clearSailChoicePending = useCallback(() => {
    setSailChoicePending(null);
  }, []);

  const addDraftEntry = (entryId: number) => {
    if (fleetEntryIdSet && !fleetEntryIdSet.has(entryId))
      return alert('Esta embarcação não pertence à fleet selecionada para esta corrida.');

    setDraft((d) => [...d, { position: d.length + 1, entryId, code: null, manualPoints: null }]);
  };

  const removeDraft = (entryId: number) => {
    setDraft((d) => d.filter((r) => r.entryId !== entryId).map((r, i) => ({ ...r, position: i + 1 })));
  };

  const moveDraft = (index: number, dir: -1 | 1) => {
    setDraft((d) => {
      const tgt = index + dir;
      if (tgt < 0 || tgt >= d.length) return d;
      const copy = [...d];
      [copy[index], copy[tgt]] = [copy[tgt], copy[index]];
      return copy.map((r, i) => ({ ...r, position: i + 1 }));
    });
  };

  const onSetDraftPos = (entryId: number, pos: number) => {
    const newPos = Math.max(1, Number(pos) || 1);
    setDraft((d) => {
      const copy = d.map((r) => (r.entryId === entryId ? { ...r, position: newPos } : r));
      return copy.sort((a, b) => a.position - b.position).map((r, i) => ({ ...r, position: i + 1 }));
    });
  };

  const onSetDraftCode = (entryId: number, code: string | null) => {
    const c = normCode(code);
    setDraft((d) =>
      d.map((r) => {
        if (r.entryId !== entryId) return r;
        const keepManual = isAdjustable(c);
        return { ...r, code: c, manualPoints: keepManual ? (r.manualPoints ?? null) : null };
      })
    );
  };

  const onSetDraftPoints = (entryId: number, points: number | null) => {
    const v = points == null ? null : Number(points);
    setDraft((d) => d.map((r) => (r.entryId === entryId ? { ...r, manualPoints: v } : r)));
  };

  // =====================================================
  // Handicap / Time Scoring: helpers de rascunho
  // =====================================================

  const addHandicapEntry = (entryId: number) => {
    if (!isHandicapClass) {
      alert('O modo "Time Scoring (Handicap)" só está disponível para classes do tipo handicap.');
      return;
    }

    if (fleetEntryIdSet && !fleetEntryIdSet.has(entryId)) {
      alert('Esta embarcação não pertence à fleet selecionada para esta corrida.');
      return;
    }

    if (handicapDraft.some((r) => r.entryId === entryId)) {
      alert('Essa embarcação já está na tabela de tempos.');
      return;
    }

    setHandicapDraft((prev) => [
      ...prev,
      {
        entryId,
        finishTime: '',
        finishDay: 0,
        elapsedTime: '',
        correctedTime: '',
        code: null,
        notes: '',
      },
    ]);
  };

  const removeHandicapEntry = (entryId: number) => {
    setHandicapDraft((prev) => prev.filter((r) => r.entryId !== entryId));
  };

  const updateHandicapField = (
    entryId: number,
    field: 'finishTime' | 'finishDay' | 'elapsedTime' | 'correctedTime',
    value: string | number
  ) => {
    setHandicapDraft((prev) =>
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
    setHandicapDraft((prev) =>
      prev.map((r) => (r.entryId === entryId ? { ...r, code: c } : r))
    );
  };

  const updateHandicapNotes = (entryId: number, notes: string) => {
    setHandicapDraft((prev) =>
      prev.map((r) => (r.entryId === entryId ? { ...r, notes } : r))
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
      alert('Não foi possível aplicar o código a este resultado.');
    }
  };

  // ---- Handicap / Time Scoring: guardar em massa
  const saveHandicap = async () => {
    if (!selectedRaceId) return alert('Seleciona primeiro uma corrida.');
    if (!token) return alert('Sessão de admin em falta ou expirada. Faz login novamente.');
    if (!isHandicapClass) return alert('Time Scoring só está disponível para classes handicap.');
    if (!handicapDraft.length) return alert('Não há linhas na tabela de tempos para guardar.');

    if (currentRace?.handicap_method === 'anc') {
      const withoutRating = handicapDraft.filter((r) => {
        const entry = entryList.find((e) => e.id === r.entryId);
        return !entry || typeof entry.rating !== 'number' || Number.isNaN(entry.rating);
      });
      if (withoutRating.length > 0) {
        return alert(
          'Há barcos sem rating ANC. É necessário preencher o rating ANC nas inscrições antes de usar o modo ANC.'
        );
      }
    }

    if (currentRace?.handicap_method === 'orc') {
      const orcMode = (currentRace as any).orc_rating_mode || 'medium';
      const fieldMap = { low: 'orc_low', medium: 'orc_medium', high: 'orc_high' } as const;
      const field = fieldMap[orcMode as keyof typeof fieldMap] ?? 'orc_medium';
      const withoutOrc = handicapDraft.filter((r) => {
        const entry = entryList.find((e) => e.id === r.entryId);
        const val = entry ? (entry as any)[field] : null;
        return !entry || typeof val !== 'number' || Number.isNaN(val);
      });
      if (withoutOrc.length > 0) {
        return alert(
          `Há barcos sem rating ORC (${orcMode}). É necessário preencher o ORC ${orcMode} nas inscrições antes de usar o modo ORC.`
        );
      }
    }

    const isValidHHMMSS = (v: string) => /^\d{1,2}:\d{2}:\d{2}$/.test((v ?? '').trim());

    // validação mínima dos tempos para barcos em ranking (sem códigos auto N+1)
    for (const r of handicapDraft) {
      const entry = entryList.find((e) => e.id === r.entryId);
      if (!entry) {
        console.warn('Entry em falta para handicapDraft', r.entryId);
        return alert('Há linhas com inscrição desconhecida. Recarrega a página.');
      }

      const codeNorm = normCode(r.code);
      const outOfRanking = isAutoNPlusOne(codeNorm);

      // Para barcos em ranking, exige todos os tempos em HH:MM:SS (elapsed usa-se para handicap)
      if (
        !outOfRanking &&
        (!isValidHHMMSS(r.finishTime) ||
          !isValidHHMMSS(r.elapsedTime) ||
          !isValidHHMMSS(r.correctedTime))
      ) {
        alert(
          `Tempos inválidos para o barco ${entry.sail_number}. Usa sempre o formato HH:MM:SS em todos os campos.`
        );
        return;
      }
    }

    // RESCORE: se já existem resultados, apagamos no scope certo
    if ((existingResultsRaw?.length ?? 0) > 0) {
      const raceHasFleets = !!(
        currentRace &&
        'fleet_set_id' in currentRace &&
        (currentRace as any).fleet_set_id
      );

      const msg =
        raceHasFleets && selectedFleetId !== 'all'
          ? 'Isto vai substituir os resultados desta FLEET (modo Handicap) nesta corrida. Continuar?'
          : 'Isto vai substituir TODOS os resultados desta corrida (modo Handicap). Continuar?';

      if (!confirm(msg)) return;

      await deleteExistingResultsInScope();
      setExistingResultsRaw([]);
    }

    const payload = handicapDraft
      .map((r) => {
        const entry = entryList.find((e) => e.id === r.entryId);
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
          notes: (r.notes ?? '').trim() || null,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (!payload.length) return alert('Nenhuma entrada válida para guardar (ver consola).');

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

      setHandicapDraft([]);
      await refreshExisting(selectedRaceId);
      alert('Resultados de Handicap guardados com sucesso.');
    } catch (err) {
      console.error('Erro ao guardar resultados Handicap:', err);
      alert('Erro ao guardar resultados Handicap.');
    }
  };

 const saveBulk = async () => {
  if (!selectedRaceId) return alert('Seleciona primeiro uma corrida.');
  if (!token) return alert('Sessão de admin em falta ou expirada. Faz login novamente.');
  if (!draft.length) return alert('Não há linhas no rascunho para guardar.');

  // valida: todos os adjustable têm manualPoints
  for (const r of draft) {
    const c = normCode(r.code);
    if (isAdjustable(c) && (r.manualPoints == null || Number.isNaN(Number(r.manualPoints)))) {
      alert(`Falta definir points para o código ${c} (RDG/SCP/ZPF/DPI).`);
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

    const msg =
      raceHasFleets && selectedFleetId !== 'all'
        ? 'Isto vai substituir os resultados desta FLEET nesta corrida. Continuar?'
        : 'Isto vai substituir TODOS os resultados desta corrida. Continuar?';

    if (!confirm(msg)) return;

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

  if (!payload.length) return alert('Nenhuma entrada válida para guardar (ver consola).');

  // Adicionar o parâmetro fleet_id se uma fleet específica estiver selecionada
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

    // ✅ Backend deve: normalizar posições + preencher missing como DNC **apenas na fleet não escoreada**
    setDraft([]); // Limpa o rascunho
    await refreshExisting(selectedRaceId); // Atualiza os resultados
    alert('Resultados guardados com sucesso.');
  } catch (err) {
    console.error('Erro ao guardar resultados em massa:', err);
    alert('Erro ao guardar resultados.');
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
      alert('Não foi possível mover.');
    }
  };

  const savePosition = async (rowId: number, newPos: number) => {
    if (!selectedRaceId || !token || newPos <= 0) return;
    try {
      await apiSend(`/results/${rowId}/position`, 'PATCH', { new_position: newPos }, token);
      await refreshExisting(selectedRaceId);
    } catch {
      alert('Não foi possível atualizar a posição.');
    }
  };

  const saveOrder = async () => {
    if (!selectedRaceId || !token) return;
    const ordered = existingResults
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((r) => r.id);

    try {
      await apiSend(`/results/races/${selectedRaceId}/reorder`, 'PUT', { ordered_ids: ordered }, token);
      await refreshExisting(selectedRaceId);
      alert('Ordem guardada.');
    } catch {
      alert('Falha ao guardar a ordem.');
    }
  };

  const deleteResult = async (rowId: number) => {
    if (!selectedRaceId || !token) return;
    try {
      await apiDelete(`/results/${rowId}`, token);
      await refreshExisting(selectedRaceId);
    } catch (e) {
      console.error('DELETE resultado falhou:', e);
      alert('Não foi possível eliminar o resultado.');
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
    if (!sail || !pos) return alert('Preenche Nº de vela e posição.');

    const candidates = getCandidatesBySail(entryList, sail, selectedClass).filter(
      (e) => !fleetEntryIdSet || fleetEntryIdSet.has(e.id)
    );

    if (candidates.length === 0) {
      const { best } = pickBestEntryBySail(entryList, sail, selectedClass);
      if (!best) return alert('Entrada não encontrada para esta classe.');
      if (best.class_name !== selectedClass)
        return alert(`Existe uma inscrição com esse nº, mas não na classe ${selectedClass}.`);
      if (!isEligible(best)) return alert('Esta inscrição não está elegível (necessita estar PAGA e CONFIRMADA).');
      if (fleetEntryIdSet && !fleetEntryIdSet.has(best.id))
        return alert('Esta embarcação não pertence à fleet selecionada para esta corrida.');
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
        alert('Não foi possível adicionar.');
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
      alert('Não foi possível renomear a corrida.');
    }
  };

  const deleteRace = async (raceId: number) => {
    if (!token) return;
    try {
      await apiDelete(`/races/${raceId}`, token);
      setRaces((prev) => prev.filter((r) => r.id !== raceId));
      if (selectedRaceId === raceId) {
        setSelectedRaceId(null);
        setExistingResultsRaw([]);
        setDraft([]);
        setHandicapDraft([]);
      }
    } catch (e) {
      console.error('deleteRace falhou:', e);
      alert('Não foi possível eliminar a corrida.');
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
      alert(e?.message || 'Não foi possível reordenar as corridas.');
    }
  };


    // ---- Corridas: flags (discardable / medal / double_points)
  const setRaceDiscardable = async (raceId: number, discardable: boolean): Promise<void> => {
    if (!token) return alert('Sessão de admin em falta ou expirada. Faz login novamente.');

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
      alert('Não foi possível atualizar o discardable desta corrida.');
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
      alert('Não foi possível guardar o start time da corrida.');
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
      alert('Não foi possível guardar o método de score.');
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
      alert('Não foi possível guardar o modo ORC.');
    }
  };

  return {
    // state
    scoring,
    setScoring,
    savingScoring,
    races,
    selectedRaceId,
    setSelectedRaceId,
    selectedClass,
    isHandicapClass,
    currentRace,
    existingResults,
    loadingExisting,
    availableEntries,
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
    updateHandicapNotes,
    saveHandicap,
    moveRow,
    savePosition,
    saveOrder,
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
