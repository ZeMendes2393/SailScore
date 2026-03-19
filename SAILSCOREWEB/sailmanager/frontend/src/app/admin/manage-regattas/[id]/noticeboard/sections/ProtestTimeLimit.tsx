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
  if (!m) throw new Error("Time limit must be HH:MM");
  const h = parseInt(m[1], 10);
  const mi = parseInt(m[2], 10);
  if (Number.isNaN(h) || Number.isNaN(mi) || mi < 0 || mi > 59 || h < 0) {
    throw new Error("Invalid time limit (minutes must be 00–59).");
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
      setError(e?.message || "Failed to load records.");
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
        alert("Please fill Class and Date.");
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
      alert(e?.message || "Failed to create.");
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
          className="inline-flex items-center gap-2 text-sm px-3 py-1.5 border border-gray-200 rounded-md bg-white hover:bg-gray-50 shadow-sm"
        >
          Update
        </button>
      </div>

      {/* Criar */}
      <div className="grid gap-3 bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <div className="grid md:grid-cols-4 gap-3">
          <input
            className="border border-gray-300 rounded-md p-2 text-sm shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Class"
            value={form.class_name}
            onChange={(e) => setForm({ ...form, class_name: e.target.value })}
          />
          <input
            className="border border-gray-300 rounded-md p-2 text-sm shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Fleet (optional)"
            value={form.fleet}
            onChange={(e) => setForm({ ...form, fleet: e.target.value })}
          />
          <input
            type="time"
            min="00:00"
            max="23:59"
            step={60} // 1 min
            className="border border-gray-300 rounded-md p-2 font-mono text-sm shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={form.time_limit_hm}
            onChange={(e) => setForm({ ...form, time_limit_hm: e.target.value })}
          />
          <input
            type="date"
            className="border border-gray-300 rounded-md p-2 text-sm shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </div>

        <textarea
          className="border border-gray-300 rounded-md p-2 text-sm shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          rows={3}
          placeholder="Notes (optional)"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={createRow}
            disabled={creating}
            className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:bg-blue-700"
            type="button"
          >
            {creating ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-md border border-gray-200 bg-gray-50 text-sm text-gray-700 hover:bg-gray-100 shadow-sm"
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
            Clear
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-[28%]" />
            <col className="w-[18%]" />
            <col className="w-[22%]" />
            <col className="w-[20%]" />
            <col className="w-[12%]" />
          </colgroup>

          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Class</th>
              <th className="px-3 py-2 text-left font-medium">Fleet</th>
              <th className="px-3 py-2 text-left font-medium">Time Limit (HH:MM)</th>
              <th className="px-3 py-2 text-left font-medium">Date</th>
              <th className="px-3 py-2 text-left font-medium">Notes</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td className="px-3 py-2" colSpan={5}>
                  Loading…
                </td>
              </tr>
            )}

            {!loading && rows.length === 0 && (
              <tr>
                <td className="px-3 py-2 text-center text-gray-500" colSpan={5}>
                  No records.
                </td>
              </tr>
            )}

            {rows.map((r) => (
              <tr key={r.id} className="border-t hover:bg-gray-50 transition-colors">
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
