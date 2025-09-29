"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";

type Row = {
  id: number;
  regatta_id: number;
  class_name: string;
  fleet: string | null;
  time_limit: string;        // ex: "60 min after", "18:00"
  posting_time: string | null; // ex: "17:15"
  date: string;              // YYYY-MM-DD
};

function safeDateToPt(dateStr?: string) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d.toLocaleDateString("pt-PT");
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const d2 = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (!isNaN(d2.getTime())) return d2.toLocaleDateString("pt-PT");
  }
  return "—";
}

export default function ProtestTimeLimit({ regattaId }: { regattaId: number }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // criação
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Omit<Row, "id" | "regatta_id">>({
    class_name: "",
    fleet: "",
    time_limit: "",
    posting_time: "",
    date: new Date().toISOString().slice(0, 10),
  } as any);

  // edição inline
  const [editingId, setEditingId] = useState<number | null>(null);
  const [edit, setEdit] = useState<Partial<Row>>({});

  async function fetchRows() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<Row[]>(`/ptl/${regattaId}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || "Erro ao carregar.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regattaId]);

  async function createRow() {
    if (!form.class_name.trim() || !form.time_limit.trim() || !form.date) {
      alert("Preenche Class, Time Limit e Date.");
      return;
    }
    setCreating(true);
    try {
      await apiPost<Row>("/ptl/", { ...form, regatta_id: regattaId });
      setForm({
        class_name: "",
        fleet: "",
        time_limit: "",
        posting_time: "",
        date: new Date().toISOString().slice(0, 10),
      } as any);
      fetchRows();
    } catch (e: any) {
      alert(e?.message || "Erro ao criar.");
    } finally {
      setCreating(false);
    }
  }

  async function deleteRow(id: number) {
    if (!confirm("Apagar este registo?")) return;
    try {
      await apiDelete(`/ptl/${id}`);
      fetchRows();
    } catch (e: any) {
      alert(e?.message || "Falha ao apagar.");
    }
  }

  async function saveEdit(id: number) {
    try {
      await apiPatch(`/ptl/${id}`, edit);
      setEditingId(null);
      setEdit({});
      fetchRows();
    } catch (e: any) {
      alert(e?.message || "Falha ao guardar.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Protest Time Limit</h2>
        <button
          type="button"
          onClick={fetchRows}
          className="text-sm px-3 py-1 border rounded hover:bg-gray-50"
        >
          Atualizar
        </button>
      </div>

      {/* Criar */}
      <div className="grid gap-3 bg-white border rounded p-4">
        <div className="grid md:grid-cols-5 gap-3">
          <input
            className="border rounded p-2"
            placeholder="Class"
            value={form.class_name}
            onChange={(e) => setForm({ ...form, class_name: e.target.value })}
          />
          <input
            className="border rounded p-2"
            placeholder="Fleet"
            value={form.fleet ?? ""}
            onChange={(e) => setForm({ ...form, fleet: e.target.value })}
          />
          <input
            className="border rounded p-2"
            placeholder="Time Limit (ex: 18:00 ou 60 min after)"
            value={form.time_limit}
            onChange={(e) => setForm({ ...form, time_limit: e.target.value })}
          />
          <input
            className="border rounded p-2"
            placeholder="Posting Time (ex: 17:15)"
            value={form.posting_time ?? ""}
            onChange={(e) => setForm({ ...form, posting_time: e.target.value })}
          />
          <input
            type="date"
            className="border rounded p-2"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value as any })}
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={createRow}
            disabled={creating}
            className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
            type="button"
          >
            {creating ? "A guardar…" : "Guardar"}
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded border"
            onClick={() =>
              setForm({
                class_name: "",
                fleet: "",
                time_limit: "",
                posting_time: "",
                date: new Date().toISOString().slice(0, 10),
              } as any)
            }
          >
            Limpar
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="overflow-x-auto rounded border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2">Class</th>
              <th className="p-2">Fleet</th>
              <th className="p-2">Time Limit</th>
              <th className="p-2">Posting Time</th>
              <th className="p-2">Date</th>
              <th className="p-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="p-3" colSpan={6}>A carregar…</td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td className="p-6 text-center text-gray-500" colSpan={6}>
                  Sem registos.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const isEd = editingId === r.id;
              return (
                <tr key={r.id} className="border-t align-top">
                  <td className="p-2">
                    {isEd ? (
                      <input className="border rounded p-1 w-40"
                        value={edit.class_name ?? r.class_name}
                        onChange={(e) => setEdit({ ...edit, class_name: e.target.value })}
                      />
                    ) : r.class_name}
                  </td>
                  <td className="p-2">
                    {isEd ? (
                      <input className="border rounded p-1 w-28"
                        value={edit.fleet ?? r.fleet ?? ""}
                        onChange={(e) => setEdit({ ...edit, fleet: e.target.value })}
                      />
                    ) : (r.fleet || "—")}
                  </td>
                  <td className="p-2">
                    {isEd ? (
                      <input className="border rounded p-1 w-40"
                        value={edit.time_limit ?? r.time_limit}
                        onChange={(e) => setEdit({ ...edit, time_limit: e.target.value })}
                      />
                    ) : r.time_limit}
                  </td>
                  <td className="p-2">
                    {isEd ? (
                      <input className="border rounded p-1 w-28"
                        value={edit.posting_time ?? r.posting_time ?? ""}
                        onChange={(e) => setEdit({ ...edit, posting_time: e.target.value })}
                      />
                    ) : (r.posting_time || "—")}
                  </td>
                  <td className="p-2">
                    {isEd ? (
                      <input type="date" className="border rounded p-1"
                        value={edit.date ?? r.date}
                        onChange={(e) => setEdit({ ...edit, date: e.target.value as any })}
                      />
                    ) : safeDateToPt(r.date)}
                  </td>
                  <td className="p-2 text-right">
                    {!isEd ? (
                      <div className="inline-flex gap-3">
                        <button className="text-blue-600 hover:underline"
                          onClick={() => { setEditingId(r.id); setEdit({}); }}>
                          Editar
                        </button>
                        <button className="text-red-600 hover:underline"
                          onClick={() => deleteRow(r.id)}>
                          Apagar
                        </button>
                      </div>
                    ) : (
                      <div className="inline-flex gap-3">
                        <button className="text-blue-600 hover:underline"
                          onClick={() => saveEdit(r.id)}>
                          Guardar
                        </button>
                        <button className="text-gray-600 hover:underline"
                          onClick={() => { setEditingId(null); setEdit({}); }}>
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
