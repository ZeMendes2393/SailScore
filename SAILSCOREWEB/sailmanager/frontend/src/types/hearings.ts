export type HearingStatus = "OPEN" | "CLOSED";

export interface HearingItem {
  id: number;
  case_number: number;
  race: string;
  initiator: string;
  respondent: string;
  status: HearingStatus;
  sch_date: string | null;   // "YYYY-MM-DD"
  sch_time: string | null;   // "HH:MM"
  room: string | null;
  decision: string | null;   // só vem preenchido se CLOSED
  decision_pdf_url: string | null; // idem
  updated_at: string;        // ISO
}

export interface HearingsList {
  items: HearingItem[];
  page_info: { has_more: boolean; next_cursor?: number | null };
}
