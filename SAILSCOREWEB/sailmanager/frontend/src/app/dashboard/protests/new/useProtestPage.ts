'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPatch, apiSend } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

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
  regatta_id?: number | string | null; // aceitar string/number/null
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

export interface ProtestRespondentIn {
  kind: RespondentKindApi;
  entry_id?: number | null;
  free_text?: string | null;
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
  race_number?: string | null;
  group_name?: string | null;
  initiator_entry_id?: number | null;
  initiator_party_text?: string | null;
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

/** Default label for jury/admin: who files the protest (stored in initiator_represented_by). */
function staffFilingName(u: { name?: string | null; email?: string | null } | null | undefined): string {
  if (!u) return '';
  const n = (u.name || '').trim();
  if (n) return n;
  const e = (u.email || '').trim();
  if (e.includes('@')) return e.split('@')[0] ?? '';
  return e;
}

const genId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export type UseProtestPageOptions = {
  /** Júri: carrega todas as inscrições da regata e permite escolher o nome no protesto. */
  forJury?: boolean;
  /** Admin (org): igual ao júri para criar protesto em nome de qualquer inscrição. */
  forAdmin?: boolean;
  /** Edição (admin/júri): PATCH em vez de POST. */
  editProtestId?: number | null;
};

type ForEditResponse = {
  id: number;
  type: ProtestType;
  race_date?: string | null;
  race_number?: string | null;
  group_name?: string | null;
  initiator_entry_id: number | null;
  initiator_party_text?: string | null;
  initiator_represented_by?: string | null;
  respondents: {
    kind: string;
    entry_id?: number | null;
    free_text?: string | null;
    represented_by?: string | null;
  }[];
  incident?: {
    when_where?: string | null;
    description?: string | null;
    rules_applied?: string | null;
  };
};

function mapRespondentsFromApi(
  apiRows: ForEditResponse['respondents'],
  allEntries: EntryOption[]
): RespondentRowUI[] {
  return apiRows.map((r) => {
    const id = genId();
    if ((r.kind || 'entry') === 'entry' && r.entry_id) {
      const en = allEntries.find((e) => e.id === r.entry_id);
      return {
        id,
        type: 'boat',
        class_name: en?.class_name?.trim(),
        entry_id: r.entry_id,
        represented_by: r.represented_by || undefined,
      };
    }
    const ft = (r.free_text || '').trim();
    if (ft.toLowerCase().startsWith('coach:')) {
      return {
        id,
        type: 'coach',
        name_text: ft.replace(/^coach:\s*/i, '').trim(),
        represented_by: r.represented_by || undefined,
      };
    }
    const matchType = (Object.keys(RESPONDENT_TYPE_LABEL) as RespondentUiType[]).find(
      (k) => RESPONDENT_TYPE_LABEL[k] === ft
    );
    if (matchType && matchType !== 'boat' && matchType !== 'coach') {
      return { id, type: matchType, represented_by: r.represented_by || undefined };
    }
    return {
      id,
      type: 'other',
      name_text: ft || undefined,
      represented_by: r.represented_by || undefined,
    };
  });
}

// ----- Hook -----
export default function useProtestPage(
  regattaId: number | null,
  token?: string,
  options?: UseProtestPageOptions
) {
  const forJury = Boolean(options?.forJury);
  const forAdmin = Boolean(options?.forAdmin);
  /** Org admin (not jury): initiator = free text only, no “Filed by”, no entry picker */
  const adminInitiatorFreeTextOnly = forAdmin && !forJury;
  const editProtestId = options?.editProtestId ?? null;
  const { user } = useAuth();
  const userEmail =
    user?.email ||
    (typeof window !== 'undefined'
      ? (() => {
          try {
            const raw = localStorage.getItem('user');
            return raw ? JSON.parse(raw)?.email : undefined;
          } catch {
            return undefined;
          }
        })()
      : undefined);

  // Básico
  const [type, setType] = useState<ProtestType>('protest');
  const [raceDate, setRaceDate] = useState<string>('');
  const [raceNumber, setRaceNumber] = useState<string>(''); // string
  const [groupName, setGroupName] = useState<string>('');

  // Iniciador
  const [myEntries, setMyEntries] = useState<EntryOption[]>([]);
  const [initiatorEntryId, setInitiatorEntryId] = useState<number | undefined>(undefined);
  const [initiatorPartyText, setInitiatorPartyText] = useState('');
  const [initiatorRep, setInitiatorRep] = useState<string>('');
  const [loadingEntries, setLoadingEntries] = useState(true);

  // Dados “Boat”
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

  // Carga para edição (admin/júri)
  useEffect(() => {
    if (!regattaId || !token || !editProtestId) return;
    let cancelled = false;

    async function loadEdit() {
      setLoadingEntries(true);
      setEntriesByClass({});
      setClasses([]);
      setError(null);
      try {
        const all =
          (await apiGet<EntryOption[]>(`/entries/by_regatta/${regattaId}`, token)) || [];
        all.sort((a, b) => {
          const c = (a.class_name || '').localeCompare(b.class_name || '');
          if (c !== 0) return c;
          return (a.sail_number || '').localeCompare(b.sail_number || '');
        });
        const data = await apiGet<ForEditResponse>(
          `/regattas/${regattaId}/protests/${editProtestId}/for-edit`,
          token
        );
        if (cancelled) return;
        setMyEntries(all);
        setType(data.type);
        setRaceDate(data.race_date || '');
        setRaceNumber(data.race_number || '');
        setGroupName(data.group_name || '');
        if (adminInitiatorFreeTextOnly) {
          const pt = (data.initiator_party_text || '').trim();
          if (pt) {
            setInitiatorPartyText(pt);
          } else if (data.initiator_entry_id) {
            const en = all.find((e) => e.id === data.initiator_entry_id);
            setInitiatorPartyText(
              en
                ? [en.sail_number, en.boat_name, en.class_name].filter(Boolean).join(' · ') || ''
                : ''
            );
          } else {
            setInitiatorPartyText('');
          }
          setInitiatorEntryId(undefined);
          setInitiatorRep('');
        } else {
          setInitiatorEntryId(data.initiator_entry_id ?? undefined);
          setInitiatorRep((data.initiator_represented_by || '').trim());
          setInitiatorPartyText('');
        }
        const rows = mapRespondentsFromApi(data.respondents, all);
        setRespondents(rows.length ? rows : [{ id: genId(), type: 'boat' }]);
        setIncidentWhenWhere(data.incident?.when_where || '');
        setIncidentDescription(data.incident?.description || '');
        setRulesAlleged(data.incident?.rules_applied || '');

        const cls = (await apiGet<string[]>(`/regattas/${regattaId}/classes`, token)) || [];
        let finalClasses = (cls || []).filter(Boolean);
        if (!finalClasses.length) {
          finalClasses = Array.from(
            new Set(all.map((e) => (e.class_name || '').trim()).filter(Boolean))
          );
        }
        if (!cancelled) setClasses(finalClasses);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load protest.');
        }
      } finally {
        if (!cancelled) setLoadingEntries(false);
      }
    }

    void loadEdit();
    return () => {
      cancelled = true;
    };
  }, [regattaId, token, editProtestId]);

