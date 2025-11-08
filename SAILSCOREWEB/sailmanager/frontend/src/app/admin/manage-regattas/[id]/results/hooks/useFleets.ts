'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

type Fleet = { id: number; name: string; order_index: number | null };
export type FleetSet = {
  id: number;
  regatta_id: number;
  class_name: string;
  phase: 'qualifying' | 'finals';
  label: string | null;
  fleets: Fleet[];
};
type Assignment = {
  id: number; fleet_id: number; entry_id: number;
  sail_number?: string | null; boat_name?: string | null; helm_name?: string | null;
};
type RaceLite = { id: number; name: string; class_name: string; order_index?: number | null };

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';

export function useFleets() {
  const params = useParams<{ id: string }>();
  const regattaId = Number(params.id);
  const { token } = useAuth();

  const [classes, setClasses] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);

  const [sets, setSets] = useState<FleetSet[]>([]);
  const [loading, setLoading] = useState(false);
  const [races, setRaces] = useState<RaceLite[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedSetId, setSelectedSetId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const headers = useMemo(() => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }), [token]);

  const apiGet = useCallback(async (path: string) => {
    const res = await fetch(`${API}${path}`, { headers, credentials: 'include' });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json();
  }, [headers]);

  const apiPost = useCallback(async (path: string, body?: any) => {
    const res = await fetch(`${API}${path}`, {
      method: 'POST', headers, credentials: 'include',
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) throw new Error(`POST ${path} -> ${res.status}`);
    return res.json().catch(() => ({}));
  }, [headers]);

  // classes + corridas
  useEffect(() => {
    (async () => {
      try {
        const [cls, rcs] = await Promise.all([
          apiGet(`/regattas/${regattaId}/classes`),
          apiGet(`/races/by_regatta/${regattaId}`)
        ]);
        setClasses(cls || []);
        setSelectedClass(prev => prev ?? (cls?.[0] ?? null));
        setRaces((rcs || []).sort((a: RaceLite, b: RaceLite) => (a.order_index ?? a.id) - (b.order_index ?? b.id)));
      } catch {
        setError('Falha a carregar classes/corridas');
      }
    })();
  }, [apiGet, regattaId]);

  // sets da classe
  const refreshSets = useCallback(async (cls: string | null) => {
    if (!cls) { setSets([]); return; }
    setLoading(true);
    try {
      const data: FleetSet[] = await apiGet(`/regattas/${regattaId}/classes/${encodeURIComponent(cls)}/fleet-sets`);
      setSets(data || []);
    } catch {
      setError('Falha a carregar fleet sets');
    } finally {
      setLoading(false);
    }
  }, [apiGet, regattaId]);

  useEffect(() => { refreshSets(selectedClass); }, [refreshSets, selectedClass]);

  // assignments
  const loadAssignments = useCallback(async (setId: number | null) => {
    if (!selectedClass || !setId) { setAssignments([]); return; }
    try {
      const data = await apiGet(`/regattas/${regattaId}/classes/${encodeURIComponent(selectedClass)}/fleet-sets/${setId}/assignments`);
      setAssignments(data?.assignments ?? []);
    } catch { setAssignments([]); }
  }, [apiGet, regattaId, selectedClass]);

  useEffect(() => { loadAssignments(selectedSetId); }, [loadAssignments, selectedSetId]);

  // ações
  const createQualifying = useCallback(async (label: string, num_fleets: 2|3|4, race_ids: number[]) => {
    if (!selectedClass) throw new Error('Sem classe selecionada');
    const res = await apiPost(`/regattas/${regattaId}/classes/${encodeURIComponent(selectedClass)}/fleet-sets/qualifying`, { label, num_fleets, race_ids });
    await refreshSets(selectedClass);
    return res;
  }, [apiPost, regattaId, selectedClass, refreshSets]);

  const reshuffle = useCallback(async (label: string, num_fleets: 2|3|4, race_ids: number[]) => {
    if (!selectedClass) throw new Error('Sem classe selecionada');
    const res = await apiPost(`/regattas/${regattaId}/classes/${encodeURIComponent(selectedClass)}/fleet-sets/reshuffle`, { label, num_fleets, race_ids });
    await refreshSets(selectedClass);
    return res;
  }, [apiPost, regattaId, selectedClass, refreshSets]);

  const startFinals = useCallback(async (mode: 'auto'|'manual', payload: any) => {
    if (!selectedClass) throw new Error('Sem classe selecionada');
    const res = await apiPost(`/regattas/${regattaId}/classes/${encodeURIComponent(selectedClass)}/finals`, { mode, ...payload });
    await refreshSets(selectedClass);
    return res;
  }, [apiPost, regattaId, selectedClass, refreshSets]);

  const classRaces = useMemo(() => (selectedClass ? races.filter(r => r.class_name === selectedClass) : []), [races, selectedClass]);

  return {
    // estado
    regattaId, classes, selectedClass, setSelectedClass,
    sets, assignments, selectedSetId, setSelectedSetId,
    races: classRaces, loading, error,

    // ações
    refreshSets, loadAssignments, createQualifying, reshuffle, startFinals,
  };
}
