export type NoticeSource =
  | "ORGANIZING_AUTHORITY"
  | "RACE_COMMITTEE"
  | "JURY"
  | "TECHNICAL_COMMITTEE"
  | "OTHER";

export type NoticeDocType =
  | "RACE_DOCUMENT"
  | "RULE_42"
  | "JURY_DOC"
  | "TECHNICAL"
  | "OTHER";

export interface Notice {
  id: number;
  filename: string;
  filepath: string;
  title: string;
  regatta_id: number;
  published_at: string; // ISO
  source: NoticeSource;
  doc_type: NoticeDocType;
  is_important: boolean;
  applies_to_all: boolean;
  classes: string[]; // ["49er","ILCA 7"]
}

export interface RegattaClass {
  id: number;
  class_name: string;
}