  // Load inicial (com fallbacks)
  useEffect(() => {
    if (!regattaId || !token) return;
    if (editProtestId) return;
    let cancelled = false;

    async function load() {
      setLoadingEntries(true);
      setEntriesByClass({});
      setClasses([]);

      let mineForThis: EntryOption[] = [];

      if (forJury || forAdmin) {
        try {
          mineForThis =
            (await apiGet<EntryOption[]>(`/entries/by_regatta/${regattaId}`, token)) || [];
        } catch {
          mineForThis = [];
        }
        mineForThis.sort((a, b) => {
          const c = (a.class_name || '').localeCompare(b.class_name || '');
          if (c !== 0) return c;
          return (a.sail_number || '').localeCompare(b.sail_number || '');
        });
      } else {
        // 1) tenta já filtrado por regata  (mine=1)
        try {
          mineForThis =
            (await apiGet<EntryOption[]>(
              `/entries?mine=1&regatta_id=${regattaId}`,
              token
            )) || [];
        } catch {}

        // 2) se vazio, vai buscar todas as minhas e filtra no FE
        if (!mineForThis.length) {
          try {
            const allMine =
              (await apiGet<EntryOption[]>(`/entries?mine=1`, token)) || [];
            mineForThis = allMine.filter((e) => {
              const rid =
                e.regatta_id === undefined || e.regatta_id === null
                  ? undefined
                  : Number(e.regatta_id);
              return rid === undefined || rid === regattaId;
            });
          } catch {}
        }

        // 3) se ainda vazio, by_regatta e filtra por email
        if (!mineForThis.length) {
          try {
            const regEntries =
              (await apiGet<EntryOption[]>(
                `/entries/by_regatta/${regattaId}`,
                token
              )) || [];
            if (userEmail) {
              const mail = String(userEmail).toLowerCase();
              mineForThis = regEntries.filter(
                (e) => (e.email || '').toLowerCase() === mail
              );
            }
          } catch {}
        }
      }

      if (!cancelled) {
        setMyEntries(mineForThis);
        const jName = staffFilingName(user);
        if (adminInitiatorFreeTextOnly) {
          setInitiatorEntryId(undefined);
          setInitiatorRep('');
          setInitiatorPartyText('');
        } else if (forJury) {
          if (mineForThis.length === 1) {
            setInitiatorEntryId(mineForThis[0].id);
            setInitiatorRep(jName);
          } else {
            setInitiatorEntryId(undefined);
            setInitiatorRep(jName);
          }
        } else if (mineForThis.length === 1) {
          setInitiatorEntryId(mineForThis[0].id);
          setInitiatorRep(entryFullName(mineForThis[0]));
        } else {
          setInitiatorEntryId(undefined);
          setInitiatorRep('');
        }
      }

      // Classes (com fallback)
      try {
        const cls =
          (await apiGet<string[]>(`/regattas/${regattaId}/classes`, token)) || [];
        let finalClasses = (cls || []).filter(Boolean);
        if (!finalClasses.length) {
          const regEntries =
            (await apiGet<EntryOption[]>(
              `/entries/by_regatta/${regattaId}`,
              token
            )) || [];
          finalClasses = Array.from(
            new Set(
              regEntries.map((e) => (e.class_name || '').trim()).filter(Boolean)
            )
          );
        }
        if (!cancelled) setClasses(finalClasses);
      } catch {
        if (!cancelled) setClasses([]);
      }

      if (!cancelled) setLoadingEntries(false);
    }

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    load();
    return () => {
      cancelled = true;
    };
  }, [regattaId, token, userEmail, forJury, forAdmin, adminInitiatorFreeTextOnly, user, editProtestId]);

