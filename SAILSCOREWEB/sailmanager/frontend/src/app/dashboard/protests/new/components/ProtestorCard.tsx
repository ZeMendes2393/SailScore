// ProtestorCard.tsx
'use client';

import { formatSailNumber } from '@/utils/countries';
import { SailNumberDisplay } from '@/components/ui/SailNumberDisplay';
import { useDashboardOrgOptional } from '@/context/DashboardOrgContext';

type EntryOption = {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  class_name?: string | null;
  sail_number?: string | null;
  boat_country_code?: string | null;
  boat_name?: string | null;
  email?: string | null;
};

interface Props {
  loadingEntries: boolean;
  myEntries: EntryOption[];
  initiatorEntryId: number | undefined;
  setInitiatorEntryId: (id: number | undefined) => void;
  selectedInitiator?: EntryOption;
  initiatorRep: string;
  setInitiatorRep: (v: string) => void;
  /** Jury / admin: all entries; “Filed by” is editable (who submits on behalf of the boat). */
  staffMode?: boolean;
}

function entryFullName(en?: EntryOption): string {
  if (!en) return '';
  const full = `${en.first_name || ''} ${en.last_name || ''}`.trim();
  return full || en.email || en.boat_name || en.sail_number || '';
}

export default function ProtestorCard({
  loadingEntries,
  myEntries,
  initiatorEntryId,
  setInitiatorEntryId,
  selectedInitiator,
  initiatorRep,
  setInitiatorRep,
  staffMode = false,
}: Props) {
  const dashOrg = useDashboardOrgOptional();
  const entryDataHref = dashOrg
    ? dashOrg.withOrg('/dashboard/entry-data')
    : '/dashboard/entry-data';
  const showInitiatorSelect = myEntries.length > 1;

  return (
    <div className="space-y-3">
      {loadingEntries && (
        <div className="text-sm text-gray-500">Loading entries…</div>
      )}

      {!loadingEntries && myEntries.length === 0 && (
        <div className="p-3 rounded border bg-amber-50 text-amber-900 text-sm">
          {staffMode ? (
            <>There are no entries in this regatta. A protest needs an initiating boat (entry).</>
          ) : (
            <>
              We couldn&apos;t find an entry for you in this regatta.
              <br />
              Check{' '}
              <a href={entryDataHref} className="underline">
                Entry data
              </a>{' '}
              or ask the organisation to link your entry to your account.
            </>
          )}
        </div>
      )}

      {showInitiatorSelect && (
        <div className="mb-2">
          <label className="block text-sm mb-1">
            {staffMode ? 'Protesting boat (entry)' : 'Select your boat'}
          </label>
          <select
            className="w-full border rounded px-3 py-2"
            value={initiatorEntryId ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              setInitiatorEntryId(v ? Number(v) : undefined);
            }}
          >
            <option value="" disabled>
              Select…
            </option>
            {myEntries.map((en) => (
              <option key={en.id} value={en.id}>
                {formatSailNumber(en.boat_country_code, en.sail_number)} · {en.boat_name || '—'} · {en.class_name || '—'}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-gray-50 rounded p-3 border">
        <div>
          <div className="text-xs text-gray-500">Name</div>
          <div className="font-medium">{entryFullName(selectedInitiator) || '—'}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Position</div>
          <div className="font-medium">Skipper</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Class</div>
          <div className="font-medium">{selectedInitiator?.class_name || '—'}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Sail no.</div>
          <div className="font-medium"><SailNumberDisplay countryCode={selectedInitiator?.boat_country_code} sailNumber={selectedInitiator?.sail_number} /></div>
        </div>
      </div>

      <div>
        <label className="block text-sm mb-1">
          {staffMode
            ? 'Filed by (who submits the protest — e.g. Race Office, Jury, your name)'
            : 'Represented by'}
        </label>
        <input
          className="w-full border rounded px-3 py-2"
          value={initiatorRep}
          onChange={(e) => setInitiatorRep(e.target.value)}
          placeholder={
            staffMode
              ? 'e.g. Race Office, Jane Smith (Jury), or your name'
              : undefined
          }
        />
      </div>
    </div>
  );
}
