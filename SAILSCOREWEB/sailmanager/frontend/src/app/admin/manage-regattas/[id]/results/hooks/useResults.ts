'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiGet, apiSend, apiDelete } from '@/lib/api';
import type { Entry, Race, ApiResult, DraftResult, ScoringConfig } from '../types';

type EntryWithStatus = Entry & {
  paid?: boolean | null;
  confirmed?: boolean | null;
};

export function useResults(
  regattaId: number,
  token?: string,
  newlyCreatedRace?: Race | null
) {
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
    () => races.find(r => r.id === selectedRaceId) ?? null,
    [races, selectedRaceId]
  );
  const selectedClass = selectedRace?.class_name ?? null;

  // ---- Resultados existentes
  const [existingResults, setExistingResults] = useState<ApiResult[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);

  // ---- Rascunho (bulk)
  const [draft, setDraft] = useState<DraftResult[]>([]);
  const [draftInput, setDraftInput] = useState('');

  // ---- Adicionar 1 em falta
  const [singleSail, setSingleSail] = useState('');
  const [singlePos, setSinglePos] = useState<number | ''>('');

  // ---- Helpers elegibilidade / escolha melhor entry quando há duplicados
  const isEligible = (e: EntryWithStatus) => !!e.paid && !!e.confirmed;

  function pickBestEntryBySail(
    entries: EntryWithStatus[],
    sailLower: string,
    wantedClass: string | null
  ): { best: EntryWithStatus | null; reason: 'ok' | 'not-found' | 'same-class-not-eligible' | 'diff-class' } {
    const sameSail = entries.filter(e => (e.sail_number || '').toLowerCase() === sailLower);
    if (!sameSail.length) return { best: null, reason: 'not-found' };

    if (wantedClass) {
      const sameClassEligible = sameSail.find(e => e.class_name === wantedClass && isEligible(e));
      if (sameClassEligible) return { best: sameClassEligible, reason: 'ok' };

      const sameClassAny = sameSail.find(e => e.class_name === wantedClass);
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
          discard_threshold: typeof regatta.discard_threshold === 'number' ? regatta.discard_threshold : 4,
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
    setRaces(prev => {
      const exists = prev.some(r => r.id === newlyCreatedRace.id);
      const next = exists ? prev : [...prev, newlyCreatedRace];
      return next.slice().sort((a: any, b: any) =>
        (a.order_index ?? a.id) - (b.order_index ?? b.id)
      );
    });
    setSelectedRaceId(newlyCreatedRace.id);
    setDraft([]);
    setExistingResults([]);
  }, [newlyCreatedRace]);

  const refreshExisting = useCallback(async (raceId: number) => {
    setLoadingExisting(true);
    try {
      const data = await apiGet<ApiResult[]>(`/results/races/${raceId}/results`);
      setExistingResults(data);
    } catch {
      setExistingResults([]);
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

  // ---------- NOVO: Settings por classe ----------
  const [classSettings, setClassSettings] = useState<{
    discard_count: number;
    discard_threshold: number;
    scoring_codes: Record<string, number>;
  } | null>(null);

  // Carregar settings por classe quando a classe selecionada muda (aceita {resolved:{...}} ou direto)
  useEffect(() => {
    (async () => {
      if (!selectedClass) { setClassSettings(null); return; }
      try {
        const res = await apiGet<any>(
          `/regattas/${regattaId}/class-settings/${encodeURIComponent(selectedClass)}`
        );
        const resolved = (res?.resolved ?? res) || {};
        setClassSettings({
          discard_count: Number(
            typeof resolved.discard_count === 'number'
              ? resolved.discard_count
              : (typeof scoring.discard_count === 'number' ? scoring.discard_count : 0)
          ),
          discard_threshold: Number(
            typeof resolved.discard_threshold === 'number'
              ? resolved.discard_threshold
              : (typeof scoring.discard_threshold === 'number' ? scoring.discard_threshold : 0)
          ),
          scoring_codes: resolved.scoring_codes ? resolved.scoring_codes : {},
        });
      } catch {
        setClassSettings(null); // fallback para globais
      }
    })();
    // intencionalmente sem 'scoring' nas deps para evitar re-fetch em edits globais
  }, [regattaId, selectedClass]);

  // *Merge* de códigos: globais (regata) + override por classe (classe ganha)
  const scoringCodes = useMemo(() => {
    const global = scoring.code_points ?? {};
    const perClass = classSettings?.scoring_codes ?? {};
    const merged: Record<string, number> = {};

    for (const [k, v] of Object.entries(global)) {
      merged[String(k).toUpperCase()] = Number(v);
    }
    for (const [k, v] of Object.entries(perClass)) {
      merged[String(k).toUpperCase()] = Number(v);
    }
    return merged;
  }, [scoring.code_points, classSettings]);

  // Descartes efetivos a usar na UI/lógica (classe > global)
  const effectiveDiscardCount = classSettings?.discard_count ?? scoring.discard_count ?? 0;
  const effectiveDiscardThreshold = classSettings?.discard_threshold ?? scoring.discard_threshold ?? 0;

  // Derivados — apenas entries da classe selecionada, elegíveis, não já no rascunho
  // + deduplicação por nº de vela (fica a primeira!)
  const availableEntries = useMemo(() => {
    const filtered = entryList.filter(
      e =>
        e.class_name === selectedClass &&
        isEligible(e) &&
        !draft.some(r => r.entryId === e.id)
    );
    const seen = new Set<string>();
    return filtered.filter(e => {
      const key = (e.sail_number || '').toLowerCase();
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [entryList, selectedClass, draft]);

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

    const { best } = pickBestEntryBySail(entryList, trimmed, selectedClass);

    if (!best) {
      alert('Embarcação não encontrada com esse número de vela.');
      return;
    }
    if (best.class_name !== selectedClass) {
      alert(`Esta embarcação não pertence à classe ${selectedClass}.`);
      return;
    }
    if (!isEligible(best)) {
      alert('Esta inscrição não está elegível (necessita estar PAGA e CONFIRMADA).');
      return;
    }
    if (draft.some(r => r.entryId === best.id)) {
      alert('Essa embarcação já está no rascunho.');
      return;
    }

    setDraft(d => [...d, { position: d.length + 1, entryId: best.id, code: null }]);
    setDraftInput('');
  };

  const addDraftEntry = (entryId: number) => {
    setDraft(d => [...d, { position: d.length + 1, entryId, code: null }]);
  };

  const removeDraft = (entryId: number) => {
    setDraft(d =>
      d.filter(r => r.entryId !== entryId).map((r, i) => ({ ...r, position: i + 1 }))
    );
  };

  const moveDraft = (index: number, dir: -1 | 1) => {
    setDraft(d => {
      const tgt = index + dir;
      if (tgt < 0 || tgt >= d.length) return d;
      const copy = [...d];
      [copy[index], copy[tgt]] = [copy[tgt], copy[index]];
      return copy.map((r, i) => ({ ...r, position: i + 1 }));
    });
  };

  const onSetDraftPos = (entryId: number, pos: number) => {
    const newPos = Math.max(1, Number(pos) || 1);
    setDraft(d => {
      const copy = d.map(r => (r.entryId === entryId ? { ...r, position: newPos } : r));
      return copy.sort((a, b) => a.position - b.position).map((r, i) => ({ ...r, position: i + 1 }));
    });
  };

  const onSetDraftCode = (entryId: number, code: string | null) => {
    setDraft(d => d.map(r => (r.entryId === entryId ? { ...r, code: code || undefined } : r)));
  };

  // Pontos: usa códigos *merged* (classe > global), senão posição
  const computePoints = (pos: number, code?: string | null) => {
    if (code) {
      const key = String(code).toUpperCase();
      if (key in scoringCodes) return Number(scoringCodes[key]);
    }
    return pos;
  };

  // ---- EXISTENTES: código
  const markCode = async (rowId: number, code: string | null) => {
    if (!selectedRaceId || !token) return;
    const normalized = code ? code.toUpperCase() : null;

    setExistingResults(prev =>
      prev.map(r =>
        r.id === rowId
          ? { ...r, code: normalized ?? null, points: computePoints(r.position, normalized) }
          : r
      )
    );

    try {
      await apiSend(`/results/${rowId}/code`, 'PATCH', { code: normalized ?? '' }, token);
      await refreshExisting(selectedRaceId);
    } catch (err) {
      console.error('markCode falhou:', err);
      await refreshExisting(selectedRaceId);
      alert('Não foi possível aplicar o código a este resultado.');
    }
  };

  const saveBulk = async () => {
    if (!selectedRaceId || !token) return;

    const payload = draft.map(r => {
      const entry = entryList.find(e => e.id === r.entryId)!;
      const pts = computePoints(r.position, r.code);
      return {
        regatta_id: regattaId,
        race_id: selectedRaceId,
        sail_number: entry.sail_number,
        boat_name: entry.boat_name,
        helm_name: `${entry.first_name} ${entry.last_name}`,
        position: r.position,
        points: pts,
        code: r.code ?? null,
      };
    });

    try {
      await apiSend(`/results/races/${selectedRaceId}/results`, 'POST', payload, token);
      setDraft([]);
      await refreshExisting(selectedRaceId);
      alert('Resultados guardados com sucesso.');
    } catch {
      alert('Erro ao guardar resultados.');
    }
  };

  // ---- EXISTENTES: mover / guardar ordem / posição / apagar
  const moveRow = async (rowId: number, delta: -1 | 1) => {
    if (!selectedRaceId || !token || loadingExisting) return;
    const sorted = existingResults.slice().sort((a, b) => a.position - b.position);
    const idx = sorted.findIndex(r => r.id === rowId);
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
    const ordered = existingResults.slice().sort((a, b) => a.position - b.position).map(r => r.id);
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

  // ---- Adicionar 1 em falta — validação com duplicados
  const addSingle = useCallback(async () => {
    if (!selectedRaceId || !token || !selectedClass) return;
    const sail = (singleSail ?? '').trim().toLowerCase();
    const pos = Number(singlePos);
    if (!sail || !pos) {
      alert('Preenche Nº de vela e posição.');
      return;
    }

    const { best } = pickBestEntryBySail(entryList, sail, selectedClass);

    if (!best) {
      alert('Entrada não encontrada para esta classe.');
      return;
    }
    if (best.class_name !== selectedClass) {
      alert(`Existe uma inscrição com esse nº, mas não na classe ${selectedClass}.`);
      return;
    }
    if (!isEligible(best)) {
      alert('Esta inscrição não está elegível (necessita estar PAGA e CONFIRMADA).');
      return;
    }

    const payload = {
      regatta_id: regattaId,
      sail_number: best.sail_number ?? null,
      boat_name: best.boat_name ?? null,
      helm_name: `${best.first_name} ${best.last_name}`,
      points: pos,
      desired_position: pos,
    };

    try {
      await apiSend(`/results/races/${selectedRaceId}/result`, 'POST', payload, token);
      setSingleSail('');
      setSinglePos('');
      await refreshExisting(selectedRaceId);
    } catch {
      alert('Não foi possível adicionar.');
    }
  }, [
    selectedRaceId, token, selectedClass,
    singleSail, singlePos, entryList, regattaId, refreshExisting
  ]);

  // ---- Corridas: renomear / apagar / reordenar
  const renameRace = async (raceId: number, newName: string) => {
    if (!token) return;
    try {
      const updated = await apiSend<Race>(`/races/${raceId}`, 'PATCH', { name: newName }, token);
      setRaces(prev => prev.map(r => (r.id === raceId ? { ...r, ...updated } : r)));
    } catch (e) {
      console.error('renameRace falhou:', e);
      alert('Não foi possível renomear a corrida.');
    }
  };

  const deleteRace = async (raceId: number) => {
    if (!token) return;
    try {
      await apiDelete(`/races/${raceId}`, token);
      setRaces(prev => prev.filter(r => r.id !== raceId));
      if (selectedRaceId === raceId) {
        setSelectedRaceId(null);
        setExistingResults([]);
        setDraft([]);
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

  return {
    // state
    scoring, setScoring, savingScoring,
    races, selectedRaceId, setSelectedRaceId, selectedClass,
    existingResults, loadingExisting,
    availableEntries, draft, draftInput, setDraftInput,
    singleSail, setSingleSail, singlePos, setSinglePos,

    // códigos e descartes efetivos (classe > global)
    scoringCodes,                       // merged (classe override)
    effectiveDiscardCount,
    effectiveDiscardThreshold,
    classSettings,                      // caso a UI queira mostrar a origem/override

    // actions
    saveScoring,
    addDraftBySail, addDraftEntry, removeDraft, moveDraft,
    onSetDraftPos, onSetDraftCode,
    saveBulk,
    moveRow, savePosition, saveOrder,
    addSingle,
    markCode,
    deleteResult,

    // races management
    renameRace, deleteRace, reorderRaces, refreshRaces,
  };
}
