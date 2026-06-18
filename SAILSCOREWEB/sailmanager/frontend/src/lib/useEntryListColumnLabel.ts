'use client';

import { useTranslations } from 'next-intl';
import type { EntryListColumnId } from '@/lib/entryListColumns';
import { ENTRY_LIST_COLUMNS } from '@/lib/entryListColumns';

export function useEntryListColumnLabel() {
  const t = useTranslations('entryList.columns');

  return (columnId: EntryListColumnId | string): string => {
    const fallback = ENTRY_LIST_COLUMNS.find((c) => c.id === columnId)?.label;
    if (t.has(columnId)) return t(columnId);
    return fallback ?? columnId;
  };
}
