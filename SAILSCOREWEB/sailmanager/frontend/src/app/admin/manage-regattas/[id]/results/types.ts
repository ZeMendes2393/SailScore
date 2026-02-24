// Tipos partilhados no módulo de resultados

export interface Race {
  id: number;
  name: string;
  regatta_id: number;
  class_name: string;
  fleet_set_id?: number | null;
  discardable: boolean;
  /** Handicap: início da corrida (HH:MM:SS) e dia (provas multi-dia) */
  start_time?: string | null;
  start_day?: number | null;
  /** Método de handicap: manual | anc | orc */
  handicap_method?: string | null;
  /** ORC: qual rating usar (low | medium | high) */
  orc_rating_mode?: string | null;
}

export interface Entry {
  id: number;
  class_name: string;
  first_name: string;
  last_name: string;
  club: string;
  sail_number?: string;
  boat_country_code?: string | null;
  boat_name?: string;
  regatta_id?: number;
  rating?: number | null;
  rating_type?: string | null;
  orc_low?: number | null;
  orc_medium?: number | null;
  orc_high?: number | null;
}

export interface ApiResult {
  id: number;
  regatta_id: number;
  race_id: number;
  sail_number: string | null;
  boat_country_code: string | null;
  boat_name: string | null;
  class_name: string;
  skipper_name: string | null;
  position: number;
  points: number;
  code?: string | null;
  points_override: number | null;
  /** Handicap / Time Scoring */
  rating?: number | null;
  finish_time?: string | null;
  finish_day?: number | null;
  elapsed_time?: string | null;
  corrected_time?: string | null;
  delta?: string | null;
  notes?: string | null;
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
