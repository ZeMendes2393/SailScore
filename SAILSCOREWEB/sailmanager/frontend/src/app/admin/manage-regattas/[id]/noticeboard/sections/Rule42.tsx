// frontend/src/app/admin/manage-regattas/[id]/noticeboard/sections/Rule42.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";

type Row = {
  id: number;
  sail_num: string;
  penalty_number: string;
  race: string;
  group: string | null;
  rule: string;
  comp_action: string | null;   // "Competitor action"
  description: string | null;   // "Notes"
  class_name: string;
  date: string; // YYYY-MM-DD
};

type Filters = {
  class_name?: string;
  sail_num?: string;
  race?: string;
  group?: string;
};

export default function Rule42({ regattaId }: { regattaId: number }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<Filters>({});

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

  const listPath = useMemo(() => {
    const p = new URLSearchParams();
    if (filters.class_name) p.set("class_name", filters.class_name);
    if (filters.sail_num) p.set("sail_num", filters.sail_num);
    if (filters.race) p.set("race", filters.race);
    if (filters.group) p.set("group", filters.group);
    return `/rule42/${regattaId}${p.toString() ? `?${p.toString()}` : ""}`;
  }, [regattaId, filters]);

  async function fetchRows() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<Row[]>(listPath);
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
  }, [listPath]);

  async function createRow() {
    if (!form.sail_num.trim() || !form.penalty_number.trim() || !form.race.trim() || !form.class_name.trim()) {
      alert("Preenche Sail Number, Penalty Number, Race e Class.");
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
    if (!confirm("Apagar este registo Rule 42?")) return;
    try {
      await apiDelete(`/rule42/${id}`);
      fetchRows();
    } catch (e: any) {
      alert(e?.message || "Falha ao apagar.");
    }
  }

  async function saveEdit(id: number) {
    // Se o backend ainda não tiver PATCH /rule42/{id},
    // este call vai falhar. Depois podemos fazer fallback (criar+apagar).
    try {
      await apiPatch(`/rule42/${id}`, edit);
      setEditingId(null);
      setEdit({});
      fetchRows();
    } catch (e: any) {
      alert(e?.message || "Falha ao guardar.");
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Rule 42</h2>

      {/* Filtros */}
      <div className="grid gap-3 md:grid-cols-5 bg-white border rounded p-3">
        <input className="border rounded p-2" placeholder="Class"
          value={filters.class_name || ""}
          onChange={(e)=>setFilters({...filters, class_name: e.target.value || undefined})}/>
        <input className="border rounded p-2" placeholder="Sail Number"
          value={filters.sail_num || ""}
          onChange={(e)=>setFilters({...filters, sail_num: e.target.value || undefined})}/>
        <input className="border rounded p-2" placeholder="Race"
          value={filters.race || ""}
          onChange={(e)=>setFilters({...filters, race: e.target.value || undefined})}/>
        <input className="border rounded p-2" placeholder="Group"
          value={filters.group || ""}
          onChange={(e)=>setFilters({...filters, group: e.target.value || undefined})}/>
        <button type="button" className="border rounded p-2 hover:bg-gray-50" onClick={()=>setFilters({})}>
          Limpar filtros
        </button>
      </div>

      {/* Criar */}
      <div className="grid gap-3 bg-white border rounded p-4">
        <div className="grid md:grid-cols-4 gap-3">
          <input className="border rounded p-2" placeholder="Sail Number"
            value={form.sail_num} onChange={e=>setForm({...form, sail_num: e.target.value})}/>
          <input className="border rounded p-2" placeholder="Penalty Number"
            value={form.penalty_number} onChange={e=>setForm({...form, penalty_number: e.target.value})}/>
          <input className="border rounded p-2" placeholder="Race"
            value={form.race} onChange={e=>setForm({...form, race: e.target.value})}/>
          <input className="border rounded p-2" placeholder="Group"
            value={form.group ?? ""} onChange={e=>setForm({...form, group: e.target.value})}/>
        </div>

        <div className="grid md:grid-cols-4 gap-3">
          <input className="border rounded p-2" placeholder="Rule (ex.: RRS 42)"
            value={form.rule} onChange={e=>setForm({...form, rule: e.target.value})}/>
          <input className="border rounded p-2" placeholder="Competitor action"
            value={form.comp_action ?? ""} onChange={e=>setForm({...form, comp_action: e.target.value})}/>
          <input className="border rounded p-2" placeholder="Class"
            value={form.class_name} onChange={e=>setForm({...form, class_name: e.target.value})}/>
          <input type="date" className="border rounded p-2"
            value={form.date} onChange={e=>setForm({...form, date: e.target.value})}/>
        </div>

        <textarea className="border rounded p-2" rows={3} placeholder="Notes"
          value={form.description ?? ""} onChange={e=>setForm({...form, description: e.target.value})} />

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
            Limpar
          </button>
        </div>
      </div>

      {/* Lista */}
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
              <th className="p-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td className="p-3" colSpan={10}>A carregar…</td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td className="p-6 text-center text-gray-500" colSpan={10}>Sem registos.</td></tr>
            )}
            {rows.map((r) => {
              const isEd = editingId === r.id;
              return (
                <tr key={r.id} className="border-t align-top">
                  <td className="p-2">
                    {isEd ? (
                      <input className="border rounded p-1 w-40"
                        value={edit.sail_num ?? r.sail_num}
                        onChange={(e)=>setEdit({...edit, sail_num: e.target.value})}/>
                    ) : r.sail_num}
                  </td>
                  <td className="p-2">
                    {isEd ? (
                      <input className="border rounded p-1 w-28"
                        value={edit.penalty_number ?? r.penalty_number}
                        onChange={(e)=>setEdit({...edit, penalty_number: e.target.value})}/>
                    ) : r.penalty_number}
                  </td>
                  <td className="p-2">
                    {isEd ? (
                      <input className="border rounded p-1 w-20"
                        value={edit.race ?? r.race}
                        onChange={(e)=>setEdit({...edit, race: e.target.value})}/>
                    ) : r.race}
                  </td>
                  <td className="p-2">
                    {isEd ? (
                      <input className="border rounded p-1 w-24"
                        value={edit.group ?? r.group ?? ""}
                        onChange={(e)=>setEdit({...edit, group: e.target.value})}/>
                    ) : (r.group || "—")}
                  </td>
                  <td className="p-2">
                    {isEd ? (
                      <input className="border rounded p-1 w-28"
                        value={edit.rule ?? r.rule}
                        onChange={(e)=>setEdit({...edit, rule: e.target.value})}/>
                    ) : r.rule}
                  </td>
                  <td className="p-2">
                    {isEd ? (
                      <input className="border rounded p-1 w-40"
                        value={edit.comp_action ?? r.comp_action ?? ""}
                        onChange={(e)=>setEdit({...edit, comp_action: e.target.value})}/>
                    ) : (r.comp_action || "—")}
                  </td>
                  <td className="p-2">
                    {isEd ? (
                      <textarea className="border rounded p-1 w-64"
                        value={edit.description ?? r.description ?? ""}
                        onChange={(e)=>setEdit({...edit, description: e.target.value})}/>
                    ) : (r.description || "—")}
                  </td>
                  <td className="p-2">
                    {isEd ? (
                      <input className="border rounded p-1 w-28"
                        value={edit.class_name ?? r.class_name}
                        onChange={(e)=>setEdit({...edit, class_name: e.target.value})}/>
                    ) : r.class_name}
                  </td>
                  <td className="p-2">
                    {isEd ? (
                      <input type="date" className="border rounded p-1"
                        value={edit.date ?? r.date}
                        onChange={(e)=>setEdit({...edit, date: e.target.value})}/>
                    ) : new Date(r.date).toLocaleDateString("pt-PT")}
                  </td>
                  <td className="p-2 text-right">
                    {!isEd ? (
                      <div className="inline-flex gap-3">
                        <button className="text-blue-600 hover:underline" onClick={() => { setEditingId(r.id); setEdit({}); }}>
                          Editar
                        </button>
                        <button className="text-red-600 hover:underline" onClick={() => deleteRow(r.id)}>
                          Apagar
                        </button>
                      </div>
                    ) : (
                      <div className="inline-flex gap-3">
                        <button className="text-blue-600 hover:underline" onClick={() => saveEdit(r.id)}>
                          Guardar
                        </button>
                        <button className="text-gray-600 hover:underline" onClick={() => { setEditingId(null); setEdit({}); }}>
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
