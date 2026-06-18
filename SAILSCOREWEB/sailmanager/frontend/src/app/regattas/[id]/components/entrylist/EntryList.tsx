'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { getApiBaseUrl } from '@/lib/api';
import { getVisibleColumns } from '@/lib/entryListColumns';
import type { EntryListEntry } from '@/lib/entryListTypes';
import { EntryListCell } from '@/components/entry-list/EntryListCell';
import { useEntryListColumnLabel } from '@/lib/useEntryListColumnLabel';

interface EntryListProps {
  regattaId: number;
  selectedClass: string | null;
  entryListColumns?: string[] | null;
}

export default function EntryList({
  regattaId,
  selectedClass,
  entryListColumns,
}: EntryListProps) {
  const t = useTranslations('entryList');
  const columnLabel = useEntryListColumnLabel();
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

  const activeEntries = useMemo(
    () => filteredEntries.filter((e) => !e.waiting_list),
    [filteredEntries]
  );
  const waitingEntries = useMemo(
    () => filteredEntries.filter((e) => !!e.waiting_list),
    [filteredEntries]
  );

  useEffect(() => {
    let alive = true;

    async function loadPublic(): Promise<EntryListEntry[]> {
      const url = `${getApiBaseUrl()}/entries/by_regatta/${Number(regattaId)}?include_waiting=1`;
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

  const renderTable = (rows: EntryListEntry[]) => (
    <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-sm">
      <table className="w-full table-auto border-collapse text-sm text-slate-800">
        <thead className="bg-slate-50/95 text-left">
          <tr>
            {visibleColumnIds.map((id) => (
              <th
                key={id}
                className={`px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-600 border-b border-slate-200 ${
                  id === 'paid' || id === 'status' ? 'text-center' : 'text-left'
                }`}
              >
                {columnLabel(id)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((entry, idx) => (
            <tr
              key={entry.id}
              className={idx % 2 === 0 ? 'bg-white hover:bg-slate-50/80' : 'bg-slate-50/40 hover:bg-slate-100/60'}
            >
              {visibleColumnIds.map((colId) => (
                <td
                  key={colId}
                  className={`px-3 py-2.5 border-b border-slate-100 align-middle ${
                    colId === 'paid' || colId === 'status' ? 'text-center' : ''
                  }`}
                >
                  <EntryListCell entry={entry} columnId={colId} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
        <p className="text-sm text-gray-700">
          {t.rich('entriesCount', {
            count: activeEntries.length,
            b: (chunks) => <b>{chunks}</b>,
          })}
        </p>
        {waitingEntries.length > 0 && (
          <p className="text-sm text-gray-700">
            {t.rich('waitingListCount', {
              count: waitingEntries.length,
              b: (chunks) => <b>{chunks}</b>,
            })}
          </p>
        )}
      </div>
      {activeEntries.length === 0 && waitingEntries.length === 0 ? (
        <p className="text-gray-500">{t('noEntries')}</p>
      ) : (
        <div className="space-y-6">
          {activeEntries.length > 0 && renderTable(activeEntries)}
          {waitingEntries.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2">
                {t('waitingListTitle', { count: waitingEntries.length })}
              </h3>
              {renderTable(waitingEntries)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
