// src/app/.../Rule42Public.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { BASE_URL as API_BASE } from "@/lib/api"; // só para compor a URL

type Row = {
  id: number;
  sail_num: string;
  penalty_number: string;
  race: string;
  group: string | null;
  rule: string;
  comp_action: string | null;
  description: string | null;
  class_name: string;
  date: string; // "YYYY-MM-DD"
};

type Filters = {
  class_name?: string;
  sail_num?: string;
  race?: string;
  group?: string;
};

function safeDateToPt(dateStr?: string) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  // Alguns backends devolvem "YYYY-MM-DD" e o Date() pode falhar nalguns browsers/timezones
  // Se falhar, tenta forçar como UTC:
  if (isNaN(d.getTime())) {
    const parts = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (parts) {
      const d2 = new Date(Date.UTC(+parts[1], +parts[2] - 1, +parts[3]));
      if (!isNaN(d2.getTime())) return d2.toLocaleDateString("pt-PT");
    }
    return "—";
  }
  return d.toLocaleDateString("pt-PT");
}

export default function Rule42Public({ regattaId }: { regattaId: number }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({});

  const listPath = useMemo(() => {
    const p = new URLSearchParams();
    if (filters.class_name) p.set("class_name", filters.class_name);
    if (filters.sail_num) p.set("sail_num", filters.sail_num);
    if (filters.race) p.set("race", filters.race);
    if (filters.group) p.set("group", filters.group);
    return `/rule42/${regattaId}${p.toString() ? `?${p.toString()}` : ""}`;
  }, [regattaId, filters]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErrMsg(null);
      try {
        // ⚠️ Chamada SEM headers (para evitar problemas de Authorization/CORS)
        const res = await fetch(`${API_BASE}${listPath}`, { cache: "no-store" });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `HTTP ${res.status}`);
        }
        const data = (await res.json()) as unknown;
        const arr = Array.isArray(data) ? (data as Row[]) : [];
        if (!cancelled) setRows(arr);
      } catch (e: any) {
        console.error("[Rule42Public] Falha no fetch:", e);
        if (!cancelled) {
          setRows([]);
          setErrMsg(e?.message || "Erro ao carregar dados.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listPath]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-5">
        <input
          className="border rounded p-2"
          placeholder="Class"
          value={filters.class_name || ""}
          onChange={(e) =>
            setFilters({ ...filters, class_name: e.target.value || undefined })
          }
        />
        <input
          className="border rounded p-2"
          placeholder="Sail Number"
          value={filters.sail_num || ""}
          onChange={(e) =>
            setFilters({ ...filters, sail_num: e.target.value || undefined })
          }
        />
        <input
          className="border rounded p-2"
          placeholder="Race"
          value={filters.race || ""}
          onChange={(e) =>
            setFilters({ ...filters, race: e.target.value || undefined })
          }
        />
        <input
          className="border rounded p-2"
          placeholder="Group"
          value={filters.group || ""}
          onChange={(e) =>
            setFilters({ ...filters, group: e.target.value || undefined })
          }
        />
        <button className="border rounded p-2" onClick={() => setFilters({})}>
          Limpar
        </button>
      </div>

      {errMsg && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errMsg}
        </div>
      )}

      <div className="overflow-x-auto rounded border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2">Sail Number</th>
              <th className="p-2">Penalty Number</th>
              <th className="p-2">Race</th>
              <th className="p-2">Group</th>
              <th className="p-2">Rule</th>
              <th className="p-2">Competitor action</th>
              <th className="p-2">Notes</th>
              <th className="p-2">Class</th>
              <th className="p-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="p-3" colSpan={9}>
                  A carregar…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td className="p-6 text-center text-gray-500" colSpan={9}>
                  Sem registos.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t align-top">
                <td className="p-2">{r.sail_num}</td>
                <td className="p-2">{r.penalty_number}</td>
                <td className="p-2">{r.race}</td>
                <td className="p-2">{r.group || "—"}</td>
                <td className="p-2">{r.rule}</td>
                <td className="p-2">{r.comp_action || "—"}</td>
                <td className="p-2">{r.description || "—"}</td>
                <td className="p-2">{r.class_name}</td>
                <td className="p-2">{safeDateToPt(r.date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