  // “Represented by” / “Filed by”: sailor = skipper name; jury = account name until edited (not org admin)
  useEffect(() => {
    if (editProtestId) return;
    if (adminInitiatorFreeTextOnly) return;
    if (forJury) {
      const j = staffFilingName(user);
      if (j) setInitiatorRep(j);
      return;
    }
    const en = myEntries.find((e) => e.id === initiatorEntryId);
    if (en) setInitiatorRep(entryFullName(en));
  }, [initiatorEntryId, myEntries, forJury, adminInitiatorFreeTextOnly, user, editProtestId]);

  // Pré-preenche 1ª linha com classe do iniciador
  useEffect(() => {
    if (editProtestId) return;
    if (adminInitiatorFreeTextOnly) return;
    const iniClass = myEntries.find((e) => e.id === initiatorEntryId)?.class_name;
    if (!iniClass) return;
    setRespondents((prev) => {
      if (!prev.length || prev[0].type !== 'boat' || prev[0].class_name) return prev;
      const copy = [...prev];
      copy[0] = { ...copy[0], class_name: iniClass.trim(), entry_id: undefined };
      return copy;
    });
    void ensureClassEntries(iniClass);
  }, [initiatorEntryId, myEntries, adminInitiatorFreeTextOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  // Helpers respondentes
  const addRespondent = () => setRespondents((p) => [...p, { id: genId(), type: 'boat' }]);
  const removeRespondent = (rid: string) =>
    setRespondents((p) => p.filter((r) => r.id !== rid));
  const updateRespondent = (rid: string, patch: Partial<RespondentRowUI>) =>
    setRespondents((p) => p.map((r) => (r.id === rid ? { ...r, ...patch } : r)));

  // Submit
  const submit = async (): Promise<boolean> => {
    setSubmitting(true);
    setError(null);
    try {
      if (!regattaId) return (setError('Could not identify the regatta.'), false);
      if (adminInitiatorFreeTextOnly) {
        if (!(initiatorPartyText || '').trim()) {
          return (setError('Describe who is protesting (protestor / party).'), false);
        }
      } else if (!initiatorEntryId) {
        return (setError('Select the initiating boat.'), false);
      }
      if (respondents.length === 0) return (setError('Add at least one respondent.'), false);

      for (const r of respondents) {
        if (r.type === 'boat' && !r.entry_id) {
          return (setError('Select the class and boat (sailor) being protested.'), false);
        }
        if (r.type === 'coach' && !r.name_text?.trim()) {
          return (setError("Enter the coach's name."), false);
        }
      }
      if (
        !adminInitiatorFreeTextOnly &&
        initiatorEntryId &&
        respondents.some((r) => r.type === 'boat' && r.entry_id === initiatorEntryId)
      ) {
        return (setError('The initiator cannot also be a respondent.'), false);
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

      const payload: ProtestCreate = adminInitiatorFreeTextOnly
        ? {
            type,
            race_date: raceDate || null,
            race_number: (raceNumber || '').trim() || null,
            group_name: (groupName || '').trim() || null,
            initiator_entry_id: null,
            initiator_party_text: (initiatorPartyText || '').trim(),
            initiator_represented_by: null,
            respondents: respondentsApi,
            incident: {
              when_where: (incidentWhenWhere || '').trim() || null,
              description: (incidentDescription || '').trim() || null,
              rules_applied: (rulesAlleged || '').trim() || null,
            },
          }
        : {
            type,
            race_date: raceDate || null,
            race_number: (raceNumber || '').trim() || null,
            group_name: (groupName || '').trim() || null,
            initiator_entry_id: initiatorEntryId!,
            initiator_represented_by: (initiatorRep || '').trim() || null,
            respondents: respondentsApi,
            incident: {
              when_where: (incidentWhenWhere || '').trim() || null,
              description: (incidentDescription || '').trim() || null,
              rules_applied: (rulesAlleged || '').trim() || null,
            },
          };

      if (editProtestId) {
        await apiPatch<{ id: number; short_code: string }>(
          `/regattas/${regattaId}/protests/${editProtestId}`,
          payload,
          token
        );
      } else {
        await apiSend<{ id: number; short_code: string }>(
          `/regattas/${regattaId}/protests`,
          'POST',
          payload,
          token
        );
      }

      return true;
    } catch (e: any) {
      setError(e?.message || 'Failed to submit the protest.');
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
    initiatorPartyText, setInitiatorPartyText,
    initiatorRep, setInitiatorRep,
    adminInitiatorFreeTextOnly,
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
    editProtestId,
  } as const;
}
