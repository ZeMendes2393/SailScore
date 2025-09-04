'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiSend } from '@/lib/api';

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
  regatta_id?: number; // ideal o backend devolver
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

export default function useProtestPage(regattaId: number | null) {
  // ---------- Form state ----------
  const [type, setType] = useState<ProtestType>('protest');
  const [raceDate, setRaceDate] = useState<string>('');
  const [raceNumber, setRaceNumber] = useState<string>('');
  const [groupName, setGroupName] = useState<string>('');

  // iniciador
  const [myEntries, setMyEntries] = useState<EntryOption[]>([]);
  const [initiatorEntryId, setInitiatorEntryId] = useState<number | undefined>(undefined);
  const [initiatorRep, setInitiatorRep] = useState<string>('');
  const [repLocked, setRepLocked] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(true);

  // dados para “Boat”
  const [classes, setClasses] = useState<string[]>([]);
  const [entriesByClass, setEntriesByClass] = useState<Record<string, EntryOption[]>>({});

  // respondentes
  const [respondents, setRespondents] = useState<RespondentRowUI[]>([
    { id: genId(), type: 'boat' },
  ]);

  // incident (UI)
  const [incidentWhenWhere, setIncidentWhenWhere] = useState('');
  const [incidentDescription, setIncidentDescription] = useState('');
  const [rulesAlleged, setRulesAlleged] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedInitiator = useMemo(
    () => myEntries.find((e) => e.id === initiatorEntryId),
    [myEntries, initiatorEntryId]
  );

  // entries por classe (para respondente “boat”)
  const ensureClassEntries = async (className: string) => {
    const key = (className || '').trim();
    if (!key || entriesByClass[key] || !regattaId) return;
    try {
      const data = await apiGet<EntryOption[]>(
        `/entries/by_regatta/${regattaId}?class=${encodeURIComponent(key)}`
      );
      setEntriesByClass((m) => ({ ...m, [key]: data || [] }));
    } catch {
      setEntriesByClass((m) => ({ ...m, [key]: [] }));
    }
  };

  // loaders
  useEffect(() => {
    if (!regattaId) return;
    let cancelled = false;

    async function load() {
      setLoadingEntries(true);
      setEntriesByClass({});
      setClasses([]);

      try {
        // 1) Minhas entries desta regata
        let mine = await apiGet<EntryOption[]>(
          `/entries?mine=true&regatta_id=${regattaId}`
        ).catch(() => []);

        if (!mine?.length) {
          mine = await apiGet<EntryOption[]>(`/entries?mine=true`).catch(() => []);
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

        // 2) Classes da regata
        const cls = await apiGet<string[]>(`/regattas/${regattaId}/classes`).catch(() => []);
        let finalClasses = (cls || []).filter(Boolean);

        // 3) Fallback dentro da regata
        if (finalClasses.length === 0) {
          const regEntries = await apiGet<EntryOption[]>(
            `/entries/by_regatta/${regattaId}`
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

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    load();
    return () => {
      cancelled = true;
    };
  }, [regattaId]);

  // “represented by” quando muda iniciador
  useEffect(() => {
    const en = myEntries.find((e) => e.id === initiatorEntryId);
    if (en) setInitiatorRep(entryFullName(en));
  }, [initiatorEntryId, myEntries]);

  // pré-preenche 1ª linha de respondente “boat” com a classe do iniciador
  useEffect(() => {
    const iniClass = myEntries.find((e) => e.id === initiatorEntryId)?.class_name;
    if (!iniClass) return;
    setRespondents((prev) => {
      if (!prev.length || prev[0].type !== 'boat' || prev[0].class_name) return prev;
      const copy = [...prev];
      copy[0] = { ...copy[0], class_name: iniClass.trim(), entry_id: undefined };
      return copy;
    });
    // preload entries da classe do iniciador
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ensureClassEntries(iniClass);
  }, [initiatorEntryId, myEntries]);

  // helpers respondentes
  const addRespondent = () => {
    setRespondents((prev) => [...prev, { id: genId(), type: 'boat' }]);
  };
  const removeRespondent = (rid: string) => {
    setRespondents((prev) => prev.filter((r) => r.id !== rid));
  };
  const updateRespondent = (rid: string, patch: Partial<RespondentRowUI>) => {
    setRespondents((prev) => prev.map((r) => (r.id === rid ? { ...r, ...patch } : r)));
  };

  // submit
  const submit = async (): Promise<boolean> => {
    setSubmitting(true);
    setError(null);
    try {
      if (!regattaId) {
        setError('Falta identificar a regata.');
        return false;
      }
      if (!initiatorEntryId) {
        setError('Seleciona o barco iniciador.');
        return false;
      }
      if (respondents.length === 0) {
        setError('Adiciona pelo menos um respondente.');
        return false;
      }
      for (const r of respondents) {
        if (r.type === 'boat' && !r.entry_id) {
          setError('Seleciona a classe e o barco (sailor) a protestar.');
          return false;
        }
        if (r.type === 'coach' && !r.name_text?.trim()) {
          setError('Indica o nome do Coach.');
          return false;
        }
      }
      if (respondents.some((r) => r.type === 'boat' && r.entry_id === initiatorEntryId)) {
        setError('O iniciador não pode ser também respondente.');
        return false;
      }

      const respondentsApi = respondents.map((r) => {
        if (r.type === 'boat') {
          return {
            kind: 'entry' as RespondentKindApi,
            entry_id: r.entry_id,
            represented_by: r.represented_by || undefined,
          };
        }
        let label = RESPONDENT_TYPE_LABEL[r.type];
        if (r.type === 'coach' && r.name_text) label = `Coach: ${r.name_text}`;
        return {
          kind: 'other' as RespondentKindApi,
          free_text: label,
          represented_by: r.represented_by || undefined,
        };
      });

      await apiSend<{ id: number; short_code: string }>(
        `/regattas/${regattaId}/protests`,
        'POST',
        {
          type,
          race_date: raceDate || undefined,
          race_number: raceNumber || undefined,
          group_name: groupName || undefined,
          initiator_entry_id: initiatorEntryId,
          initiator_represented_by: (initiatorRep || '').trim() || undefined,
          respondents: respondentsApi,
        }
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
    // state básico
    type,
    setType,
    raceDate,
    setRaceDate,
    raceNumber,
    setRaceNumber,
    groupName,
    setGroupName,

    // iniciador
    myEntries,
    initiatorEntryId,
    setInitiatorEntryId,
    initiatorRep,
    setInitiatorRep,
    repLocked,
    setRepLocked,
    loadingEntries,
    selectedInitiator,

    // boat data
    classes,
    entriesByClass,
    ensureClassEntries,

    // respondentes
    respondents,
    addRespondent,
    removeRespondent,
    updateRespondent,

    // incidente (UI)
    incidentWhenWhere,
    setIncidentWhenWhere,
    incidentDescription,
    setIncidentDescription,
    rulesAlleged,
    setRulesAlleged,

    // submit
    error,
    submitting,
    submit,
  } as const;
}
