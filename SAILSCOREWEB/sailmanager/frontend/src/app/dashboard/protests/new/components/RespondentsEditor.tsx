// RespondentsEditor.tsx
'use client';

import { formatSailNumber } from '@/utils/countries';

type EntryOption = {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  class_name?: string | null;
  sail_number?: string | null;
  boat_country_code?: string | null;
  boat_name?: string | null;
  email?: string | null;
};

export type RespondentUiType =
  | 'boat'
  | 'coach'
  | 'technical_committee'
  | 'race_committee'
  | 'protest_committee'
  | 'organizing_authority'
  | 'other';

export type RespondentRowUI = {
  id: string; // uuid/string local para key
  type: RespondentUiType;
  // para type === 'boat'
  class_name?: string;
  entry_id?: number;
  // para type === 'coach' (ou outros "texto")
  name_text?: string;
  // comum
  represented_by?: string;
};

const RESPONDENT_TYPE_LABEL: Record<RespondentUiType, string> = {
  boat: 'Boat',
  coach: 'Coach',
  technical_committee: 'Technical Committee',
  race_committee: 'Race Committee',
  protest_committee: 'Protest Committee',
  organizing_authority: 'Organizing Authority',
  other: 'Other',
};

interface Props {
  respondents: RespondentRowUI[];
  classes: string[];
  entriesByClass: Record<string, EntryOption[]>;
  addRespondent: () => void;
  removeRespondent: (id: string) => void;
  updateRespondent: (id: string, patch: Partial<RespondentRowUI>) => void;
  ensureClassEntries: (cls: string) => Promise<void> | void;
}

export default function RespondentsEditor({
  respondents,
  classes,
  entriesByClass,
  addRespondent,
  removeRespondent,
  updateRespondent,
  ensureClassEntries,
}: Props) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mt-2">
        <button className="px-3 py-1 border rounded" onClick={addRespondent}>
          + Adicionar
        </button>
      </div>

      {respondents.map((r) => (
        <div key={r.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
          <div className="md:col-span-3">
            <label className="block text-sm mb-1">Type *</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={r.type}
              onChange={(e) => {
                const newType = e.target.value as RespondentUiType;
                const patch: Partial<RespondentRowUI> = { type: newType };
                if (newType === 'boat') {
                  patch.class_name = undefined;
                  patch.entry_id = undefined;
                  patch.name_text = undefined;
                } else if (newType === 'coach') {
                  patch.class_name = undefined;
                  patch.entry_id = undefined;
                  patch.name_text = r.name_text ?? '';
                } else {
                  patch.class_name = undefined;
                  patch.entry_id = undefined;
                  patch.name_text = '';
                }
                updateRespondent(r.id, patch);
              }}
            >
              {(
                [
                  'boat',
                  'coach',
                  'technical_committee',
                  'race_committee',
                  'protest_committee',
                  'organizing_authority',
                  'other',
                ] as RespondentUiType[]
              ).map((t) => (
                <option key={t} value={t}>
                  {RESPONDENT_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>

          {r.type === 'boat' && (
            <>
              <div className="md:col-span-3">
                <label className="block text-sm mb-1">Class</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={r.class_name || ''}
                  onChange={async (e) => {
                    const cls = e.target.value;
                    updateRespondent(r.id, { class_name: cls, entry_id: undefined });
                    await ensureClassEntries(cls);
                  }}
                >
                  <option value="" disabled>
                    Seleciona classe…
                  </option>
                  {classes.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-4">
                <label className="block text-sm mb-1">Sailor</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={r.entry_id ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    // evita Number('') => 0
                    updateRespondent(r.id, { entry_id: v ? Number(v) : undefined });
                  }}
                  disabled={!r.class_name}
                >
                  <option value="" disabled>
                    Seleciona…
                  </option>
                  {(r.class_name ? entriesByClass[(r.class_name || '').trim()] || [] : []).map(
                    (en) => (
                      <option key={en.id} value={en.id}>
                        {formatSailNumber(en.boat_country_code, en.sail_number)} · {en.boat_name || '—'} · {en.class_name || '—'}
                      </option>
                    )
                  )}
                </select>
              </div>
            </>
          )}

          {r.type === 'coach' && (
            <div className="md:col-span-5">
              <label className="block text-sm mb-1">Name</label>
              <input
                className="w-full border rounded px-3 py-2"
                value={r.name_text || ''}
                onChange={(e) => updateRespondent(r.id, { name_text: e.target.value })}
                placeholder="ex.: John Doe"
              />
            </div>
          )}

          <div className="md:col-span-3">
            <label className="block text-sm mb-1">Represented by (opcional)</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={r.represented_by || ''}
              onChange={(e) => updateRespondent(r.id, { represented_by: e.target.value })}
            />
          </div>

          <div className="md:col-span-1 text-right">
            <button
              className="px-3 py-2 border rounded text-red-600"
              onClick={() => removeRespondent(r.id)}
              disabled={respondents.length === 1}
              title={respondents.length === 1 ? 'Mantém pelo menos um respondente' : 'Remover'}
            >
              Remover
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
