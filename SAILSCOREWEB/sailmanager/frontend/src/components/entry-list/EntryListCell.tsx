'use client';

import React from 'react';
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
}

/**
 * Renders one cell of the entry list table (Sail No, Boat Name, Crew, etc.).
 * Used by both public and admin entry lists.
 */
export function EntryListCell({ entry, columnId, className = '', onStatusChange, onPaidChange }: EntryListCellProps) {
  switch (columnId) {
    case 'sail_no':
      return (
        <span className={className}>
          <SailNumberDisplay countryCode={entry.boat_country_code} sailNumber={entry.sail_number} />
        </span>
      );
    case 'boat_name':
      return <span className={className}>{entry.boat_name?.trim() || '—'}</span>;
    case 'class':
      return <span className={className}>{entry.class_name?.trim() || '—'}</span>;
    case 'category':
      return <span className={className}>{entry.category?.trim() || '—'}</span>;
    case 'owner':
      return <span className={className}>{formatOwner(entry)}</span>;
    case 'crew': {
      const { skipper, crew } = formatCrewColumn(entry);
      const lines = [skipper !== '—' ? skipper : null, ...crew].filter(Boolean) as string[];
      return (
        <div className={`${className} flex flex-col gap-0.5`}>
          {lines.length > 0 ? lines.map((name, i) => <div key={i}>{name}</div>) : <span>—</span>}
        </div>
      );
    }
    case 'club':
      return <span className={className}>{entry.club?.trim() || '—'}</span>;
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
            className={`${className} border rounded px-2 py-1 text-sm bg-white`}
            aria-label="Paid"
          >
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
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
            className={`${className} border rounded px-2 py-1 text-sm bg-white`}
            aria-label="Status"
          >
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
          </select>
        );
      }
      return (
        <span className={className}>
          {confirmed ? (
            <span className="text-green-700">Confirmed</span>
          ) : (
            <span className="text-amber-700">Pending</span>
          )}
        </span>
      );
    }
    default:
      return <span className={className}>—</span>;
  }
}
