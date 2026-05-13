'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiGet, apiSend } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import notify from '@/lib/notify';

//
// Tipos locais
//
export type RaceLite = {
  id: number;
  name: string;
  order_index?: number | null;
  class_name: string;
  fleet_set_id?: number | null;
};

type Fleet = {
  id: number;
  name: string;
  order_index: number;
};

export type FleetSet = {
  id: number;
  regatta_id: number;
  class_name: string;
  phase: string;
  label: string | null;
  fleets: Fleet[];
  race_names?: string[];

  is_published: boolean;
  public_title: string | null;
  published_at: string | null;
};

type RawAssignment = {
  entry_id: number;
  fleet_id: number;
};

type EntryLite = {
  id: number;
  class_name: string;
  sail_number?: string | null;
  boat_country_code?: string | null;
  boat_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  crew_members?: Array<{
    first_name?: string | null;
    last_name?: string | null;
  }> | null;
};

export type Assignment = {
  entry_id: number;
  fleet_id: number;
  sail_number: string | null;
  boat_country_code: string | null;
  boat_name: string | null;
  helm_name: string | null;
  crew_names: string[];
};

type ClassDetailed = {
  class_name: string;
  class_type?: 'one_design' | 'handicap' | string;
};

type FleetsResponse = {
  fleet_set_id: number;
  assignments: RawAssignment[];
};

