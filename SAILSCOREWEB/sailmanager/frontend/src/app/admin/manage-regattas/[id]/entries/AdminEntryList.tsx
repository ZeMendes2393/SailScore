'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiGet, apiSend } from '@/lib/api';
import {
  ENTRY_LIST_COLUMNS,
  getVisibleColumns,
  type EntryListColumnId,
} from '@/lib/entryListColumns';
import type { EntryListEntry } from '@/lib/entryListTypes';
import { EntryListCell } from '@/components/entry-list/EntryListCell';

interface RegattaForEntryList {
  id: number;
  entry_list_columns?: string[] | null;
}

interface AdminEntryListProps {
  regattaId: number;
  selectedClass: string | null;
  regatta: RegattaForEntryList | null;
  onRegattaUpdate: (r: RegattaForEntryList) => void;
}

export default function AdminEntryList({
  regattaId,
  selectedClass,
  regatta,
  onRegattaUpdate,
}: AdminEntryListProps) {
  const router = useRouter();
  const { user, token, loading: authLoading } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [entries, setEntries] = useState<EntryListEntry[]>([]);
  const [savingColumns, setSavingColumns] = useState(false);

  const visibleColumnIds = useMemo(
    () => getVisibleColumns(regatta?.entry_list_columns),
    [regatta?.entry_list_columns]
  );

  const filteredEntries = useMemo(() => {
    if (!selectedClass) return entries;
    const cls = selectedClass.trim().toLowerCase();
    return entries.filter((e) => (e.class_name || '').trim().toLowerCase() === cls);
  }, [entries, selectedClass]);

  useEffect(() => {
    if (authLoading) return;
    let alive = true;

    async function tryLoad(): Promise<EntryListEntry[]> {
      const paths = [
        `/entries?regatta_id=${Number(regattaId)}`,
        `/entries?regattaId=${Number(regattaId)}`,
        `/entries?regatta=${Number(regattaId)}`,
      ];
      for (const p of paths) {
        try {
          const data: any = await apiGet<any>(p, token || undefined);
          const arr = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
          if (arr.length || Array.isArray(data)) return arr as EntryListEntry[];
        } catch {}
      }
      return [];
    }

    (async () => {
      try {
        const list = await tryLoad();
        if (!alive) return;
        setEntries(Array.isArray(list) ? list : []);
      } catch {
        if (alive) setEntries([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, [regattaId, token, authLoading]);

  const toggleColumn = async (columnId: EntryListColumnId) => {
    const current = getVisibleColumns(regatta?.entry_list_columns);
    const next = current.includes(columnId)
      ? current.filter((id) => id !== columnId)
      : [...current, columnId].sort(
          (a, b) =>
            ENTRY_LIST_COLUMNS.findIndex((c) => c.id === a) -
            ENTRY_LIST_COLUMNS.findIndex((c) => c.id === b)
        );
    if (!token || !regatta) return;
    setSavingColumns(true);
    try {
      const patched = await apiSend<RegattaForEntryList>(
        `/regattas/${regattaId}`,
        'PATCH',
        { entry_list_columns: next },
        token
      );
      if (patched) onRegattaUpdate(patched);
    } catch (e: any) {
      alert(e?.message || 'Erro ao guardar colunas.');
    } finally {
      setSavingColumns(false);
    }
  };

  const rowColors = (e: EntryListEntry) => {
    const paid = !!e.paid;
    const confirmed = !!e.confirmed;
    if (paid && confirmed) {
      return { base: 'bg-green-200 text-gray-900', hover: 'group-hover:bg-green-300' };
    }
    if (!paid && !confirmed) {
      return { base: 'bg-red-200 text-gray-900', hover: 'group-hover:bg-red-300' };
    }
    return { base: 'bg-yellow-200 text-gray-900', hover: 'group-hover:bg-yellow-300' };
  };

  const goToEdit = (entryId: number) => {
    router.push(`/admin/manage-regattas/${regattaId}/entries/${entryId}?regattaId=${regattaId}`);
  };

  const handleStatusChange = async (entryId: number, confirmed: boolean) => {
    if (!token) return;
    try {
      await apiSend(`/entries/${entryId}`, 'PATCH', { confirmed }, token);
      setEntries((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, confirmed } : e))
      );
    } catch (e: any) {
      alert(e?.message || 'Erro ao atualizar status.');
    }
  };

  const handlePaidChange = async (entryId: number, paid: boolean) => {
    if (!token) return;
    try {
      await apiSend(`/entries/${entryId}`, 'PATCH', { paid }, token);
      setEntries((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, paid } : e))
      );
    } catch (e: any) {
      alert(e?.message || 'Erro ao atualizar pagamento.');
    }
  };

  if (!isAdmin) return <p className="text-gray-500">Admin only.</p>;

  return (
    <div className="space-y-4">
      {/* Seletor de colunas: definido aqui e usado na lista pública */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 rounded border">
        <span className="text-sm font-medium text-gray-700">Colunas visíveis (lista pública e aqui):</span>
        {ENTRY_LIST_COLUMNS.map((col) => (
          <label key={col.id} className="inline-flex items-center gap-1.5 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={visibleColumnIds.includes(col.id)}
              onChange={() => toggleColumn(col.id)}
              disabled={savingColumns}
              className="rounded border-gray-300"
            />
            {col.label}
          </label>
        ))}
        {savingColumns && <span className="text-xs text-gray-500">A guardar…</span>}
      </div>

      {filteredEntries.length === 0 ? (
        <p className="text-gray-500">Ainda não há inscrições para esta classe nesta regata.</p>
      ) : (
        <table className="w-full table-auto border border-black text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              {visibleColumnIds.map((id) => {
                const def = ENTRY_LIST_COLUMNS.find((c) => c.id === id);
                return (
                  <th
                    key={id}
                    className={`p-2 border border-black ${id === 'paid' || id === 'status' ? 'text-center' : ''}`}
                  >
                    {def?.label ?? id}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filteredEntries.map((entry) => {
              const c = rowColors(entry);
              const cell = `p-2 border border-black ${c.base} ${c.hover} transition-colors`;
              return (
                <tr
                  key={entry.id}
                  onClick={() => goToEdit(entry.id)}
                  className="group cursor-pointer"
                >
                  {visibleColumnIds.map((colId) => (
                    <td
                      key={colId}
                      className={`${cell} ${colId === 'paid' || colId === 'status' ? 'text-center' : ''}`}
                    >
                      <EntryListCell
                        entry={entry}
                        columnId={colId}
                        onStatusChange={colId === 'status' ? handleStatusChange : undefined}
                        onPaidChange={colId === 'paid' ? handlePaidChange : undefined}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
