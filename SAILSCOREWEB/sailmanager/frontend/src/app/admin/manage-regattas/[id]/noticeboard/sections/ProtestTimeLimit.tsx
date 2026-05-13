"use client";

import { useEffect, useMemo, useState } from "react";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import notify from "@/lib/notify";
import { useConfirm } from "@/components/ConfirmDialog";

type Row = {
  id: number;
  regatta_id: number;
  class_name: string;
  fleet: string | null;
  date: string;               // "YYYY-MM-DD"
  time_limit_hm: string;      // "HH:MM"
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

function formatDateDMY(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso?.trim() || "");
  if (!m) return iso;
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (!Number.isFinite(dt.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(dt);
}

export default function ProtestTimeLimits({ regattaId }: { regattaId: number }) {
  const confirm = useConfirm();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("ALL");
  const [form, setForm] = useState<{
    class_name: string;
    fleet: string;
    date: string;          // "YYYY-MM-DD"
    time_limit_hm: string; // "HH:MM"
  }>({
    class_name: "",
    fleet: "",
    date: new Date().toISOString().slice(0, 10),
    time_limit_hm: "01:00",
  });

  const dateOptions = useMemo(() => {
    const uniq = Array.from(new Set(rows.map((r) => r.date).filter(Boolean)));
    return uniq.sort((a, b) => b.localeCompare(a));
  }, [rows]);

  const visibleRows = useMemo(() => {
    if (selectedDate === "ALL") return rows;
    return rows.filter((r) => r.date === selectedDate);
  }, [rows, selectedDate]);

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
        notify.warning("Please fill Class and Date.");
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
      });

      setForm({
        class_name: "",
        fleet: "",
        date: new Date().toISOString().slice(0, 10),
        time_limit_hm: "01:00",
      });
      notify.success("Protest time limit created.");
      fetchRows();
    } catch (e: any) {
      notify.error(e?.message || "Failed to create protest time limit.");
    } finally {
      setCreating(false);
    }
  }

  async function removeRow(rowId: number) {
    const ok = await confirm({
      title: "Delete this protest time limit?",
      description: "The protest time limit will be permanently removed.",
      tone: "danger",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      setDeletingId(rowId);
      await apiDelete(`/ptl/${rowId}`);
      notify.success("Protest time limit deleted.");
      await fetchRows();
    } catch (e: any) {
      notify.error(e?.message || "Failed to delete protest time limit.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Protest Time Limit</h2>
        <select
          className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          title="Filter by hearing date"
        >
          <option value="ALL">ALL</option>
          {dateOptions.map((d) => (
            <option key={d} value={d}>
              {formatDateDMY(d)}
            </option>
          ))}
        </select>
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
            lang="en-GB"
            className="border border-gray-300 rounded-md p-2 text-sm shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </div>

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
              <th className="px-3 py-2 text-left font-medium">Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td className="px-3 py-2" colSpan={6}>
                  Loading…
                </td>
              </tr>
            )}

            {!loading && visibleRows.length === 0 && (
              <tr>
                <td className="px-3 py-2 text-center text-gray-500" colSpan={6}>
                  No records.
                </td>
              </tr>
            )}

            {visibleRows.map((r) => (
              <tr key={r.id} className="border-t hover:bg-gray-50 transition-colors">
                <td className="px-3 py-2 text-left">{r.class_name}</td>
                <td className="px-3 py-2 text-left">{r.fleet || "—"}</td>
                <td className="px-3 py-2 text-left font-mono">{r.time_limit_hm}</td>
                <td className="px-3 py-2 text-left">{formatDateDMY(r.date)}</td>
                <td className="px-3 py-2 text-left">
                  <button
                    type="button"
                    className="text-red-600 hover:underline disabled:opacity-50"
                    onClick={() => removeRow(r.id)}
                    disabled={deletingId === r.id}
                  >
                    {deletingId === r.id ? "Deleting…" : "Delete"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <div className="text-red-600">{error}</div>}
    </div>
  );
}
