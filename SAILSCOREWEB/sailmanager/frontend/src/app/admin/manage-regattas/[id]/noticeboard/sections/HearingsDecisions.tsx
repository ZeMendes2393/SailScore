"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPatch, apiDelete, apiPost } from "@/lib/api";
import type { HearingItem, HearingStatus, HearingsList } from "@/types/hearings";

export default function HearingsDecisions({ regattaId }: { regattaId: number }) {
  const [rows, setRows] = useState<HearingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // filtros
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "closed">("all");

  // criação rápida a partir de um protest_id
  const [protestId, setProtestId] = useState("");

  // edição inline
  const [editingId, setEditingId] = useState<number | null>(null);
  const [patch, setPatch] = useState<Partial<HearingItem>>({});

  // LIST PATH — envia "open"/"closed" em minúsculas
  const listPath = useMemo(() => {
    const p = new URLSearchParams();
    if (statusFilter !== "all") p.set("status_q", statusFilter); // "open" | "closed"
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
      setError(e?.message || "Erro a carregar hearings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listPath]);

  async function createFromProtest() {
    const pid = Number(protestId);
    if (!Number.isFinite(pid) || pid <= 0) {
      alert("Indica um protest_id válido.");
      return;
    }
    try {
      await apiPost(`/hearings/for-protest/${pid}`, {}); // 201
      setProtestId("");
      fetchRows();
    } catch (e: any) {
      alert(e?.message || "Falha a criar hearing.");
    }
  }

  async function saveEdit(id: number) {
    try {
      await apiPatch(`/hearings/${id}`, patch);
      setEditingId(null);
      setPatch({});
      fetchRows();
    } catch (e: any) {
      alert(e?.message || "Falha ao guardar.");
    }
  }

  async function remove(id: number) {
    if (!confirm("Apagar este hearing?")) return;
    try {
      await apiDelete(`/hearings/${id}`);
      fetchRows();
    } catch (e: any) {
      alert(e?.message || "Falha ao apagar.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Hearings & Decisions</h2>
        <div className="flex items-center gap-2">
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
            Atualizar
          </button>
        </div>
      </div>

      {/* Criar a partir de protest_id */}
      <div className="flex flex-wrap items-end gap-2 bg-white border rounded p-3">
        <div>
          <label className="block text-sm mb-1">Protest ID</label>
          <input
            className="border rounded px-2 py-1 w-32"
            placeholder="ex.: 45"
            value={protestId}
            onChange={(e) => setProtestId(e.target.value)}
          />
        </div>
        <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={createFromProtest}>
          Criar Hearing
        </button>
      </div>

      <div className="overflow-x-auto rounded border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2">Case</th>
              <th className="p-2">Race</th>
              <th className="p-2">Initiator</th>
              <th className="p-2">Respondent</th>
              <th className="p-2">Date</th>
              <th className="p-2">Time</th>
              <th className="p-2">Room</th>
              <th className="p-2">Status</th>
              <th className="p-2">Decision</th>
              <th className="p-2">Documents</th>
              <th className="p-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="p-3" colSpan={11}>
                  A carregar…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td className="p-6 text-center text-gray-500" colSpan={11}>
                  Sem hearings.
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
                        className="border rounded p-1"
                        value={(patch.sch_date ?? r.sch_date ?? "") as string}
                        onChange={(e) => setPatch({ ...patch, sch_date: e.target.value })}
                      />
                    ) : (
                      r.sch_date || "—"
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

                  {/* DOCUMENTS: Submitted + Decision */}
                  <td className="p-2">
                    <div className="flex flex-wrap gap-3">
                      {r.submitted_pdf_url ? (
                        <a
                          href={r.submitted_pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                          title="PDF submetido (snapshot do protesto)"
                        >
                          Submitted PDF
                        </a>
                      ) : (
                        <span className="text-gray-400">Submitted PDF —</span>
                      )}

                      {r.decision_pdf_url ? (
                        <a
                          href={r.decision_pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                          title="PDF da decisão"
                        >
                          Decision PDF
                        </a>
                      ) : (
                        <span className="text-gray-400">Decision PDF —</span>
                      )}
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
                          Editar
                        </button>
                        <button
                          className="text-red-600 hover:underline"
                          onClick={() => remove(r.id)}
                        >
                          Apagar
                        </button>
                      </div>
                    ) : (
                      <div className="inline-flex gap-3">
                        <button
                          className="text-blue-600 hover:underline"
                          onClick={() => saveEdit(r.id)}
                        >
                          Guardar
                        </button>
                        <button
                          className="text-gray-600 hover:underline"
                          onClick={() => {
                            setEditingId(null);
                            setPatch({});
                          }}
                        >
                          Cancelar
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
