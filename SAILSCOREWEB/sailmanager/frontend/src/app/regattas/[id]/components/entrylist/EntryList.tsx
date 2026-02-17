// EntryList.tsx — lista pública de inscrições (mesmas colunas definidas no admin)
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
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
  const { user, token } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [entries, setEntries] = useState<EntryListEntry[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

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

  const togglePaid = async (entryId: number) => {
    if (!isAdmin || !token) return;
    try {
      const res = await fetch(`${BASE_URL}/entries/${entryId}/toggle_paid`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        console.error('❌ Erro ao atualizar pagamento:', errorData?.detail ?? res.status);
        return;
      }
      const data = await res.json();
      setEntries((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, paid: data.paid } : e))
      );
    } catch (error) {
      console.error('⚠️ Erro na requisição:', error);
    }
  };

  const toggleDetails = (id: number) => {
    if (!isAdmin) return;
    setSelectedId((prev) => (prev === id ? null : id));
  };

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
                <tr
                  onClick={() => toggleDetails(entry.id)}
                  className={isAdmin ? 'cursor-pointer hover:bg-gray-50' : ''}
                >
                  {visibleColumnIds.map((colId) => (
                    <td
                      key={colId}
                      className={`p-2 border ${colId === 'paid' || colId === 'status' ? 'text-center' : ''}`}
                    >
                      {colId === 'paid' && isAdmin ? (
                        <input
                          type="checkbox"
                          checked={Boolean(entry.paid)}
                          onChange={() => togglePaid(entry.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <EntryListCell entry={entry} columnId={colId} />
                      )}
                    </td>
                  ))}
                </tr>
                {isAdmin && selectedId === entry.id && (
                  <tr>
                    <td
                      colSpan={visibleColumnIds.length}
                      className="p-2 border bg-gray-50 text-gray-700"
                    >
                      <div className="space-y-1 text-sm">
                        <p>
                          <strong>Email:</strong> {entry.email || '—'}
                        </p>
                        <p>
                          <strong>Contacto:</strong> {entry.contact_phone_1 || '—'}
                        </p>
                        <p>
                          <strong>Nome do barco:</strong> {entry.boat_name || '—'}
                        </p>
                        <p>
                          <strong>Categoria:</strong> {entry.category || '—'}
                        </p>
                        <a
                          className="text-blue-600 underline"
                          href={`/admin/manage-regattas/${regattaId}/entries/${entry.id}?regattaId=${regattaId}`}
                        >
                          Abrir na área admin
                        </a>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
