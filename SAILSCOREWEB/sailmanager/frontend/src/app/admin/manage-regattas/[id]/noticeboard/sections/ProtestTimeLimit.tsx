"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";

type Row = {
  id: number;
  regatta_id: number;
  class_name: string;
  fleet: string | null;
  date: string;               // "YYYY-MM-DD"
  time_limit_hm: string;      // "HH:MM"
  notes: string | null;
};

// Validação "HH:MM"
function normalizeHHMM(v: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v?.trim() || "");
  if (!m) throw new Error("Time limit deve ser HH:MM");
  const h = parseInt(m[1], 10);
  const mi = parseInt(m[2], 10);
  if (Number.isNaN(h) || Number.isNaN(mi) || mi < 0 || mi > 59 || h < 0) {
    throw new Error("Time limit inválido (minutos 00–59).");
  }
  return `${h.toString().padStart(2, "0")}:${mi.toString().padStart(2, "0")}`;
}

export default function ProtestTimeLimits({ regattaId }: { regattaId: number }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<{
    class_name: string;
    fleet: string;
    date: string;          // "YYYY-MM-DD"
    time_limit_hm: string; // "HH:MM"
    notes: string;
  }>({
    class_name: "",
    fleet: "",
    date: new Date().toISOString().slice(0, 10),
    time_limit_hm: "01:00",
    notes: "",
  });

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
    try {
      if (!form.class_name.trim() || !form.date) {
        alert("Preenche Class e Date.");
        return;
      }
      const hhmm = normalizeHHMM(form.time_limit_hm);

      setCreating(true);
      await apiPost<Row>("/ptl/", {
        regatta_id: regattaId,
        class_name: form.class_name.trim(),
        fleet: form.fleet?.trim() || null,
        date: form.date,
        time_limit_hm: hhmm,
        notes: form.notes?.trim() || null,
      });

      setForm({
        class_name: "",
        fleet: "",
        date: new Date().toISOString().slice(0, 10),
        time_limit_hm: "01:00",
        notes: "",
      });
      fetchRows();
    } catch (e: any) {
      alert(e?.message || "Erro ao criar.");
    } finally {
      setCreating(false);
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
        <div className="grid md:grid-cols-4 gap-3">
          <input
            className="border rounded p-2"
            placeholder="Class"
            value={form.class_name}
            onChange={(e) => setForm({ ...form, class_name: e.target.value })}
          />
          <input
            className="border rounded p-2"
            placeholder="Fleet (opcional)"
            value={form.fleet}
            onChange={(e) => setForm({ ...form, fleet: e.target.value })}
          />
          <input
            type="time"
            min="00:00"
            max="23:59"
            step={60} // 1 min
            className="border rounded p-2 font-mono"
            value={form.time_limit_hm}
            onChange={(e) => setForm({ ...form, time_limit_hm: e.target.value })}
          />
          <input
            type="date"
            className="border rounded p-2"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </div>

        <textarea
          className="border rounded p-2"
          rows={3}
          placeholder="Notes (opcional)"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />

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
                date: new Date().toISOString().slice(0, 10),
                time_limit_hm: "01:00",
                notes: "",
              })
            }
          >
            Limpar
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="overflow-x-auto rounded border bg-white">
        <table className="min-w-full table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-[28%]" />
            <col className="w-[18%]" />
            <col className="w-[22%]" />
            <col className="w-[20%]" />
            <col className="w-[12%]" />
          </colgroup>

          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2 text-left">Class</th>
              <th className="px-3 py-2 text-left">Fleet</th>
              <th className="px-3 py-2 text-left">Time Limit (HH:MM)</th>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Notes</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td className="px-3 py-2" colSpan={5}>
                  A carregar…
                </td>
              </tr>
            )}

            {!loading && rows.length === 0 && (
              <tr>
                <td className="px-3 py-2 text-center text-gray-500" colSpan={5}>
                  Sem registos.
                </td>
              </tr>
            )}

            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2 text-left">{r.class_name}</td>
                <td className="px-3 py-2 text-left">{r.fleet || "—"}</td>
                <td className="px-3 py-2 text-left font-mono">{r.time_limit_hm}</td>
                <td className="px-3 py-2 text-left">{r.date}</td>
                <td className="px-3 py-2 text-left">{r.notes || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <div className="text-red-600">{error}</div>}
    </div>
  );
}
