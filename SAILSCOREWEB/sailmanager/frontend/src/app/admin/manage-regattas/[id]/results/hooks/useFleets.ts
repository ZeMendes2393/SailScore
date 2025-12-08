'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
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
  race_names?: string[];     // apenas “resumo” do backend
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
// Hook principal
//
export function useFleets() {
  const params = useParams<{ id: string }>();
  const regattaId = Number(params.id);
  const { token } = useAuth();

  const [entryList, setEntryList] = useState<EntryLite[]>([]);
  const [races, setRaces] = useState<RaceLite[]>([]);

  const [classes, setClasses] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);

  const [sets, setSets] = useState<FleetSet[]>([]);
  const [selectedSetId, setSelectedSetId] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // ---------- Helper: anexar nomes de races aos FleetSets ----------
  const attachRaceNames = useCallback(
    (rawSets: FleetSet[], allRaces: RaceLite[]): FleetSet[] => {
      const bySet: Record<number, string[]> = {};

      allRaces.forEach((r) => {
        if (r.fleet_set_id != null) {
          if (!bySet[r.fleet_set_id]) bySet[r.fleet_set_id] = [];
          // podes ajustar o texto aqui se quiseres mostrar também a classe
          bySet[r.fleet_set_id].push(`${r.name} (${r.class_name})`);
        }
      });

      return rawSets.map((s) => ({
        ...s,
        race_names: (bySet[s.id] ?? []).slice().sort(),
      }));
    },
    []
  );

  // --------- Carregar entries + races ---------
  useEffect(() => {
    if (!regattaId || Number.isNaN(regattaId)) return;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [entries, rcs] = await Promise.all([
          apiGet<EntryLite[]>(`/entries/by_regatta/${regattaId}`),
          apiGet<RaceLite[]>(`/races/by_regatta/${regattaId}`),
        ]);

        setEntryList(entries);
        setRaces(rcs);

        const cls = Array.from(
          new Set(entries.map((e) => e.class_name).filter(Boolean))
        ).sort();

        setClasses(cls);
        if (!selectedClass && cls.length > 0) {
          setSelectedClass(cls[0]);
        }
      } catch (e) {
        console.error('useFleets: erro a carregar entries/races', e);
        setError(e);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regattaId]);

  // --------- Carregar FleetSets para a classe selecionada ---------
  useEffect(() => {
    if (!regattaId || !selectedClass) {
      setSets([]);
      setSelectedSetId(null);
      setAssignments([]);
      return;
    }

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiGet<FleetSet[]>(
          `/regattas/${regattaId}/classes/${encodeURIComponent(
            selectedClass
          )}/fleet-sets`
        );

        const enriched = attachRaceNames(data, races);
        setSets(enriched);

        if (enriched.length > 0) {
          setSelectedSetId((prev) => prev ?? enriched[0].id);
        } else {
          setSelectedSetId(null);
          setAssignments([]);
        }
      } catch (e) {
        console.error('useFleets: erro a carregar fleet-sets', e);
        setError(e);
        setSets([]);
        setSelectedSetId(null);
        setAssignments([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [regattaId, selectedClass, races, attachRaceNames]);

  // --------- Carregar assignments do set selecionado ---------
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

        const enriched: Assignment[] = data.assignments.map((a) => {
          const entry = entryList.find((e) => e.id === a.entry_id);
          return {
            entry_id: a.entry_id,
            fleet_id: a.fleet_id,
            sail_number: entry?.sail_number ?? null,
            boat_name: entry?.boat_name ?? null,
            helm_name: entry
              ? `${entry.first_name ?? ''} ${entry.last_name ?? ''}`.trim() || null
              : null,
          };
        });

        setAssignments(enriched);
      } catch (e) {
        console.error('useFleets: erro a carregar assignments', e);
        setAssignments([]);
      }
    })();
  }, [regattaId, selectedClass, selectedSetId, entryList]);

  // --------- Lista de races usadas pelo set selecionado ---------
  const racesInSelectedSet: RaceLite[] = useMemo(() => {
    if (!selectedSetId) return [];
    return races.filter((r) => r.fleet_set_id === selectedSetId);
  }, [races, selectedSetId]);

  // --------- Races disponíveis para ligar a fleet sets ---------
  const racesAvailable: RaceLite[] = useMemo(() => {
    if (!selectedClass) return [];
    const usedIds = new Set(
      races.filter((r) => r.fleet_set_id != null).map((r) => r.id)
    );
    return races
      .filter(
        (r) => r.class_name === selectedClass && !usedIds.has(r.id)
      )
      .sort((a, b) => (a.order_index ?? a.id) - (b.order_index ?? b.id));
  }, [races, selectedClass]);

  // --------- Helpers de refresh ---------
  const refreshSetsAndRaces = useCallback(async () => {
    if (!regattaId || !selectedClass) return;
    try {
      const [rcs, sts] = await Promise.all([
        apiGet<RaceLite[]>(`/races/by_regatta/${regattaId}`),
        apiGet<FleetSet[]>(
          `/regattas/${regattaId}/classes/${encodeURIComponent(
            selectedClass
          )}/fleet-sets`
        ),
      ]);

      setRaces(rcs);
      const enriched = attachRaceNames(sts, rcs);
      setSets(enriched);

      if (enriched.length === 0) {
        setSelectedSetId(null);
        setAssignments([]);
      }
    } catch (e) {
      console.error('refreshSetsAndRaces falhou:', e);
    }
  }, [regattaId, selectedClass, attachRaceNames]);

  // --------- Actions: criar Qualifying ---------
  const createQualifying = useCallback(
    async (label: string, num_fleets: 2 | 3 | 4, race_ids: number[]) => {
      if (!regattaId || !selectedClass) {
        throw new Error('Regata ou classe não selecionada.');
      }
      const body = { label, num_fleets, race_ids };
      const fs = await apiSend<FleetSet>(
        `/regattas/${regattaId}/classes/${encodeURIComponent(
          selectedClass
        )}/fleet-sets/qualifying`,
        'POST',
        body
      );
      await refreshSetsAndRaces();
      setSelectedSetId(fs.id);
    },
    [regattaId, selectedClass, refreshSetsAndRaces]
  );

  // --------- Actions: reshuffle ---------
  const reshuffle = useCallback(
    async (label: string, num_fleets: 2 | 3 | 4, race_ids: number[]) => {
      if (!regattaId || !selectedClass) {
        throw new Error('Regata ou classe não selecionada.');
      }
      const body = { label, num_fleets, race_ids };
      const fs = await apiSend<FleetSet>(
        `/regattas/${regattaId}/classes/${encodeURIComponent(
          selectedClass
        )}/fleet-sets/reshuffle`,
        'POST',
        body
      );
      await refreshSetsAndRaces();
      setSelectedSetId(fs.id);
    },
    [regattaId, selectedClass, refreshSetsAndRaces]
  );

  // --------- Actions: finals ---------
  const startFinals = useCallback(
    async (
      label: string,
      grouping: Record<string, number>,
      raceIds: number[] = []
    ) => {
      if (!selectedClass) {
        throw new Error('Seleciona uma classe primeiro.');
      }
      setLoading(true);
      setError(null);

      try {
        const body = {
          label,
          grouping,
          race_ids: raceIds,
        };

        const res = await apiSend<FleetSet>(
          `/regattas/${regattaId}/classes/${encodeURIComponent(
            selectedClass
          )}/fleet-sets/finals`,
          'POST',
          body,
          token ?? undefined
        );

        await refreshSetsAndRaces();
        setSelectedSetId(res.id);
      } catch (e: any) {
        setError(e?.message ?? 'Erro ao iniciar finals.');
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [regattaId, selectedClass, token, refreshSetsAndRaces]
  );

  // --------- Actions: apagar FleetSet ---------
  const deleteFleetSet = useCallback(
    async (setId: number, opts?: { force?: boolean }) => {
      if (!regattaId || !selectedClass) return;

      const qs = opts?.force ? '?force=true' : '';

      try {
        await apiSend(
          `/regattas/${regattaId}/classes/${encodeURIComponent(
            selectedClass
          )}/fleet-sets/${setId}${qs}`,
          'DELETE'
        );

        if (selectedSetId === setId) {
          setSelectedSetId(null);
          setAssignments([]);
        }

        await refreshSetsAndRaces();
      } catch (err: any) {
        let detail: any = null;

        if (typeof err?.message === 'string') {
          try {
            detail = JSON.parse(err.message);
          } catch {
            /* ignore */
          }
        }
        if (!detail && err?.detail) {
          detail = err.detail;
        }

        if (detail && detail.code === 'FLEETSET_HAS_RESULTS') {
          const msg = [
            'There are results scored for races linked to this fleet set.',
            '',
            `Races: ${detail.race_count}`,
            `Results: ${detail.result_count}`,
            '',
            'Do you really want to delete this fleet set?',
            '(The race results will stay, só perdes a info de fleets.)',
          ].join('\n');

          const ok = window.confirm(msg);
          if (ok) {
            await deleteFleetSet(setId, { force: true });
          }
          return;
        }

        console.error('deleteFleetSet falhou:', err);
        alert('Não foi possível apagar este FleetSet.');
      }
    },
    [regattaId, selectedClass, selectedSetId, refreshSetsAndRaces]
  );

  // --------- Actions: atualizar races ligadas a um FleetSet ---------
  const updateFleetSetRaces = useCallback(
    async (setId: number, raceIds: number[]) => {
      if (!regattaId || !selectedClass) return;

      const baseUrl = `/regattas/${regattaId}/classes/${encodeURIComponent(
        selectedClass
      )}/fleet-sets/${setId}/races`;

      const sendOnce = async (force: boolean) => {
        const qs = force ? '?force=true' : '';
        return apiSend<FleetSet>(
          `${baseUrl}${qs}`,
          'PUT',
          { race_ids: raceIds }
        );
      };

      try {
        await sendOnce(false);
        await refreshSetsAndRaces();
      } catch (err: any) {
        let detail: any = undefined;
        try {
          if (
            typeof err?.message === 'string' &&
            err.message.trim().startsWith('{')
          ) {
            detail = JSON.parse(err.message);
          } else if (err?.detail) {
            detail = err.detail;
          }
        } catch {
          detail = err?.detail ?? null;
        }

        if (detail && detail.code === 'RACES_WITH_RESULTS') {
          const ok = window.confirm(
            `There are ${detail.result_count} result(s) in ${detail.race_count} race(s) you are removing from this fleet set.\n` +
              `Are you sure you want to proceed?`
          );
          if (ok) {
            await sendOnce(true);
            await refreshSetsAndRaces();
          }
        } else {
          console.error('updateFleetSetRaces falhou:', err);
          alert('Não foi possível atualizar as races deste FleetSet.');
        }
      }
    },
    [regattaId, selectedClass, refreshSetsAndRaces]
  );

  return {
    classes,
    selectedClass,
    setSelectedClass,
    sets,
    selectedSetId,
    setSelectedSetId,
    assignments,
    racesAvailable,
    racesInSelectedSet,   // 👈 importante para usar no FleetManager
    loading,
    error,
    createQualifying,
    reshuffle,
    startFinals,
    deleteFleetSet,
    updateFleetSetRaces,

  };
}
