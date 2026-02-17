/**
 * Definição das colunas da entry list (partilhada entre lista pública e admin).
 * A seleção ativa é definida no admin e persistida em regatta.entry_list_columns.
 */

export const ENTRY_LIST_COLUMN_IDS = [
  'sail_no',
  'boat_name',
  'class',
  'category',
  'owner',
  'crew',
  'club',
  'paid',
  'status',
] as const;

export type EntryListColumnId = (typeof ENTRY_LIST_COLUMN_IDS)[number];

export interface EntryListColumnDef {
  id: EntryListColumnId;
  label: string;
}

export const ENTRY_LIST_COLUMNS: EntryListColumnDef[] = [
  { id: 'sail_no', label: 'Sail No' },
  { id: 'boat_name', label: 'Boat / Yacht Name' },
  { id: 'class', label: 'Class' },
  { id: 'category', label: 'Category (CAT)' },
  { id: 'owner', label: 'Owner' },
  { id: 'crew', label: 'Crew' },
  { id: 'club', label: 'Club' },
  { id: 'paid', label: 'Paid' },
  { id: 'status', label: 'Status' },
];

/** Colunas visíveis por predefinição (esta fase). */
export const DEFAULT_ENTRY_LIST_COLUMNS: EntryListColumnId[] = [
  'sail_no',
  'boat_name',
  'class',
  'category',
  'owner',
  'crew',
  'club',
  'paid',
  'status',
];

export function getVisibleColumns(saved: string[] | null | undefined): EntryListColumnId[] {
  if (Array.isArray(saved) && saved.length > 0) {
    return saved.filter((id): id is EntryListColumnId =>
      ENTRY_LIST_COLUMN_IDS.includes(id as EntryListColumnId)
    );
  }
  return [...DEFAULT_ENTRY_LIST_COLUMNS];
}
