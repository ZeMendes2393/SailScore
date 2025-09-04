export type ProtestType =
  | 'protest'
  | 'redress'
  | 'reopen'
  | 'support_person_report'
  | 'misconduct_rss69';

export type ProtestStatus =
  | 'submitted'
  | 'under_review'
  | 'scheduled'
  | 'closed'
  | 'invalid'
  | 'withdrawn';

export interface ProtestPartySummary {
  sail_no?: string | null;
  boat_name?: string | null;
  class_name?: string | null;
  free_text?: string | null;
}

export interface ProtestInitiatorSummary {
  sail_no?: string | null;
  boat_name?: string | null;
  class_name?: string | null;
}

export interface ProtestListItem {
  id: number;
  short_code: string;
  type: ProtestType;
  status: ProtestStatus;
  race_date?: string | null;
  race_number?: string | null;
  group_name?: string | null;
  initiator: ProtestInitiatorSummary;
  respondents: ProtestPartySummary[];
  updated_at: string; // ISO
}

export interface ProtestsListResponse {
  items: ProtestListItem[];
  page_info: { has_more: boolean; next_cursor?: number | null };
}
