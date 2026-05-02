"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiGet, apiPatch, apiDelete } from "@/lib/api";
import type { HearingItem, HearingStatus, HearingsList } from "@/types/hearings";

/** `sch_date` vem como YYYY-MM-DD; mostrar dia–mês–ano (pt-PT), não ordem US tipo 03/24/2026. */
function formatHearingDate(iso: string | null | undefined): string {
  if (!iso || typeof iso !== "string") return "—";
  const t = iso.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const dt = new Date(y, mo, d);
    if (!Number.isFinite(dt.getTime())) return "—";
    return new Intl.DateTimeFormat("pt-PT", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(dt);
  }
  const dt = new Date(t);
  if (!Number.isFinite(dt.getTime())) return t || "—";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(dt);
}

export type HearingsDecisionsProps = {
  regattaId: number;
  /** e.g. admin `(p) => withOrg(p, orgSlug)` ou dashboard `withOrg` do contexto */
  linkWithOrg: (path: string) => string;
  newProtestHref: string;
  /** URL do formulário de decisão (admin: …/decisions/:id; dashboard: …/protests/:id/decision) */
  fillDecisionPath: (protestId: number) => string;
};

export default function HearingsDecisions({
  regattaId,
  linkWithOrg,
  newProtestHref,
  fillDecisionPath,
}: HearingsDecisionsProps) {
  const router = useRouter();

  const [rows, setRows] = useState<HearingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // filters
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "closed">("all");

  // inline edit
  const [editingId, setEditingId] = useState<number | null>(null);
  const [patch, setPatch] = useState<Partial<HearingItem>>({});

  // LIST PATH — sends "open"/"closed" in lowercase
  const listPath = useMemo(() => {
    const p = new URLSearchParams();
    if (statusFilter !== "all") p.set("status_q", statusFilter);
    return `/hearings/${regattaId}${p.toString() ? `?${p.toString()}` : ""}`;
  }, [regattaId, statusFilter]);

  async function fetchRows() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<HearingsList>(listPath);
      setRows(Array.isArray(data?.items) ? data.items : []);
    } catch (e: any) {
      setRows([]);
      setError(e?.message || "Failed to load hearings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listPath]);

  function cleanPatch(p: Partial<HearingItem>): Record<string, unknown> {
    // remove undefined and empty strings (evita 422/failed to fetch)
    const out: Record<string, unknown> = {};
    Object.entries(p).forEach(([k, v]) => {
      if (v === undefined) return;
      if (typeof v === "string" && v.trim() === "") return;
      out[k] = v;
    });
    return out;
  }

  async function saveEdit(id: number) {
    try {
      const body = cleanPatch(patch);
      await apiPatch(`/hearings/${id}`, body);
      setEditingId(null);
      setPatch({});
      fetchRows();
    } catch (e: any) {
      alert(e?.message || "Failed to save.");
    }
  }

  async function remove(id: number) {
    if (!confirm("Delete this hearing?")) return;
    try {
      await apiDelete(`/hearings/${id}`);
      fetchRows();
    } catch (e: any) {
      alert(e?.message || "Failed to delete.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Protest Decisions/Hearings</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={linkWithOrg(newProtestHref)}
            className="inline-flex items-center rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            New protest
          </Link>
          <select
            className="border rounded px-2 py-1"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="all">All</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
          <button className="px-3 py-1 border rounded hover:bg-gray-50" onClick={fetchRows}>
            Refresh
          </button>
        </div>
      </div>

      {/* 🔥 Removed the "Create Hearing" block from admin UI */}

      <div className="overflow-x-auto rounded border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2">Case</th>
              <th className="p-2">Race</th>
              <th className="p-2">Initiator</th>
              <th className="p-2">Respondent</th>
              <th className="p-2">Hearing date</th>
              <th className="p-2">Hearing time</th>
              <th className="p-2">Room</th>
              <th className="p-2">Status</th>
              <th className="p-2">Decision</th>
              <th className="p-2">Documents</th>
              <th className="p-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="p-3" colSpan={11}>
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td className="p-6 text-center text-gray-500" colSpan={11}>
                  No hearings.
                </td>
              </tr>
            )}

            {rows.map((r) => {
              const isEd = editingId === r.id;
              return (
                <tr key={r.id} className="border-t align-top">
                  <td className="p-2">{r.case_number}</td>
                  <td className="p-2">{r.race}</td>
                  <td className="p-2">{r.initiator}</td>
                  <td className="p-2">{r.respondent}</td>

                  <td className="p-2">
                    {isEd ? (
                      <input
                        type="date"
                        lang="en-GB"
                        className="border rounded p-1"
                        value={(patch.sch_date ?? r.sch_date ?? "") as string}
                        onChange={(e) => setPatch({ ...patch, sch_date: e.target.value })}
                      />
                    ) : (
                      formatHearingDate(r.sch_date)
                    )}
                  </td>

                  <td className="p-2">
                    {isEd ? (
                      <input
                        type="time"
                        className="border rounded p-1"
                        value={(patch.sch_time ?? r.sch_time ?? "") as string}
                        onChange={(e) => setPatch({ ...patch, sch_time: e.target.value })}
                      />
                    ) : (
                      r.sch_time || "—"
                    )}
                  </td>

                  <td className="p-2">
                    {isEd ? (
                      <input
                        className="border rounded p-1 w-28"
                        value={(patch.room ?? r.room ?? "") as string}
                        onChange={(e) => setPatch({ ...patch, room: e.target.value })}
                      />
                    ) : (
                      r.room || "—"
                    )}
                  </td>

                  <td className="p-2">
                    {isEd ? (
                      <select
                        className="border rounded p-1"
                        value={(patch.status ?? r.status) as HearingStatus}
                        onChange={(e) =>
                          setPatch({ ...patch, status: e.target.value as HearingStatus })
                        }
                      >
                        <option value="OPEN">OPEN</option>
                        <option value="CLOSED">CLOSED</option>
                      </select>
                    ) : (
                      r.status
                    )}
                  </td>

                  <td className="p-2">
                    {isEd ? (
                      <textarea
                        className="border rounded p-1 w-64"
                        rows={3}
                        value={(patch.decision ?? r.decision ?? "") as string}
                        onChange={(e) => setPatch({ ...patch, decision: e.target.value })}
                      />
                    ) : (
                      r.decision || "—"
                    )}
                  </td>

                  {/* DOCUMENTS */}
                  <td className="p-2">
                    <div className="flex flex-wrap gap-3 items-center">
                      {r.submitted_pdf_url ? (
                        <a
                          href={r.submitted_pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                          title="Submitted protest snapshot (PDF)"
                        >
                          Submitted PDF
                        </a>
                      ) : (
                        <span className="text-gray-400">Submitted PDF —</span>
                      )}

                      {r.decision_pdf_url ? (
                        <a
                          href={`${r.decision_pdf_url}?v=${Date.now()}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                          title="Decision PDF"
                        >
                          Decision PDF
                        </a>
                      ) : (
                        <span className="text-gray-400">Decision PDF —</span>
                      )}
                      <button
                        type="button"
                        className="px-2 py-1 border rounded text-blue-600 hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none"
                        disabled={r.protest_id == null || !Number.isFinite(Number(r.protest_id))}
                        onClick={() => {
                          const pid = r.protest_id;
                          if (pid == null || !Number.isFinite(pid)) return;
                          router.push(linkWithOrg(fillDecisionPath(pid)));
                        }}
                        title="Fill or update decision and generate PDF"
                      >
                        Fill decision
                      </button>
                    </div>
                  </td>

                  <td className="p-2 text-right">
                    {!isEd ? (
                      <div className="inline-flex gap-3">
                        <button
                          className="text-blue-600 hover:underline"
                          onClick={() => {
                            setEditingId(r.id);
                            setPatch({});
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="text-red-600 hover:underline"
                          onClick={() => remove(r.id)}
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <div className="inline-flex gap-3">
                        <button
                          className="text-blue-600 hover:underline"
                          onClick={() => saveEdit(r.id)}
                        >
                          Save
                        </button>
                        <button
                          className="text-gray-600 hover:underline"
                          onClick={() => {
                            setEditingId(null);
                            setPatch({});
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {error && <div className="text-red-600">{error}</div>}
    </div>
  );
}
