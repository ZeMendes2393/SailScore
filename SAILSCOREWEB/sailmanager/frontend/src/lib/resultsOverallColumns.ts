/**
 * Colunas da tabela Results Overall (admin).
 * A seleção é guardada em regatta.results_overall_columns.
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
  { id: 'model', label: 'Model (handicap)' },
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
