// frontend/src/app/admin/manage-regattas/[id]/noticeboard/sections/Rule42.tsx
"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { SailNumberDisplay } from "@/components/ui/SailNumberDisplay";

type Row = {
  id: number;
  sail_num: string;
  boat_country_code?: string | null;
  penalty_number: string;
  race: string;
  group: string | null;
  rule: string;
  comp_action: string | null;   // "Competitor action"
  description: string | null;   // "Notes"
  class_name: string;
  date: string; // YYYY-MM-DD
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

export default function Rule42({ regattaId }: { regattaId: number }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // criação
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Omit<Row, "id">>({
    sail_num: "",
    penalty_number: "",
    race: "",
    group: "",
    rule: "RRS 42",
    comp_action: "",
    description: "",
    class_name: "",
    date: new Date().toISOString().slice(0, 10),
  });

  // edição inline
  const [editingId, setEditingId] = useState<number | null>(null);
  const [edit, setEdit] = useState<Partial<Row>>({});

  async function fetchRows() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<Row[]>(`/rule42/${regattaId}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load Rule 42 records.");
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
    if (
      !form.sail_num.trim() ||
      !form.penalty_number.trim() ||
      !form.race.trim() ||
      !form.class_name.trim()
    ) {
      alert("Please fill Sail Number, Penalty Number, Race and Class.");
      return;
    }
    setCreating(true);
    try {
      await apiPost<Row>("/rule42/", { ...form, regatta_id: regattaId });
      setForm((f) => ({
        ...f,
        sail_num: "",
        penalty_number: "",
        race: "",
        group: "",
        comp_action: "",
        description: "",
      }));
      fetchRows();
    } catch (e: any) {
      alert(e?.message || "Erro ao criar.");
    } finally {
      setCreating(false);
    }
  }

  async function deleteRow(id: number) {
    if (!confirm("Delete this Rule 42 record?")) return;
    try {
      await apiDelete(`/rule42/${id}`);
      fetchRows();
    } catch (e: any) {
      alert(e?.message || "Failed to delete.");
    }
  }

  async function saveEdit(id: number) {
    try {
      await apiPatch(`/rule42/${id}`, edit); // precisa de PATCH no backend
      setEditingId(null);
      setEdit({});
      fetchRows();
    } catch (e: any) {
      alert(e?.message || "Failed to save.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Rule 42</h2>
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
            placeholder="Sail Number"
            value={form.sail_num}
            onChange={(e) => setForm({ ...form, sail_num: e.target.value })}
          />
          <input
            className="border border-gray-300 rounded-md p-2 text-sm shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Penalty Number"
            value={form.penalty_number}
            onChange={(e) => setForm({ ...form, penalty_number: e.target.value })}
          />
          <input
            className="border border-gray-300 rounded-md p-2 text-sm shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Race"
            value={form.race}
            onChange={(e) => setForm({ ...form, race: e.target.value })}
          />
          <input
            className="border border-gray-300 rounded-md p-2 text-sm shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Group"
            value={form.group ?? ""}
            onChange={(e) => setForm({ ...form, group: e.target.value })}
          />
        </div>

        <div className="grid md:grid-cols-4 gap-3">
          <input
            className="border border-gray-300 rounded-md p-2 text-sm shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Rule (e.g. RRS 42)"
            value={form.rule}
            onChange={(e) => setForm({ ...form, rule: e.target.value })}
          />
          <input
            className="border border-gray-300 rounded-md p-2 text-sm shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Competitor action"
            value={form.comp_action ?? ""}
            onChange={(e) => setForm({ ...form, comp_action: e.target.value })}
          />
          <input
            className="border border-gray-300 rounded-md p-2 text-sm shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Class"
            value={form.class_name}
            onChange={(e) => setForm({ ...form, class_name: e.target.value })}
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
          placeholder="Notes"
          value={form.description ?? ""}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
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
                sail_num: "",
                penalty_number: "",
                race: "",
                group: "",
                rule: "RRS 42",
                comp_action: "",
                description: "",
                class_name: "",
                date: new Date().toISOString().slice(0, 10),
              })
            }
          >
            Clear
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="p-2 font-medium text-left">Sail Number</th>
              <th className="p-2 font-medium text-left">Penalty Number</th>
              <th className="p-2 font-medium text-left">Race</th>
              <th className="p-2 font-medium text-left">Group</th>
              <th className="p-2 font-medium text-left">Rule</th>
              <th className="p-2 font-medium text-left">Competitor action</th>
              <th className="p-2 font-medium text-left">Notes</th>
              <th className="p-2 font-medium text-left">Class</th>
              <th className="p-2 font-medium text-left">Date</th>
              <th className="p-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="p-3" colSpan={10}>
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td className="p-6 text-center text-gray-500" colSpan={10}>
                  No records.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const isEd = editingId === r.id;
              return (
                <tr key={r.id} className="border-t align-top hover:bg-gray-50">
                  <td className="p-2">
                    {isEd ? (
                      <input
                        className="border border-gray-300 rounded-md p-1 w-40 text-sm shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={edit.sail_num ?? r.sail_num}
                        onChange={(e) => setEdit({ ...edit, sail_num: e.target.value })}
                      />
                    ) : (
                      <SailNumberDisplay countryCode={r.boat_country_code} sailNumber={r.sail_num} />
                    )}
                  </td>
                  <td className="p-2">
                    {isEd ? (
                      <input
                        className="border border-gray-300 rounded-md p-1 w-28 text-sm shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={edit.penalty_number ?? r.penalty_number}
                        onChange={(e) =>
                          setEdit({ ...edit, penalty_number: e.target.value })
                        }
                      />
                    ) : (
                      r.penalty_number
                    )}
                  </td>
                  <td className="p-2">
                    {isEd ? (
                      <input
                        className="border border-gray-300 rounded-md p-1 w-20 text-sm shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={edit.race ?? r.race}
                        onChange={(e) => setEdit({ ...edit, race: e.target.value })}
                      />
                    ) : (
                      r.race
                    )}
                  </td>
                  <td className="p-2">
                    {isEd ? (
                      <input
                        className="border border-gray-300 rounded-md p-1 w-24 text-sm shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={edit.group ?? r.group ?? ""}
                        onChange={(e) => setEdit({ ...edit, group: e.target.value })}
                      />
                    ) : (
                      r.group || "—"
                    )}
                  </td>
                  <td className="p-2">
                    {isEd ? (
                      <input
                        className="border border-gray-300 rounded-md p-1 w-28 text-sm shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={edit.rule ?? r.rule}
                        onChange={(e) => setEdit({ ...edit, rule: e.target.value })}
                      />
                    ) : (
                      r.rule
                    )}
                  </td>
                  <td className="p-2">
                    {isEd ? (
                      <input
                        className="border border-gray-300 rounded-md p-1 w-40 text-sm shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={edit.comp_action ?? r.comp_action ?? ""}
                        onChange={(e) =>
                          setEdit({ ...edit, comp_action: e.target.value })
                        }
                      />
                    ) : (
                      r.comp_action || "—"
                    )}
                  </td>
                  <td className="p-2">
                    {isEd ? (
                      <textarea
                        className="border border-gray-300 rounded-md p-1 w-64 text-sm shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                        value={edit.description ?? r.description ?? ""}
                        onChange={(e) =>
                          setEdit({ ...edit, description: e.target.value })
                        }
                      />
                    ) : (
                      r.description || "—"
                    )}
                  </td>
                  <td className="p-2">
                    {isEd ? (
                      <input
                        className="border border-gray-300 rounded-md p-1 w-28 text-sm shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={edit.class_name ?? r.class_name}
                        onChange={(e) => setEdit({ ...edit, class_name: e.target.value })}
                      />
                    ) : (
                      r.class_name
                    )}
                  </td>
                  <td className="p-2">
                    {isEd ? (
                      <input
                        type="date"
                        className="border border-gray-300 rounded-md p-1 text-sm shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={edit.date ?? r.date}
                        onChange={(e) => setEdit({ ...edit, date: e.target.value })}
                      />
                    ) : (
                      safeDateToPt(r.date)
                    )}
                  </td>
                  <td className="p-2 text-right">
                    {!isEd ? (
                      <div className="inline-flex gap-2">
                        <button
                          className="px-2 py-1 rounded-md text-blue-600 hover:bg-blue-50 border border-blue-100"
                          onClick={() => {
                            setEditingId(r.id);
                            setEdit({});
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="px-2 py-1 rounded-md text-red-600 hover:bg-red-50 border border-red-100"
                          onClick={() => deleteRow(r.id)}
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <div className="inline-flex gap-2">
                        <button
                          className="px-2 py-1 rounded-md text-blue-600 hover:bg-blue-50 border border-blue-100"
                          onClick={() => saveEdit(r.id)}
                        >
                          Save
                        </button>
                        <button
                          className="px-2 py-1 rounded-md text-gray-600 hover:bg-gray-100 border border-gray-200"
                          onClick={() => {
                            setEditingId(null);
                            setEdit({});
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
