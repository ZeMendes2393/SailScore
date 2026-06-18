'use client';

import { useTranslations } from 'next-intl';
import { ONLINE_ENTRY_FIELDS } from '@/lib/onlineEntryFields';

/** Translated label for an online entry field (public form). */
export function useEntryFieldLabel() {
  const t = useTranslations('entryForm.fields');

  return (fieldId: string): string => {
    const fallback = ONLINE_ENTRY_FIELDS.find((f) => f.id === fieldId)?.label;
    if (t.has(fieldId)) return t(fieldId);
    return fallback ?? fieldId;
  };
}
