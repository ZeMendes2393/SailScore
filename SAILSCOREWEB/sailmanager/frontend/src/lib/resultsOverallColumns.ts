/**
 * Colunas da tabela Results Overall (admin).
 * Por classe: results_overall_columns é um objeto { [className]: columnIds[] }.
 * Legado: array de columnIds (uma config para todas as classes).
 */

export const RESULTS_OVERALL_COLUMN_IDS = [
  'place',
  'fleet',
  'sail_no',
  'boat',
  'skipper',
  'class',
  'model',
  'bow',
  'total',
  'net',
] as const;

export type ResultsOverallColumnId = (typeof RESULTS_OVERALL_COLUMN_IDS)[number];

export interface ResultsOverallColumnDef {
  id: ResultsOverallColumnId;
  label: string;
}

export const RESULTS_OVERALL_COLUMNS: ResultsOverallColumnDef[] = [
  { id: 'place', label: '#' },
  { id: 'fleet', label: 'Fleet' },
  { id: 'sail_no', label: 'Sail #' },
  { id: 'boat', label: 'Boat' },
  { id: 'skipper', label: 'Skipper' },
  { id: 'class', label: 'Class' },
  { id: 'model', label: 'Model' },
  { id: 'bow', label: 'Bow' },
  { id: 'total', label: 'Total' },
  { id: 'net', label: 'Net' },
];

/** Ordem predefinida das colunas fixas (sem as colunas por corrida). */
export const DEFAULT_RESULTS_OVERALL_COLUMNS: ResultsOverallColumnId[] = [
  'place',
  'fleet',
  'sail_no',
  'boat',
  'skipper',
  'class',
  'model',
  'bow',
  'total',
  'net',
];

export function getVisibleResultsOverallColumns(
  saved: string[] | null | undefined
): ResultsOverallColumnId[] {
  if (Array.isArray(saved) && saved.length > 0) {
    return saved.filter((id): id is ResultsOverallColumnId =>
      RESULTS_OVERALL_COLUMN_IDS.includes(id as ResultsOverallColumnId)
    );
  }
  return [...DEFAULT_RESULTS_OVERALL_COLUMNS];
}

/** saved: array (legado) ou objeto { [className]: columnIds[] }. Retorna colunas visíveis para a classe. */
export function getVisibleResultsOverallColumnsForClass(
  saved: string[] | Record<string, string[]> | null | undefined,
  className: string | null
): ResultsOverallColumnId[] {
  if (saved == null) return [...DEFAULT_RESULTS_OVERALL_COLUMNS];
  if (Array.isArray(saved)) return getVisibleResultsOverallColumns(saved);
  const byClass = saved as Record<string, string[]>;
  if (className && byClass[className]?.length) return getVisibleResultsOverallColumns(byClass[className]);
  if (byClass['__default__']?.length) return getVisibleResultsOverallColumns(byClass['__default__']);
  return [...DEFAULT_RESULTS_OVERALL_COLUMNS];
}

/** Devolve o objeto completo para PATCH após toggle de coluna na classe dada. */
export function resultsOverallColumnsByClassAfterToggle(
  current: string[] | Record<string, string[]> | null | undefined,
  className: string,
  nextColumnIds: ResultsOverallColumnId[]
): Record<string, string[]> {
  const byClass: Record<string, string[]> = Array.isArray(current)
    ? { __default__: current }
    : (current && typeof current === 'object' ? { ...current } : {});
  byClass[className] = nextColumnIds;
  return byClass;
}
