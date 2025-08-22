'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiGet, apiSend, apiDelete } from '@/lib/api';
import type { Entry, Race, ApiResult, DraftResult, ScoringConfig } from '../types';

export function useResults(
  regattaId: number,
  token?: string,
  newlyCreatedRace?: Race | null
) {
  // ---- Scoring / Descartes + Códigos
  const [scoring, setScoring] = useState<ScoringConfig>({
    discard_count: 0,
    discard_threshold: 4,
    code_points: {}, // mapa ex.: { DNF: 99, DNC: 99, DSQ: 99 }
  });
  const [savingScoring, setSavingScoring] = useState(false);

  // mapa desnormalizado para conveniência
  const scoringCodes = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(scoring.code_points ?? {}).map(([k, v]) => [
          k.toUpperCase(),
          Number(v),
        ])
      ),
    [scoring.code_points]
  );

  // ---- Dados base
  const [entryList, setEntryList] = useState<Entry[]>([]);
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

  // Carregar scoring + listas
  useEffect(() => {
    (async () => {
      try {
        const regatta = await apiGet<any>(`/regattas/${regattaId}`);
        setScoring({
          discard_count:
            typeof regatta.discard_count === 'number' ? regatta.discard_count : 0,
          discard_threshold:
            typeof regatta.discard_threshold === 'number' ? regatta.discard_threshold : 4,
          code_points: regatta.scoring_codes ?? {}, // <- códigos vindos do backend
        });
      } catch {
        /* noop */
      }

      try {
        const [entries, rcs] = await Promise.all([
          apiGet<Entry[]>(`/entries/by_regatta/${regattaId}`),
          apiGet<Race[]>(`/races/by_regatta/${regattaId}`),
        ]);
        setEntryList(entries);
        setRaces(rcs);
      } catch {
        /* noop */
      }
    })();
  }, [regattaId]);

  // Integrar nova corrida criada
  useEffect(() => {
    if (!newlyCreatedRace) return;
    setRaces(prev => [...prev, newlyCreatedRace]);
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

  useEffect(() => {
    if (selectedRaceId) refreshExisting(selectedRaceId);
  }, [selectedRaceId, refreshExisting]);

  // Derivados
  const availableEntries = useMemo(
    () =>
      entryList.filter(
        e => e.class_name === selectedClass && !draft.some(r => r.entryId === e.id)
      ),
    [entryList, selectedClass, draft]
  );

  // ---- Ações: scoring
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
      window.dispatchEvent(
        new CustomEvent('regatta-scoring-updated', { detail: { regattaId } })
      );
      alert('Regras de descarte / códigos guardadas com sucesso.');
    } catch {
      alert('Falha ao guardar regras de descarte / códigos.');
    } finally {
      setSavingScoring(false);
    }
  };

  // ---- Ações: rascunho (bulk)
  const addDraftBySail = () => {
    const trimmed = draftInput.trim().toLowerCase();
    if (!trimmed || !selectedClass) return;

    const matched = entryList.find(
      e => (e.sail_number || '').toLowerCase() === trimmed
    );
    if (!matched) return alert('Embarcação não encontrada com esse número de vela.');
    if (matched.class_name !== selectedClass)
      return alert(`Esta embarcação não pertence à classe ${selectedClass}.`);
    if (draft.some(r => r.entryId === matched.id))
      return alert('Essa embarcação já está no rascunho.');

    setDraft(d => [...d, { position: d.length + 1, entryId: matched.id, code: null }]);
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

  // 👇 setters usados pelo DraftResultsEditor
  const onSetDraftPos = (entryId: number, pos: number) => {
    const newPos = Math.max(1, Number(pos) || 1);
    setDraft(d => {
      const copy = d.map(r => (r.entryId === entryId ? { ...r, position: newPos } : r));
      // ordena por posição e reindexa 1..N
      return copy
        .sort((a, b) => a.position - b.position)
        .map((r, i) => ({ ...r, position: i + 1 }));
    });
  };

  const onSetDraftCode = (entryId: number, code: string | null) => {
    setDraft(d =>
      d.map(r => (r.entryId === entryId ? { ...r, code: code || undefined } : r))
    );
  };

  const computePoints = (pos: number, code?: string | null) => {
    if (code && scoringCodes && code in scoringCodes) return scoringCodes[code];
    return pos;
  };

  // ---- Marcar/limpar código (DNF/DNC/DSQ...) num resultado existente
  const markCode = async (rowId: number, code: string | null) => {
    if (!selectedRaceId || !token) return;

    const row = existingResults.find(r => r.id === rowId);
    if (!row) return;

    if (!row.sail_number) {
      alert('Não é possível marcar código porque este resultado não tem nº de vela.');
      return;
    }

    // pontos = código (se existir) ou a própria posição
    const pts =
      code && scoringCodes[code] != null
        ? Number(scoringCodes[code])
        : Number(row.position);

    try {
      await apiSend(
        `/results/races/${selectedRaceId}/result`,
        'PUT',
        {
          regatta_id: regattaId,
          sail_number: row.sail_number,
          boat_name: row.boat_name ?? null,
          helm_name: row.skipper_name ?? null,
          position: row.position, // mantém a posição
          points: pts,            // aplica os pontos do código
          // Se no futuro adicionares "code" ao backend e schemas, podes enviar aqui também.
          // code: code,
        },
        token
      );

      await refreshExisting(selectedRaceId);
    } catch (e) {
      console.error('markCode falhou:', e);
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
        position: r.position, // posição “oficial” (mesmo com código)
        points: pts,          // pontos ajustados pelo código, se houver
        // code: r.code ?? null, // <- mantém comentado até o backend suportar
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

  // ---- Ações: existentes
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
    const ordered = existingResults
      .slice()
      .sort((a, b) => a.position - b.position)
      .map(r => r.id);
    try {
      await apiSend(
        `/results/races/${selectedRaceId}/reorder`,
        'PUT',
        { ordered_ids: ordered },
        token
      );
      await refreshExisting(selectedRaceId);
      alert('Ordem guardada.');
    } catch {
      alert('Falha ao guardar a ordem.');
    }
  };

  // ---- Eliminar 1 resultado
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

  // ---- Adicionar 1 em falta
  const addSingle = async () => {
    if (!selectedRaceId || !token || !selectedClass) return;
    const sail = singleSail.trim().toLowerCase();
    const pos = Number(singlePos);
    if (!sail || !pos) return alert('Preenche Nº de vela e posição.');

    const entry = entryList.find(
      e => (e.sail_number || '').toLowerCase() === sail && e.class_name === selectedClass
    );
    if (!entry) return alert('Entrada não encontrada para esta classe.');

    const payload = {
      regatta_id: regattaId,
      sail_number: entry.sail_number ?? null,
      boat_name: entry.boat_name ?? null,
      helm_name: `${entry.first_name} ${entry.last_name}`,
      points: pos,
      desired_position: pos,
      // code: null, // quando quiseres permitir “adicionar 1 com código”, ativa isto e ajusta pontos
    };

    try {
      await apiSend(`/results/races/${selectedRaceId}/result`, 'POST', payload, token);
      setSingleSail('');
      setSinglePos('');
      await refreshExisting(selectedRaceId);
    } catch {
      alert('Não foi possível adicionar.');
    }
  };

  return {
    // state
    scoring, setScoring, savingScoring,
    races, selectedRaceId, setSelectedRaceId, selectedClass,
    existingResults, loadingExisting,
    availableEntries, draft, draftInput, setDraftInput,
    singleSail, setSingleSail, singlePos, setSinglePos,
    scoringCodes, // útil para mostrar no UI

    // actions
    saveScoring,
    addDraftBySail, addDraftEntry, removeDraft, moveDraft,
    onSetDraftPos, onSetDraftCode,
    saveBulk,
    moveRow, savePosition, saveOrder,
    addSingle,
    markCode,
    deleteResult,
  };
}
