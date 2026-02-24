/**
 * Definição das colunas da entry list (partilhada entre lista pública e admin).
 * A seleção ativa é definida no admin e persistida em regatta.entry_list_columns.
 * Por classe: entry_list_columns é um objeto { [className]: columnIds[] }.
 * Legado: array de columnIds (uma config para todas as classes).
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
  'rating',
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
  { id: 'rating', label: 'Rating' },
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
  'rating',
];

export function getVisibleColumns(saved: string[] | null | undefined): EntryListColumnId[] {
  if (Array.isArray(saved) && saved.length > 0) {
    return saved.filter((id): id is EntryListColumnId =>
      ENTRY_LIST_COLUMN_IDS.includes(id as EntryListColumnId)
    );
  }
  return [...DEFAULT_ENTRY_LIST_COLUMNS];
}

/** saved: array (legado) ou objeto { [className]: columnIds[] }. Retorna colunas visíveis para a classe. */
export function getVisibleColumnsForClass(
  saved: string[] | Record<string, string[]> | null | undefined,
  className: string | null
): EntryListColumnId[] {
  if (saved == null) return [...DEFAULT_ENTRY_LIST_COLUMNS];
  if (Array.isArray(saved)) return getVisibleColumns(saved);
  const byClass = saved as Record<string, string[]>;
  if (className && byClass[className]?.length) return getVisibleColumns(byClass[className]);
  if (byClass['__default__']?.length) return getVisibleColumns(byClass['__default__']);
  return [...DEFAULT_ENTRY_LIST_COLUMNS];
}

/** Devolve o objeto completo para PATCH após toggle de coluna na classe dada. */
export function columnsByClassAfterToggle(
  current: string[] | Record<string, string[]> | null | undefined,
  className: string,
  nextColumnIds: EntryListColumnId[]
): Record<string, string[]> {
  const byClass: Record<string, string[]> = Array.isArray(current)
    ? { __default__: current }
    : (current && typeof current === 'object' ? { ...current } : {});
  byClass[className] = nextColumnIds;
  return byClass;
}
