import type { EntryListColumnId } from './entryListColumns';

/** Crew member as stored in entry.crew_members */
export interface EntryCrewMember {
  first_name?: string | null;
  last_name?: string | null;
}

/** Entry as returned by API and used in entry list tables */
export interface EntryListEntry {
  id: number;
  class_name: string;
  first_name: string;
  last_name: string;
  club: string;
  email?: string;
  contact_phone_1?: string;
  sail_number?: string;
  boat_country_code?: string | null;
  boat_name?: string;
  category?: string;
  paid?: boolean | null;
  confirmed?: boolean | null;
  owner_first_name?: string | null;
  owner_last_name?: string | null;
  owner_email?: string | null;
  crew_members?: EntryCrewMember[] | null;
  /** Handicap rating ANC (ex.: 1.01, 0.977) */
  rating?: number | null;
  /** anc | orc | null */
  rating_type?: string | null;
  /** ORC ratings */
  orc_low?: number | null;
  orc_medium?: number | null;
  orc_high?: number | null;
}

export function formatOwner(entry: EntryListEntry): string {
  const parts = [entry.owner_first_name, entry.owner_last_name].filter(Boolean);
  return parts.join(' ').trim() || '—';
}

/** Skipper = helm (first_name + last_name) */
export function formatSkipper(entry: EntryListEntry): string {
  const parts = [entry.first_name, entry.last_name].filter(Boolean);
  return parts.join(' ').trim() || '—';
}

/** Crew list: skipper first, then each crew_member (same column "Crew") */
export function formatCrewColumn(entry: EntryListEntry): { skipper: string; crew: string[] } {
  const skipper = formatSkipper(entry);
  const crew = (entry.crew_members || [])
    .map((m) => [m.first_name, m.last_name].filter(Boolean).join(' ').trim())
    .filter(Boolean);
  return { skipper, crew };
}
