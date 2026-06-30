'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { SailNumberDisplay } from '@/components/ui/SailNumberDisplay';
import type { EntryListEntry } from '@/lib/entryListTypes';
import type { EntryListColumnId } from '@/lib/entryListColumns';
import { formatOwner, formatCrewColumn } from '@/lib/entryListTypes';

interface EntryListCellProps {
  entry: EntryListEntry;
  columnId: EntryListColumnId;
  className?: string;
  /** Quando definido, o admin pode alterar o status (Confirmed/Pending) nesta célula */
  onStatusChange?: (entryId: number, confirmed: boolean) => void;
  /** Quando definido, o admin pode alterar Paid/Unpaid nesta célula */
  onPaidChange?: (entryId: number, paid: boolean) => void;
  skipperOnly?: boolean;
}

/**
 * Renders one cell of the entry list table (Sail No, Boat Name, Crew, etc.).
 * Used by both public and admin entry lists.
 */
export function EntryListCell({ entry, columnId, className = '', onStatusChange, onPaidChange, skipperOnly = false }: EntryListCellProps) {
  const t = useTranslations('entryList');
  const tCommon = useTranslations('common');

  const formatDateTime = (iso?: string | null): string => {
    if (!iso) return tCommon('dash');
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return tCommon('dash');
    return d.toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  switch (columnId) {
    case 'sail_no':
      return (
        <span className={className}>
          <SailNumberDisplay countryCode={entry.boat_country_code} sailNumber={entry.sail_number} />
        </span>
      );
    case 'boat_name':
      return <span className={className}>{entry.boat_name?.trim() || tCommon('dash')}</span>;
    case 'class':
      return <span className={className}>{entry.class_name?.trim() || tCommon('dash')}</span>;
    case 'category':
      return <span className={className}>{entry.category?.trim() || tCommon('dash')}</span>;
    case 'owner':
      return <span className={className}>{formatOwner(entry)}</span>;
    case 'crew': {
      const { skipper, crew } = formatCrewColumn(entry);
      const lines = skipperOnly
        ? [skipper !== '—' ? skipper : null].filter(Boolean) as string[]
        : [skipper !== '—' ? skipper : null, ...crew].filter(Boolean) as string[];
      return (
        <div className={`${className} flex flex-col gap-0.5`}>
          {lines.length > 0 ? lines.map((name, i) => <div key={i}>{name}</div>) : <span>{tCommon('dash')}</span>}
        </div>
      );
    }
    case 'club':
      return <span className={className}>{entry.club?.trim() || tCommon('dash')}</span>;
    case 'created_at':
      return <span className={className}>{formatDateTime(entry.created_at)}</span>;
    case 'paid': {
      const paid = !!entry.paid;
      if (onPaidChange) {
        return (
          <select
            value={paid ? 'paid' : 'unpaid'}
            onChange={(e) => {
              e.stopPropagation();
              onPaidChange(entry.id, e.target.value === 'paid');
            }}
            onClick={(e) => e.stopPropagation()}
            className={`${className} border rounded-md px-3 py-1.5 text-base bg-white min-h-[2.25rem]`}
            aria-label={t('paid')}
          >
            <option value="unpaid">{t('unpaid')}</option>
            <option value="paid">{t('paid')}</option>
          </select>
        );
      }
      return (
        <span className={className}>
          {paid ? (
            <span className="text-green-700" aria-label="Pago">✓</span>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </span>
      );
    }
    case 'status': {
      const confirmed = !!entry.confirmed;
      if (onStatusChange) {
        return (
          <select
            value={confirmed ? 'confirmed' : 'pending'}
            onChange={(e) => {
              e.stopPropagation();
              onStatusChange(entry.id, e.target.value === 'confirmed');
            }}
            onClick={(e) => e.stopPropagation()}
            className={`${className} border rounded-md px-3 py-1.5 text-base bg-white min-h-[2.25rem]`}
            aria-label={t('status')}
          >
            <option value="pending">{t('pending')}</option>
            <option value="confirmed">{t('confirmed')}</option>
          </select>
        );
      }
      return (
        <span className={className}>
          {confirmed ? (
            <span className="text-green-700">{t('confirmed')}</span>
          ) : (
            <span className="text-amber-700">{t('pending')}</span>
          )}
        </span>
      );
    }
    case 'rating': {
      const e = entry;
      const fmt = (v: number | null | undefined) =>
        typeof v === 'number' && !Number.isNaN(v) ? String(v) : null;
      if (e.rating_type === 'orc') {
        const low = fmt(e.orc_low);
        const med = fmt(e.orc_medium);
        const high = fmt(e.orc_high);
        if (low || med || high) {
          return (
            <span className={className} title={t('ratingOrcTitle')}>
              {low && <span className="block text-sm">{t('ratingOrcLow', { value: low })}</span>}
              {med && <span className="block text-sm">{t('ratingOrcMedium', { value: med })}</span>}
              {high && <span className="block text-sm">{t('ratingOrcHigh', { value: high })}</span>}
            </span>
          );
        }
      }
      if (typeof entry.rating === 'number' && !Number.isNaN(entry.rating)) {
        return <span className={className}>{String(entry.rating)}</span>;
      }
      return <span className={className}>{tCommon('dash')}</span>;
    }
    default:
      return <span className={className}>{tCommon('dash')}</span>;
  }
}