//
// -----------------------------------------------------
// 🚀 HOOK PRINCIPAL — useFleets()
// -----------------------------------------------------
//
export function useFleets() {
  const { token } = useAuth();

  const [regattaId, setRegattaId] = useState<number | null>(null);

  // detetar regattaId da URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const parts = window.location.pathname.split('/');
      const id = Number(parts.find((x) => /^\d+$/.test(x)));
      if (!Number.isNaN(id)) setRegattaId(id);
    }
  }, []);

  //
  // ----------------- STATE -----------------
  //
  const [entryList, setEntryList] = useState<EntryLite[]>([]);
  const [races, setRaces] = useState<RaceLite[]>([]);

  const [classes, setClasses] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [classTypeByName, setClassTypeByName] = useState<Record<string, string>>({});

  const [sets, setSets] = useState<FleetSet[]>([]);
  const [selectedSetId, setSelectedSetId] = useState<number | null>(null);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // ✅ NOVO: confirmação global (para banners/toasts)
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const clearSuccess = useCallback(() => setSuccessMessage(null), []);

  //
  // ✅ utilitário: classes “reais” = só as classes que existem nas ENTRIES
  //
  const collectClasses = (entries: EntryLite[]): string[] => {
    const fromEntries = entries.map((e) => e.class_name).filter(Boolean);
    return Array.from(new Set(fromEntries)).sort();
  };

  //
  // ------ Attach Race Names ------
  //
  const attachRaceNames = useCallback((rawSets: FleetSet[], allRaces: RaceLite[]) => {
    const bySet: Record<number, string[]> = {};

    allRaces.forEach((r) => {
      if (r.fleet_set_id != null) {
        if (!bySet[r.fleet_set_id]) bySet[r.fleet_set_id] = [];
        bySet[r.fleet_set_id].push(r.name);
      }
    });

    return rawSets.map((s) => ({
      ...s,
      race_names: (bySet[s.id] ?? []).slice().sort(),
    }));
  }, []);

  //
  // ----------------- LOAD ENTRIES + RACES -----------------
  //
  useEffect(() => {
    if (!regattaId) return;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const [entries, rcs, classDetails] = await Promise.all([
          apiGet<EntryLite[]>(`/entries/by_regatta/${regattaId}`),
          apiGet<RaceLite[]>(`/races/by_regatta/${regattaId}`),
          apiGet<ClassDetailed[]>(`/regattas/${regattaId}/classes/detailed`),
        ]);

        setEntryList(entries);
        setRaces(rcs);
        const nextClassTypeByName: Record<string, string> = {};
        for (const item of classDetails ?? []) {
          const key = (item.class_name || '').trim();
          if (!key) continue;
          nextClassTypeByName[key] = (item.class_type || 'one_design').toLowerCase();
        }
        setClassTypeByName(nextClassTypeByName);

        const cls = collectClasses(entries);
        setClasses(cls);

        // ✅ garantir selectedClass válida
        if (!cls.includes(selectedClass ?? '') && cls.length > 0) {
          setSelectedClass(cls[0]);
        } else if (!selectedClass && cls.length > 0) {
          setSelectedClass(cls[0]);
        }
      } catch (e) {
        console.error('useFleets: erro entries/races', e);
        setError(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [regattaId]); // (mantém simples)

  //
  // ----------------- LOAD FLEET SETS -----------------
  //
  useEffect(() => {
    if (!regattaId || !selectedClass) {
      setSets([]);
      setSelectedSetId(null);
      return;
    }

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await apiGet<FleetSet[]>(
          `/regattas/${regattaId}/classes/${encodeURIComponent(selectedClass)}/fleet-sets`
        );

        const enriched = attachRaceNames(data, races);
        setSets(enriched);

        // ✅ classes vêm só das entries (não de races/sets)
        setClasses(collectClasses(entryList));

        if (enriched.length > 0) {
          setSelectedSetId((prev) => prev ?? enriched[0].id);
        } else {
          setSelectedSetId(null);
        }
      } catch (e) {
        console.error('useFleets: erro fleet-sets', e);
        setError(e);
        setSets([]);
        setSelectedSetId(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [regattaId, selectedClass, races, attachRaceNames, entryList]);

  //
  // ----------------- LOAD ASSIGNMENTS -----------------
  //
  useEffect(() => {
    if (!regattaId || !selectedClass || !selectedSetId) {
      setAssignments([]);
      return;
    }

    (async () => {
      try {
        const data = await apiGet<FleetsResponse>(
          `/regattas/${regattaId}/classes/${encodeURIComponent(
            selectedClass
          )}/fleet-sets/${selectedSetId}/assignments`
        );

        const enriched = data.assignments.map((a) => {
          const entry = entryList.find((e) => e.id === a.entry_id);
          return {
            entry_id: a.entry_id,
            fleet_id: a.fleet_id,
            sail_number: entry?.sail_number ?? null,
            boat_country_code: entry?.boat_country_code ?? null,
            boat_name: entry?.boat_name ?? null,
            helm_name: entry
              ? `${entry.first_name ?? ''} ${entry.last_name ?? ''}`.trim()
              : null,
            crew_names: Array.isArray(entry?.crew_members)
              ? entry!.crew_members!
                  .map((m) => `${m?.first_name ?? ''} ${m?.last_name ?? ''}`.trim())
                  .filter(Boolean)
              : [],
          };
        });

        setAssignments(enriched);
      } catch (e) {
        console.error('useFleets: erro assignments', e);
        setAssignments([]);
      }
    })();
  }, [regattaId, selectedClass, selectedSetId, entryList]);

  //
  // ----------------- racesInSelectedSet -----------------
  //
  const racesInSelectedSet = useMemo(() => {
    if (!selectedSetId) return [];
    return races.filter((r) => r.fleet_set_id === selectedSetId);
  }, [races, selectedSetId]);

  //
  // ----------------- racesAvailable -----------------
  //
  const racesAvailable = useMemo(() => {
    if (!selectedClass) return [];
    const used = new Set(races.filter((r) => r.fleet_set_id != null).map((r) => r.id));

    return races
      .filter((r) => r.class_name === selectedClass && !used.has(r.id))
      .sort((a, b) => (a.order_index ?? a.id) - (b.order_index ?? b.id));
  }, [races, selectedClass]);

  //
  // ----------------- refreshSetsAndRaces -----------------
  //
  const refreshSetsAndRaces = useCallback(async () => {
    if (!regattaId || !selectedClass) return;

    try {
      const [rcs, sts] = await Promise.all([
        apiGet<RaceLite[]>(`/races/by_regatta/${regattaId}`),
        apiGet<FleetSet[]>(
          `/regattas/${regattaId}/classes/${encodeURIComponent(selectedClass)}/fleet-sets`
        ),
      ]);

      setRaces(rcs);
      const enriched = attachRaceNames(sts, rcs);
      setSets(enriched);

      // ✅ classes só das entries
      setClasses(collectClasses(entryList));

      if (enriched.length === 0) {
        setSelectedSetId(null);
        setAssignments([]);
      }
    } catch (e) {
      console.error('refreshSetsAndRaces', e);
    }
  }, [regattaId, selectedClass, attachRaceNames, entryList]);

  //
  // ----------------- ACTIONS -----------------
  //
  const createQualifying = useCallback(
    async (num_fleets: 2 | 3 | 4, race_ids: number[]) => {
      if (!regattaId || !selectedClass) throw new Error('No class selected.');

      const fs = await apiSend<FleetSet>(
        `/regattas/${regattaId}/classes/${encodeURIComponent(selectedClass)}/fleet-sets/qualifying`,
        'POST',
        { label: 'Qual D1', num_fleets, race_ids },
        token ?? undefined
      );

      await refreshSetsAndRaces();
      setSelectedSetId(fs.id);

      setSuccessMessage(
        `Qualifying created successfully (${fs.public_title ?? fs.label ?? 'untitled'}).`
      );

      return fs;
    },
    [regattaId, selectedClass, refreshSetsAndRaces, token]
  );

  const reshuffle = useCallback(
    async (num_fleets: 2 | 3 | 4, race_ids: number[]) => {
      if (!regattaId || !selectedClass) throw new Error('No class selected.');

      const fs = await apiSend<FleetSet>(
        `/regattas/${regattaId}/classes/${encodeURIComponent(selectedClass)}/fleet-sets/reshuffle`,
        'POST',
        { label: 'Qual D2', num_fleets, race_ids },
        token ?? undefined
      );

      await refreshSetsAndRaces();
      setSelectedSetId(fs.id);

      setSuccessMessage(
        `Reshuffle created successfully (${fs.public_title ?? fs.label ?? 'untitled'}).`
      );

      return fs;
    },
    [regattaId, selectedClass, refreshSetsAndRaces, token]
  );

  const startFinals = useCallback(
    async (label: string, grouping: Record<string, number>, race_ids?: number[]) => {
      if (!regattaId || !selectedClass) throw new Error('No class selected.');

      const body = { label, grouping, race_ids: race_ids ?? [] };

      try {
        const res = await apiSend<FleetSet>(
          `/regattas/${regattaId}/classes/${encodeURIComponent(selectedClass)}/fleet-sets/finals`,
          'POST',
          body,
          token ?? undefined
        );

        await refreshSetsAndRaces();
        setSelectedSetId(res.id);

        setSuccessMessage(
          `Finals created successfully (${res.public_title ?? res.label ?? 'Finals'}).`
        );

        return res;
      } catch (e: any) {
        throw new Error(e?.message ?? 'Não foi possível criar Finals.');
      }
    },
    [regattaId, selectedClass, token, refreshSetsAndRaces]
  );

  const updateFleetSetRaces = useCallback(
    async (setId: number, raceIds: number[], force = false) => {
      if (!regattaId || !selectedClass) return;

      try {
        await apiSend(
          `/regattas/${regattaId}/classes/${encodeURIComponent(selectedClass)}/fleet-sets/${setId}/races?force=${force ? 'true' : 'false'}`,
          'PUT',
          { race_ids: raceIds }
        );

        await refreshSetsAndRaces();
        setSuccessMessage('Races updated successfully.');
      } catch (err) {
        console.error('updateFleetSetRaces falhou:', err);
        notify.error('Could not update races for this Fleet Set.');
      }
    },
    [regattaId, selectedClass, refreshSetsAndRaces]
  );

  const publishSet = useCallback(
    async (setId: number) => {
      await apiSend(
        `/regattas/${regattaId}/classes/${encodeURIComponent(selectedClass!)}/fleet-sets/${setId}/publish`,
        'POST'
      );
      await refreshSetsAndRaces();
        setSuccessMessage('Fleet Set published successfully.');
    },
    [regattaId, selectedClass, refreshSetsAndRaces]
  );

  const unpublishSet = useCallback(
    async (setId: number) => {
      await apiSend(
        `/regattas/${regattaId}/classes/${encodeURIComponent(selectedClass!)}/fleet-sets/${setId}/unpublish`,
        'POST'
      );
      await refreshSetsAndRaces();
        setSuccessMessage('Fleet Set unpublished successfully.');
    },
    [regattaId, selectedClass, refreshSetsAndRaces]
  );

  const updateSetTitle = useCallback(
    async (setId: number, newTitle: string) => {
      await apiSend(
        `/regattas/${regattaId}/classes/${encodeURIComponent(selectedClass!)}/fleet-sets/${setId}`,
        'PATCH',
        { public_title: newTitle }
      );
      await refreshSetsAndRaces();
        setSuccessMessage('Title updated successfully.');
    },
    [regattaId, selectedClass, refreshSetsAndRaces]
  );

  // ✅ Medal Race: agora pode ser criada sem race_ids
  const createMedalRace = useCallback(
    async (
      className: string,
      fromRank: number,
      toRank: number,
      raceIds: number[] = [] // ✅ pode ser vazio
    ) => {
      if (!regattaId) throw new Error('Invalid regatta.');

      try {
        await apiSend(
          `/regattas/${regattaId}/medal_race/assign`,
          'POST',
          {
            class_name: className,
            from_rank: fromRank,
            to_rank: toRank,
            race_ids: raceIds, // ✅ não é obrigatório
          },
          token ?? undefined
        );

        await refreshSetsAndRaces();
        setSuccessMessage('Medal Race created successfully.');
      } catch (e: any) {
        throw new Error(e?.message ?? 'Could not create Medal Race.');
      }
    },
    [regattaId, token, refreshSetsAndRaces]
  );

  const deleteFleetSet = useCallback(
    async (setId: number, force = false) => {
      try {
        await apiSend(
          `/regattas/${regattaId}/classes/${encodeURIComponent(selectedClass!)}/fleet-sets/${setId}?force=${force}`,
          'DELETE'
        );

        await refreshSetsAndRaces();
        setSelectedSetId(null);

        setSuccessMessage('Fleet Set deleted successfully.');
      } catch (e: any) {
        throw e;
      }
    },
    [regattaId, selectedClass, refreshSetsAndRaces]
  );

  //
  // ----------------- RETURN -----------------
  //
  return {
    classes,
    classTypeByName,
    selectedClass,
    setSelectedClass,

    sets,
    selectedSetId,
    setSelectedSetId,

    assignments,
    racesAvailable,
    racesInSelectedSet,

    loading,
    error,

    // ✅ novo feedback global
    successMessage,
    clearSuccess,

    createQualifying,
    reshuffle,
    startFinals,
    updateFleetSetRaces,
    publishSet,
    unpublishSet,
    updateSetTitle,
    createMedalRace,
    deleteFleetSet,
  };
}
