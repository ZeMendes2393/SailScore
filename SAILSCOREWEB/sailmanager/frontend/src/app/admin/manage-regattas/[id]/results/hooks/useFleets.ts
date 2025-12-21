'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiGet, apiSend } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

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
  boat_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

export type Assignment = {
  entry_id: number;
  fleet_id: number;
  sail_number: string | null;
  boat_name: string | null;
  helm_name: string | null;
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
    if (typeof window !== "undefined") {
      const parts = window.location.pathname.split('/');
      const id = Number(parts.find(x => /^\d+$/.test(x)));
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

  const [sets, setSets] = useState<FleetSet[]>([]);
  const [selectedSetId, setSelectedSetId] = useState<number | null>(null);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  //
  // utilitário: cria lista de classes baseada em entries+races+fleetsets
  //
  const collectClasses = (
    entries: EntryLite[],
    races: RaceLite[],
    sets: FleetSet[]
  ): string[] => {
    const fromEntries = entries.map(e => e.class_name).filter(Boolean);
    const fromRaces = races.map(r => r.class_name).filter(Boolean);
    const fromSets = sets.map(s => s.class_name).filter(Boolean);

    return Array.from(
      new Set([...fromEntries, ...fromRaces, ...fromSets])
    ).sort();
  };

  //
  // ------ Attach Race Names ------
  //
  const attachRaceNames = useCallback((rawSets: FleetSet[], allRaces: RaceLite[]) => {
    const bySet: Record<number, string[]> = {};

    allRaces.forEach(r => {
      if (r.fleet_set_id != null) {
        if (!bySet[r.fleet_set_id]) bySet[r.fleet_set_id] = [];
        bySet[r.fleet_set_id].push(r.name);
      }
    });

    return rawSets.map(s => ({
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
        const [entries, rcs] = await Promise.all([
          apiGet<EntryLite[]>(`/entries/by_regatta/${regattaId}`),
          apiGet<RaceLite[]>(`/races/by_regatta/${regattaId}`)
        ]);

        setEntryList(entries);
        setRaces(rcs);

        const cls = collectClasses(entries, rcs, []);
        setClasses(cls);
        if (!selectedClass && cls.length > 0) {
          setSelectedClass(cls[0]);
        }
      } catch (e) {
        console.error("useFleets: erro entries/races", e);
        setError(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [regattaId]);

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

        // atualizar classes robustamente
        setClasses(collectClasses(entryList, races, enriched));

        if (enriched.length > 0) {
          setSelectedSetId(prev => prev ?? enriched[0].id);
        } else {
          setSelectedSetId(null);
        }
      } catch (e) {
        console.error("useFleets: erro fleet-sets", e);
        setError(e);
        setSets([]);
        setSelectedSetId(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [regattaId, selectedClass, races, attachRaceNames]);

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
          `/regattas/${regattaId}/classes/${encodeURIComponent(selectedClass)}/fleet-sets/${selectedSetId}/assignments`
        );

        const enriched = data.assignments.map(a => {
          const entry = entryList.find(e => e.id === a.entry_id);
          return {
            entry_id: a.entry_id,
            fleet_id: a.fleet_id,
            sail_number: entry?.sail_number ?? null,
            boat_name: entry?.boat_name ?? null,
            helm_name: entry ? `${entry.first_name ?? ''} ${entry.last_name ?? ''}`.trim() : null
          };
        });

        setAssignments(enriched);
      } catch (e) {
        console.error("useFleets: erro assignments", e);
        setAssignments([]);
      }
    })();
  }, [regattaId, selectedClass, selectedSetId, entryList]);

  //
  // ----------------- racesInSelectedSet -----------------
  //
  const racesInSelectedSet = useMemo(() => {
    if (!selectedSetId) return [];
    return races.filter(r => r.fleet_set_id === selectedSetId);
  }, [races, selectedSetId]);

  //
  // ----------------- racesAvailable -----------------
  //
  const racesAvailable = useMemo(() => {
    if (!selectedClass) return [];
    const used = new Set(races.filter(r => r.fleet_set_id != null).map(r => r.id));

    return races
      .filter(r => r.class_name === selectedClass && !used.has(r.id))
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
        )
      ]);

      setRaces(rcs);
      const enriched = attachRaceNames(sts, rcs);
      setSets(enriched);

      // atualizar classes
      setClasses(collectClasses(entryList, rcs, enriched));

      if (enriched.length === 0) {
        setSelectedSetId(null);
        setAssignments([]);
      }
    } catch (e) {
      console.error("refreshSetsAndRaces", e);
    }
  }, [regattaId, selectedClass, attachRaceNames]);

  //
  // ----------------- ACTIONS -----------------
  //
  const createQualifying = useCallback(async (label: string, num_fleets: 2 | 3 | 4, race_ids: number[]) => {
    if (!regattaId || !selectedClass) throw new Error("Classe não selecionada.");

    const fs = await apiSend<FleetSet>(
      `/regattas/${regattaId}/classes/${encodeURIComponent(selectedClass)}/fleet-sets/qualifying`,
      "POST",
      { label, num_fleets, race_ids }
    );

    await refreshSetsAndRaces();
    setSelectedSetId(fs.id);
  }, [regattaId, selectedClass, refreshSetsAndRaces]);

  const reshuffle = useCallback(async (label: string, num_fleets: 2 | 3 | 4, race_ids: number[]) => {
    if (!regattaId || !selectedClass) throw new Error("Classe não selecionada.");

    const fs = await apiSend<FleetSet>(
      `/regattas/${regattaId}/classes/${encodeURIComponent(selectedClass)}/fleet-sets/reshuffle`,
      "POST",
      { label, num_fleets, race_ids }
    );

    await refreshSetsAndRaces();
    setSelectedSetId(fs.id);
  }, [regattaId, selectedClass, refreshSetsAndRaces]);

  const startFinals = useCallback(async (label: string, grouping: Record<string, number>, race_ids?: number[]) => {
    if (!regattaId || !selectedClass) throw new Error("Classe não selecionada.");

    const body = { label, grouping, race_ids: race_ids ?? [] };

    const res = await apiSend<FleetSet>(
      `/regattas/${regattaId}/classes/${encodeURIComponent(selectedClass)}/fleet-sets/finals`,
      "POST",
      body,
      token ?? undefined
    );

    await refreshSetsAndRaces();
    setSelectedSetId(res.id);
  }, [regattaId, selectedClass, token, refreshSetsAndRaces]);

  const updateFleetSetRaces = useCallback(async (setId: number, raceIds: number[]) => {
    if (!regattaId || !selectedClass) return;

    try {
      await apiSend(
        `/regattas/${regattaId}/classes/${encodeURIComponent(selectedClass)}/fleet-sets/${setId}/races`,
        "PUT",
        { race_ids: raceIds }
      );

      await refreshSetsAndRaces();
    } catch (err) {
      console.error("updateFleetSetRaces falhou:", err);
      alert("Não foi possível atualizar as races deste FleetSet.");
    }
  }, [regattaId, selectedClass, refreshSetsAndRaces]);

  const publishSet = useCallback(async (setId: number) => {
    await apiSend(
      `/regattas/${regattaId}/classes/${encodeURIComponent(selectedClass!)}/fleet-sets/${setId}/publish`,
      "POST"
    );
    await refreshSetsAndRaces();
  }, [regattaId, selectedClass, refreshSetsAndRaces]);

  const unpublishSet = useCallback(async (setId: number) => {
    await apiSend(
      `/regattas/${regattaId}/classes/${encodeURIComponent(selectedClass!)}/fleet-sets/${setId}/unpublish`,
      "POST"
    );
    await refreshSetsAndRaces();
  }, [regattaId, selectedClass, refreshSetsAndRaces]);

  const updateSetTitle = useCallback(async (setId: number, newTitle: string) => {
    await apiSend(
      `/regattas/${regattaId}/classes/${encodeURIComponent(selectedClass!)}/fleet-sets/${setId}`,
      "PATCH",
      { public_title: newTitle }
    );
    await refreshSetsAndRaces();
  }, [regattaId, selectedClass, refreshSetsAndRaces]);

  const createMedalRace = useCallback(async (regattaId: number, raceId: number, entries: number[]) => {
    setLoading(true);
    setError(null);

    try {
      await apiSend(
        `/regattas/${regattaId}/medal_race/assign`,
        "POST",
        { race_id: raceId, entries }
      );

      await refreshSetsAndRaces();
    } catch (e: any) {
      console.error("createMedalRace erro:", e);
      setError(e?.message ?? "Erro ao criar Medal Race.");
    } finally {
      setLoading(false);
    }
  }, [refreshSetsAndRaces]);

  //
  // ----------------- RETURN -----------------
  //
  return {
    classes,
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

    createQualifying,
    reshuffle,
    startFinals,
    updateFleetSetRaces,
    publishSet,
    unpublishSet,
    updateSetTitle,
    createMedalRace,
  };
}
