// EntryList.tsx — lista pública de inscrições (mesmas colunas definidas no admin)
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { BASE_URL } from '@/lib/api';
import { getVisibleColumns } from '@/lib/entryListColumns';
import type { EntryListEntry } from '@/lib/entryListTypes';
import { EntryListCell } from '@/components/entry-list/EntryListCell';
import { ENTRY_LIST_COLUMNS } from '@/lib/entryListColumns';

interface EntryListProps {
  regattaId: number;
  selectedClass: string | null;
  /** Colunas visíveis (definidas no admin); usa predefinição se null/undefined */
  entryListColumns?: string[] | null;
}

export default function EntryList({
  regattaId,
  selectedClass,
  entryListColumns,
}: EntryListProps) {
  const [entries, setEntries] = useState<EntryListEntry[]>([]);

  const visibleColumnIds = useMemo(
    () => getVisibleColumns(entryListColumns),
    [entryListColumns]
  );

  const filteredEntries = useMemo(() => {
    if (!selectedClass) return entries;
    const cls = selectedClass.trim().toLowerCase();
    return entries.filter((e) => (e.class_name || '').trim().toLowerCase() === cls);
  }, [entries, selectedClass]);

  useEffect(() => {
    let alive = true;

    async function loadPublic(): Promise<EntryListEntry[]> {
      const url = `${BASE_URL}/entries/by_regatta/${Number(regattaId)}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return [];
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      return arr as EntryListEntry[];
    }

    (async () => {
      try {
        const list = await loadPublic();
        if (alive) setEntries(Array.isArray(list) ? list : []);
      } catch (e) {
        console.error('❌ Erro a carregar inscrições:', e);
        if (alive) setEntries([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, [regattaId]);

  return (
    <div>
      {filteredEntries.length === 0 ? (
        <p className="text-gray-500">
          Ainda não há inscrições para esta classe nesta regata.
        </p>
      ) : (
        <table className="w-full table-auto border mt-2 text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              {visibleColumnIds.map((id) => {
                const def = ENTRY_LIST_COLUMNS.find((c) => c.id === id);
                return (
                  <th
                    key={id}
                    className={`p-2 border ${id === 'paid' || id === 'status' ? 'text-center' : ''}`}
                  >
                    {def?.label ?? id}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filteredEntries.map((entry) => (
              <React.Fragment key={entry.id}>
                <tr>
                  {visibleColumnIds.map((colId) => (
                    <td
                      key={colId}
                      className={`p-2 border ${colId === 'paid' || colId === 'status' ? 'text-center' : ''}`}
                    >
                      <EntryListCell entry={entry} columnId={colId} />
                    </td>
                  ))}
                </tr>
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
