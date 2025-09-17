"use client";
import { useEffect, useState, useCallback } from "react";
import { apiGet } from "@/lib/api";
import type { HearingItem, HearingsList } from "@/types/hearings";

export function useHearings(regattaId: number, status: "all"|"open"|"closed"="all", q="") {
  const [data, setData] = useState<HearingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const qs = new URLSearchParams();
      if (status !== "all") qs.set("status", status);
      if (q) qs.set("q", q);
      const res = await apiGet<HearingsList>(`/hearings/${regattaId}?${qs.toString()}`);
      setData(res.items || []);
    } catch (e:any) {
      setError(e?.message || "Erro a carregar hearings.");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [regattaId, status, q]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { data, loading, error, refresh };
}
