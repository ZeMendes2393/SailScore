'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiSend } from '@/lib/api';

// ----- Tipos -----
export type ProtestType =
  | 'protest'
  | 'redress'
  | 'reopen'
  | 'support_person_report'
  | 'misconduct_rss69';

export type RespondentUiType =
  | 'boat'
  | 'coach'
  | 'technical_committee'
  | 'race_committee'
  | 'protest_committee'
  | 'organizing_authority'
  | 'other';

export type RespondentKindApi = 'entry' | 'other';

export interface EntryOption {
  id: number;
  regatta_id?: number;
  sail_number?: string | null;
  boat_name?: string | null;
  class_name: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

export interface RespondentRowUI {
  id: string;
  type: RespondentUiType;
  class_name?: string;
  entry_id?: number;
  name_text?: string;
  represented_by?: string;
}

// Payload (igual ao que o backend espera)
export interface ProtestRespondentIn {
  kind: RespondentKindApi;      // 'entry' | 'other'
  entry_id?: number | null;     // quando kind='entry'
  free_text?: string | null;    // quando kind='other'
  represented_by?: string | null;
}
export interface ProtestIncidentIn {
  when_where?: string | null;
  description?: string | null;
  rules_applied?: string | null;
  damage_injury?: string | null;
}
export interface ProtestCreate {
  type: ProtestType;
  race_date?: string | null;
  race_number?: string | null;   // string no backend
  group_name?: string | null;
  initiator_entry_id: number;
  initiator_represented_by?: string | null;
  respondents: ProtestRespondentIn[];
  incident?: ProtestIncidentIn;
}

const RESPONDENT_TYPE_LABEL: Record<RespondentUiType, string> = {
  boat: 'Boat',
  coach: 'Coach',
  technical_committee: 'Technical Committee',
  race_committee: 'Race Committee',
  protest_committee: 'Protest Committee',
  organizing_authority: 'Organizing Authority',
  other: 'Other',
};

function entryFullName(en?: EntryOption): string {
  if (!en) return '';
  const full = `${en.first_name || ''} ${en.last_name || ''}`.trim();
  return full || en.email || en.boat_name || en.sail_number || '';
}

const genId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

// ----- Hook -----
export default function useProtestPage(regattaId: number | null, token?: string) {
  // Básico
  const [type, setType] = useState<ProtestType>('protest');
  const [raceDate, setRaceDate] = useState<string>('');
  const [raceNumber, setRaceNumber] = useState<string>(''); // string
  const [groupName, setGroupName] = useState<string>('');

  // Iniciador
  const [myEntries, setMyEntries] = useState<EntryOption[]>([]);
  const [initiatorEntryId, setInitiatorEntryId] = useState<number | undefined>(undefined);
  const [initiatorRep, setInitiatorRep] = useState<string>('');
  const [repLocked, setRepLocked] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(true);

  // Dados para “Boat”
  const [classes, setClasses] = useState<string[]>([]);
  const [entriesByClass, setEntriesByClass] = useState<Record<string, EntryOption[]>>({});

  // Respondentes
  const [respondents, setRespondents] = useState<RespondentRowUI[]>([
    { id: genId(), type: 'boat' },
  ]);

  // Incident (UI)
  const [incidentWhenWhere, setIncidentWhenWhere] = useState('');
  const [incidentDescription, setIncidentDescription] = useState('');
  const [rulesAlleged, setRulesAlleged] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedInitiator = useMemo(
    () => myEntries.find((e) => e.id === initiatorEntryId),
    [myEntries, initiatorEntryId]
  );

  // Carregar entries por classe
  const ensureClassEntries = async (className: string) => {
    const key = (className || '').trim();
    if (!key || entriesByClass[key] || !regattaId) return;
    try {
      const data = await apiGet<EntryOption[]>(
        `/entries/by_regatta/${regattaId}?class=${encodeURIComponent(key)}`,
        token
      );
      setEntriesByClass((m) => ({ ...m, [key]: data || [] }));
    } catch {
      setEntriesByClass((m) => ({ ...m, [key]: [] }));
    }
  };

  // Load inicial
  useEffect(() => {
    if (!regattaId || !token) return;
    let cancelled = false;

    async function load() {
      setLoadingEntries(true);
      setEntriesByClass({});
      setClasses([]);

      try {
        // 1) Minhas entries desta regata
        let mine = await apiGet<EntryOption[]>(
          `/entries?mine=true&regatta_id=${regattaId}`,
          token
        ).catch(() => []);

        if (!mine?.length) {
          mine = await apiGet<EntryOption[]>(`/entries?mine=true`, token).catch(() => []);
        }
        const mineForThis = (mine || []).filter(
          (e) => !e.regatta_id || e.regatta_id === regattaId
        );

        if (!cancelled) {
          setMyEntries(mineForThis);
          if (mineForThis.length === 1) {
            setInitiatorEntryId(mineForThis[0].id);
            setInitiatorRep(entryFullName(mineForThis[0]));
          } else {
            setInitiatorEntryId(undefined);
            setInitiatorRep('');
          }
        }

        // 2) Classes da regata (string[])
        const cls = await apiGet<string[]>(
          `/regattas/${regattaId}/classes`,
          token
        ).catch(() => []);
        let finalClasses = (cls || []).filter(Boolean);

        // 3) Fallback pelo entries/by_regatta
        if (finalClasses.length === 0) {
          const regEntries = await apiGet<EntryOption[]>(
            `/entries/by_regatta/${regattaId}`,
            token
          ).catch(() => []);
          finalClasses = Array.from(
            new Set(
              (regEntries || [])
                .map((e) => (e.class_name || '').trim())
                .filter(Boolean)
            )
          );
        }

        if (!cancelled) setClasses(finalClasses);
      } finally {
        if (!cancelled) setLoadingEntries(false);
      }
    }

    load().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [regattaId, token]);

  // “represented by” quando muda iniciador
  useEffect(() => {
    const en = myEntries.find((e) => e.id === initiatorEntryId);
    if (en) setInitiatorRep(entryFullName(en));
  }, [initiatorEntryId, myEntries]);

  // Pré-preenche 1ª linha com classe do iniciador
  useEffect(() => {
    const iniClass = myEntries.find((e) => e.id === initiatorEntryId)?.class_name;
    if (!iniClass) return;
    setRespondents((prev) => {
      if (!prev.length || prev[0].type !== 'boat' || prev[0].class_name) return prev;
      const copy = [...prev];
      copy[0] = { ...copy[0], class_name: iniClass.trim(), entry_id: undefined };
      return copy;
    });
    void ensureClassEntries(iniClass);
  }, [initiatorEntryId, myEntries]); // eslint-disable-line react-hooks/exhaustive-deps

  // Helpers respondentes
  const addRespondent = () => {
    setRespondents((prev) => [...prev, { id: genId(), type: 'boat' }]);
  };
  const removeRespondent = (rid: string) => {
    setRespondents((prev) => prev.filter((r) => r.id !== rid));
  };
  const updateRespondent = (rid: string, patch: Partial<RespondentRowUI>) => {
    setRespondents((prev) => prev.map((r) => (r.id === rid ? { ...r, ...patch } : r)));
  };

  // Submit
  const submit = async (): Promise<boolean> => {
    setSubmitting(true);
    setError(null);
    try {
      if (!regattaId) return (setError('Falta identificar a regata.'), false);
      if (!initiatorEntryId) return (setError('Seleciona o barco iniciador.'), false);
      if (respondents.length === 0) return (setError('Adiciona pelo menos um respondente.'), false);

      for (const r of respondents) {
        if (r.type === 'boat' && !r.entry_id) {
          return (setError('Seleciona a classe e o barco (sailor) a protestar.'), false);
        }
        if (r.type === 'coach' && !r.name_text?.trim()) {
          return (setError('Indica o nome do Coach.'), false);
        }
      }
      if (respondents.some((r) => r.type === 'boat' && r.entry_id === initiatorEntryId)) {
        return (setError('O iniciador não pode ser também respondente.'), false);
      }

      const respondentsApi: ProtestRespondentIn[] = respondents.map((r) => {
        if (r.type === 'boat') {
          return {
            kind: 'entry',
            entry_id: r.entry_id!,
            represented_by: r.represented_by || undefined,
          };
        }
        let label = RESPONDENT_TYPE_LABEL[r.type];
        if (r.type === 'coach' && r.name_text) label = `Coach: ${r.name_text}`;
        return {
          kind: 'other',
          free_text: label,
          represented_by: r.represented_by || undefined,
        };
      });

      const payload: ProtestCreate = {
        type,
        race_date: raceDate || null,
        race_number: (raceNumber || '').trim() || null,
        group_name: (groupName || '').trim() || null,
        initiator_entry_id: initiatorEntryId,
        initiator_represented_by: (initiatorRep || '').trim() || null,
        respondents: respondentsApi,
        incident: {
          when_where: (incidentWhenWhere || '').trim() || null,
          description: (incidentDescription || '').trim() || null,
          rules_applied: (rulesAlleged || '').trim() || null,
        },
      };

      await apiSend<{ id: number; short_code: string }>(
        `/regattas/${regattaId}/protests`,
        'POST',
        payload,
        token
      );

      return true;
    } catch (e: any) {
      setError(e?.message || 'Erro ao submeter o protesto.');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  return {
    // básico
    type, setType,
    raceDate, setRaceDate,
    raceNumber, setRaceNumber,
    groupName, setGroupName,

    // iniciador
    myEntries,
    initiatorEntryId, setInitiatorEntryId,
    initiatorRep, setInitiatorRep,
    repLocked, setRepLocked,
    loadingEntries,
    selectedInitiator,

    // boats
    classes,
    entriesByClass,
    ensureClassEntries,

    // respondentes
    respondents,
    addRespondent,
    removeRespondent,
    updateRespondent,

    // incidente
    incidentWhenWhere, setIncidentWhenWhere,
    incidentDescription, setIncidentDescription,
    rulesAlleged, setRulesAlleged,

    // submit
    error,
    submitting,
    submit,
  } as const;
}
