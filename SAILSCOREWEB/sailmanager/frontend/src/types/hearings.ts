// src/types/hearings.ts

export type HearingStatus = 'OPEN' | 'CLOSED';

export type HearingItem = {
  id: number;

  // agora opcionais (podem vir null ou nem vir)
  case_number?: number | string | null;
  race?: string | null;            // ex.: "5" ou data/descrição
  initiator?: string | null;       // "123 · ILCA7"
  respondent?: string | null;      // "456 · ILCA7" ou texto livre
  sch_date?: string | null;        // "YYYY-MM-DD" ou null
  sch_time?: string | null;        // "HH:MM" ou null
  room?: string | null;
  decision?: string | null;

  status: HearingStatus;

  // novos campos vindos do backend
  protest_id?: number | null;
  submitted_pdf_url?: string | null;
  decision_pdf_url?: string | null;

  // mantido (backend devolve sempre)
  updated_at: string;              // ISO string
};

export type HearingsList = {
  items: HearingItem[];
  page_info: { has_more: boolean; next_cursor: number | null };
};
