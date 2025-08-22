// Tipos partilhados no módulo de resultados

export interface Race {
  id: number;
  name: string;
  regatta_id: number;
  class_name: string;
}

export interface Entry {
  id: number;
  class_name: string;
  first_name: string;
  last_name: string;
  club: string;
  sail_number?: string;
  boat_name?: string;
  regatta_id?: number;
}

export interface ApiResult {
  id: number;
  regatta_id: number;
  race_id: number;
  sail_number: string | null;
  boat_name: string | null;
  class_name: string;
  skipper_name: string | null;
  position: number;
  points: number;
  code?: string | null; // <- NOVO (DNF/DNC/DSQ/etc.)
}

export interface DraftResult {
  position: number;
  entryId: number;
  code?: string | null;    // 👈 novo (opcional)

}

export interface ScoringConfig {
  discard_count: number;
  discard_threshold: number;
  code_points?: Record<string, number>; // <- NOVO (ex: { DNF: 10, DNC: 15 })

}
