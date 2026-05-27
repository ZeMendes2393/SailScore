/**
 * Catálogo dos campos da online entry (formulário público).
 * Fonte de verdade para o painel admin e, no futuro, configuração por regata.
 */

export type OnlineEntrySectionId =
  | 'step1_class'
  | 'step2_helm'
  | 'step2_crew'
  | 'step3_boat'
  | 'payload_only';

export type OnlineEntryAppliesTo =
  | 'all'
  | 'one_design'
  | 'handicap'
  | 'multi_crew'; // sailors_per_boat >= 2 (passo crew)

export interface OnlineEntryFieldDef {
  id: string;
  section: OnlineEntrySectionId;
  label: string;
  /** Chave enviada na API POST /entries/ (ou dentro de crew_members). */
  apiKey: string;
  appliesTo: OnlineEntryAppliesTo[];
  /** Aparece no formulário público actual. */
  inPublicForm: boolean;
  /** Obrigatório no HTML / validação frontend antes de submit. */
  requiredUi: boolean;
  /** Obrigatório no backend (schema ou regra de negócio). */
  requiredBackend: boolean;
  /**
   * Campos que no futuro não poderão ser desactivados na config por regata.
   * (Apenas documentação por agora — ainda não há config editável.)
   */
  lockedCore: boolean;
  notes?: string;
}

export const ONLINE_ENTRY_SECTIONS: {
  id: OnlineEntrySectionId;
  title: string;
  step: number | null;
  description: string;
}[] = [
  {
    id: 'step1_class',
    title: 'Step 1 — Select class',
    step: 1,
    description: 'Escolha da classe (One Design ou Handicap).',
  },
  {
    id: 'step2_helm',
    title: 'Step 2 — Skipper details',
    step: 2,
    description: 'Dados do skipper / helm (sempre).',
  },
  {
    id: 'step2_crew',
    title: 'Step 2b — Crew members',
    step: 2,
    description: 'Só quando a classe tem 2+ sailors (sailors_per_boat).',
  },
  {
    id: 'step3_boat',
    title: 'Step 3 — Boat details',
    step: 3,
    description: 'Barco; campos extra em Handicap vs One Design.',
  },
  {
    id: 'payload_only',
    title: 'Sent on submit (not a form field)',
    step: null,
    description: 'Valores derivados ou só no payload; não há input dedicado.',
  },
];

export const ONLINE_ENTRY_FIELDS: OnlineEntryFieldDef[] = [
  // —— Step 1 ——
  {
    id: 'class_name',
    section: 'step1_class',
    label: 'Competition class',
    apiKey: 'class_name',
    appliesTo: ['all'],
    inPublicForm: true,
    requiredUi: true,
    requiredBackend: true,
    lockedCore: true,
    notes: 'Lista vem das classes da regata (GET /regattas/{id}/classes/detailed).',
  },

  // —— Step 2 Helm ——
  {
    id: 'helm_position',
    section: 'step2_helm',
    label: 'Position (Skipper / Crew)',
    apiKey: 'helm_position',
    appliesTo: ['all'],
    inPublicForm: true,
    requiredUi: false,
    requiredBackend: false,
    lockedCore: false,
    notes: 'Default Skipper; guardado como helm_position no payload.',
  },
  {
    id: 'first_name',
    section: 'step2_helm',
    label: 'First name',
    apiKey: 'first_name',
    appliesTo: ['all'],
    inPublicForm: true,
    requiredUi: true,
    requiredBackend: false,
    lockedCore: true,
  },
  {
    id: 'last_name',
    section: 'step2_helm',
    label: 'Last name',
    apiKey: 'last_name',
    appliesTo: ['all'],
    inPublicForm: true,
    requiredUi: true,
    requiredBackend: false,
    lockedCore: true,
  },
  {
    id: 'date_of_birth',
    section: 'step2_helm',
    label: 'Date of birth',
    apiKey: 'date_of_birth',
    appliesTo: ['all'],
    inPublicForm: true,
    requiredUi: false,
    requiredBackend: false,
    lockedCore: false,
  },
  {
    id: 'gender',
    section: 'step2_helm',
    label: 'Gender',
    apiKey: 'gender',
    appliesTo: ['all'],
    inPublicForm: true,
    requiredUi: true,
    requiredBackend: false,
    lockedCore: false,
  },
  {
    id: 'federation_license',
    section: 'step2_helm',
    label: 'Federation license',
    apiKey: 'federation_license',
    appliesTo: ['all'],
    inPublicForm: true,
    requiredUi: false,
    requiredBackend: false,
    lockedCore: false,
  },
  {
    id: 'email',
    section: 'step2_helm',
    label: 'Email',
    apiKey: 'email',
    appliesTo: ['all'],
    inPublicForm: true,
    requiredUi: true,
    requiredBackend: true,
    lockedCore: true,
    notes: 'Obrigatório para criar conta sailor e emails de confirmação.',
  },
  {
    id: 'contact_phone_1',
    section: 'step2_helm',
    label: 'Primary phone',
    apiKey: 'contact_phone_1',
    appliesTo: ['all'],
    inPublicForm: true,
    requiredUi: false,
    requiredBackend: false,
    lockedCore: false,
  },
  {
    id: 'contact_phone_2',
    section: 'step2_helm',
    label: 'Secondary phone',
    apiKey: 'contact_phone_2',
    appliesTo: ['all'],
    inPublicForm: true,
    requiredUi: false,
    requiredBackend: false,
    lockedCore: false,
  },
  {
    id: 'club',
    section: 'step2_helm',
    label: 'Club',
    apiKey: 'club',
    appliesTo: ['all'],
    inPublicForm: true,
    requiredUi: false,
    requiredBackend: false,
    lockedCore: false,
  },
  {
    id: 'helm_country',
    section: 'step2_helm',
    label: 'Country',
    apiKey: 'helm_country',
    appliesTo: ['all'],
    inPublicForm: true,
    requiredUi: false,
    requiredBackend: false,
    lockedCore: false,
  },
  {
    id: 'helm_country_secondary',
    section: 'step2_helm',
    label: 'Second country (dual nationality)',
    apiKey: 'helm_country_secondary',
    appliesTo: ['all'],
    inPublicForm: true,
    requiredUi: false,
    requiredBackend: false,
    lockedCore: false,
  },
  {
    id: 'territory',
    section: 'step2_helm',
    label: 'Territory / Federation',
    apiKey: 'territory',
    appliesTo: ['all'],
    inPublicForm: true,
    requiredUi: false,
    requiredBackend: false,
    lockedCore: false,
  },
  {
    id: 'address',
    section: 'step2_helm',
    label: 'Full address',
    apiKey: 'address',
    appliesTo: ['all'],
    inPublicForm: true,
    requiredUi: false,
    requiredBackend: false,
    lockedCore: false,
  },
  {
    id: 'zip_code',
    section: 'step2_helm',
    label: 'Postcode',
    apiKey: 'zip_code',
    appliesTo: ['all'],
    inPublicForm: true,
    requiredUi: false,
    requiredBackend: false,
    lockedCore: false,
  },
  {
    id: 'town',
    section: 'step2_helm',
    label: 'Town / City',
    apiKey: 'town',
    appliesTo: ['all'],
    inPublicForm: true,
    requiredUi: false,
    requiredBackend: false,
    lockedCore: false,
  },

  // —— Step 2b Crew (per member, crew_members[]) ——
  {
    id: 'crew_position',
    section: 'step2_crew',
    label: 'Position',
    apiKey: 'crew_members[].position',
    appliesTo: ['multi_crew'],
    inPublicForm: true,
    requiredUi: false,
    requiredBackend: false,
    lockedCore: false,
  },
  {
    id: 'crew_first_name',
    section: 'step2_crew',
    label: 'First name',
    apiKey: 'crew_members[].first_name',
    appliesTo: ['multi_crew'],
    inPublicForm: true,
    requiredUi: false,
    requiredBackend: false,
    lockedCore: false,
  },
  {
    id: 'crew_last_name',
    section: 'step2_crew',
    label: 'Last name',
    apiKey: 'crew_members[].last_name',
    appliesTo: ['multi_crew'],
    inPublicForm: true,
    requiredUi: false,
    requiredBackend: false,
    lockedCore: false,
  },
  {
    id: 'crew_email',
    section: 'step2_crew',
    label: 'Email',
    apiKey: 'crew_members[].email',
    appliesTo: ['multi_crew'],
    inPublicForm: true,
    requiredUi: false,
    requiredBackend: false,
    lockedCore: false,
    notes: 'Só entra no array se tiver nome, apelido ou email preenchido.',
  },
  {
    id: 'crew_federation_license',
    section: 'step2_crew',
    label: 'Federation license',
    apiKey: 'crew_members[].federation_license',
    appliesTo: ['multi_crew'],
    inPublicForm: true,
    requiredUi: false,
    requiredBackend: false,
    lockedCore: false,
  },
  {
    id: 'crew_gender',
    section: 'step2_crew',
    label: 'Gender',
    apiKey: 'crew_members[].gender',
    appliesTo: ['multi_crew'],
    inPublicForm: true,
    requiredUi: false,
    requiredBackend: false,
    lockedCore: false,
  },
  {
    id: 'crew_helm_country',
    section: 'step2_crew',
    label: 'Country',
    apiKey: 'crew_members[].helm_country',
    appliesTo: ['multi_crew'],
    inPublicForm: true,
    requiredUi: false,
    requiredBackend: false,
    lockedCore: false,
    notes: 'UI crew não inclui telefone, morada nem licença extra além das listadas.',
  },

  // —— Step 3 Boat ——
  {
    id: 'boat_name',
    section: 'step3_boat',
    label: 'Boat name',
    apiKey: 'boat_name',
    appliesTo: ['all'],
    inPublicForm: true,
    requiredUi: true,
    requiredBackend: false,
    lockedCore: true,
  },
  {
    id: 'boat_country_code',
    section: 'step3_boat',
    label: 'Country code (sail)',
    apiKey: 'boat_country_code',
    appliesTo: ['all'],
    inPublicForm: true,
    requiredUi: true,
    requiredBackend: true,
    lockedCore: true,
  },
  {
    id: 'sail_number',
    section: 'step3_boat',
    label: 'Sail number',
    apiKey: 'sail_number',
    appliesTo: ['all'],
    inPublicForm: true,
    requiredUi: true,
    requiredBackend: true,
    lockedCore: true,
    notes: 'Validação extra no submit (notify) além do HTML required.',
  },
  {
    id: 'boat_model',
    section: 'step3_boat',
    label: 'Boat model',
    apiKey: 'boat_model',
    appliesTo: ['handicap'],
    inPublicForm: true,
    requiredUi: false,
    requiredBackend: false,
    lockedCore: false,
  },
  {
    id: 'owner_first_name',
    section: 'step3_boat',
    label: 'Owner first name',
    apiKey: 'owner_first_name',
    appliesTo: ['handicap'],
    inPublicForm: true,
    requiredUi: false,
    requiredBackend: false,
    lockedCore: false,
  },
  {
    id: 'owner_last_name',
    section: 'step3_boat',
    label: 'Owner last name',
    apiKey: 'owner_last_name',
    appliesTo: ['handicap'],
    inPublicForm: true,
    requiredUi: false,
    requiredBackend: false,
    lockedCore: false,
  },
  {
    id: 'owner_email',
    section: 'step3_boat',
    label: 'Owner email',
    apiKey: 'owner_email',
    appliesTo: ['handicap'],
    inPublicForm: true,
    requiredUi: false,
    requiredBackend: false,
    lockedCore: false,
  },
  {
    id: 'category',
    section: 'step3_boat',
    label: 'Category (e.g. Men, Women, Mixed)',
    apiKey: 'category',
    appliesTo: ['one_design'],
    inPublicForm: true,
    requiredUi: false,
    requiredBackend: false,
    lockedCore: false,
    notes: 'Não enviado em handicap (payload força undefined).',
  },

  // —— Payload only ——
  {
    id: 'regatta_id',
    section: 'payload_only',
    label: 'Regatta ID',
    apiKey: 'regatta_id',
    appliesTo: ['all'],
    inPublicForm: false,
    requiredUi: false,
    requiredBackend: true,
    lockedCore: true,
  },
  {
    id: 'boat_country',
    section: 'payload_only',
    label: 'Boat country (duplicate of code)',
    apiKey: 'boat_country',
    appliesTo: ['all'],
    inPublicForm: false,
    requiredUi: false,
    requiredBackend: false,
    lockedCore: false,
    notes: 'Preenchido a partir de boat_country_code no submit.',
  },
  {
    id: 'crew_members',
    section: 'payload_only',
    label: 'Crew members array',
    apiKey: 'crew_members',
    appliesTo: ['multi_crew'],
    inPublicForm: false,
    requiredUi: false,
    requiredBackend: false,
    lockedCore: false,
  },
];

/** Campos no schema EntryCreate que ainda não estão no formulário público. */
export const ONLINE_ENTRY_NOT_IN_PUBLIC_FORM: {
  apiKey: string;
  label: string;
  notes: string;
}[] = [
  { apiKey: 'bow_number', label: 'Bow number', notes: 'Admin / import only.' },
  { apiKey: 'rating', label: 'Rating (ANC)', notes: 'Handicap admin; não no online entry.' },
  { apiKey: 'rating_type', label: 'Rating type', notes: 'orc | anc — admin.' },
  { apiKey: 'orc_low / orc_medium / orc_high', label: 'ORC ratings', notes: 'Admin only.' },
  { apiKey: 'paid', label: 'Paid', notes: 'Admin default false.' },
  { apiKey: 'confirmed', label: 'Confirmed', notes: 'Admin default false.' },
];

export function fieldsForSection(sectionId: OnlineEntrySectionId): OnlineEntryFieldDef[] {
  return ONLINE_ENTRY_FIELDS.filter((f) => f.section === sectionId);
}

export function countByAppliesTo(applies: OnlineEntryAppliesTo): number {
  return ONLINE_ENTRY_FIELDS.filter((f) => f.appliesTo.includes(applies)).length;
}

/** Default required for configurable fields (same as requiredUi in catalog). */
export function defaultRequiredForField(field: OnlineEntryFieldDef): boolean {
  return field.requiredUi;
}

export function isFieldConfigurable(field: OnlineEntryFieldDef): boolean {
  return field.inPublicForm && !field.lockedCore && field.section !== 'payload_only';
}

export const CONFIGURABLE_ONLINE_ENTRY_FIELDS = ONLINE_ENTRY_FIELDS.filter(isFieldConfigurable);

export function mergeEffectiveRequired(
  overrides?: Record<string, boolean> | null
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const field of CONFIGURABLE_ONLINE_ENTRY_FIELDS) {
    out[field.id] =
      overrides && typeof overrides[field.id] === 'boolean'
        ? overrides[field.id]
        : defaultRequiredForField(field);
  }
  return out;
}

export function computeOverridesFromEffective(
  effective: Record<string, boolean>
): Record<string, boolean> {
  const overrides: Record<string, boolean> = {};
  for (const field of CONFIGURABLE_ONLINE_ENTRY_FIELDS) {
    const def = defaultRequiredForField(field);
    if (effective[field.id] !== def) {
      overrides[field.id] = effective[field.id];
    }
  }
  return overrides;
}

export function fieldAppliesToContext(
  field: OnlineEntryFieldDef,
  classType: 'one_design' | 'handicap' | undefined,
  multiCrew: boolean
): boolean {
  if (field.appliesTo.includes('all')) return true;
  if (field.appliesTo.includes('multi_crew') && multiCrew) return true;
  if (classType === 'handicap' && field.appliesTo.includes('handicap')) return true;
  if (classType === 'one_design' && field.appliesTo.includes('one_design')) return true;
  if (
    field.appliesTo.includes('one_design') &&
    !field.appliesTo.includes('handicap') &&
    classType !== 'handicap'
  ) {
    return true;
  }
  if (
    field.appliesTo.includes('handicap') &&
    !field.appliesTo.includes('one_design') &&
    classType === 'handicap'
  ) {
    return true;
  }
  return false;
}

export function isCoreRequiredField(fieldId: string): boolean {
  const field = ONLINE_ENTRY_FIELDS.find((f) => f.id === fieldId);
  return !!field?.lockedCore || !!field?.requiredBackend;
}

export function validateEntryAgainstRequired(
  payload: Record<string, unknown>,
  requiredMap: Record<string, boolean>,
  opts: {
    classType?: 'one_design' | 'handicap';
    multiCrew: boolean;
    crewMembers?: Record<string, unknown>[];
  }
): string | null {
  const { classType, multiCrew, crewMembers = [] } = opts;

  const check = (fieldId: string, value: unknown): string | null => {
    const field = ONLINE_ENTRY_FIELDS.find((f) => f.id === fieldId);
    if (!field || !requiredMap[fieldId]) return null;
    if (!fieldAppliesToContext(field, classType, multiCrew)) return null;
    const filled =
      value != null && (typeof value !== 'string' || value.trim() !== '');
    if (!filled) return `${field.label} is required.`;
    return null;
  };

  for (const field of CONFIGURABLE_ONLINE_ENTRY_FIELDS) {
    if (field.section === 'step2_crew') continue;
    const apiKey = field.apiKey.replace('crew_members[].', '');
    const err = check(field.id, payload[apiKey]);
    if (err) return err;
  }

  const crewFieldMap: Record<string, string> = {
    crew_position: 'position',
    crew_first_name: 'first_name',
    crew_last_name: 'last_name',
    crew_email: 'email',
    crew_federation_license: 'federation_license',
    crew_gender: 'gender',
    crew_helm_country: 'helm_country',
  };

  if (multiCrew) {
    for (const field of CONFIGURABLE_ONLINE_ENTRY_FIELDS.filter((f) => f.section === 'step2_crew')) {
      if (!requiredMap[field.id]) continue;
      const key = crewFieldMap[field.id];
      if (!key) continue;
      const activeMembers = crewMembers.filter(
        (m) =>
          (typeof m.first_name === 'string' && m.first_name.trim()) ||
          (typeof m.last_name === 'string' && m.last_name.trim()) ||
          (typeof m.email === 'string' && m.email.trim())
      );
      if (activeMembers.length === 0) {
        return 'At least one crew member is required for this class.';
      }
      for (let i = 0; i < activeMembers.length; i++) {
        const err = check(field.id, activeMembers[i][key]);
        if (err) return `Crew member ${i + 1}: ${err}`;
      }
    }
  }

  return null;
}

export function createRequiredChecker(
  overrides?: Record<string, boolean> | null,
  classType?: 'one_design' | 'handicap',
  multiCrew = false
): (fieldId: string) => boolean {
  const requiredMap = mergeEffectiveRequired(overrides);
  return (fieldId: string) => {
    const field = ONLINE_ENTRY_FIELDS.find((f) => f.id === fieldId);
    if (!field) return false;
    if (field.lockedCore || field.requiredBackend) return true;
    if (!fieldAppliesToContext(field, classType, multiCrew)) return false;
    return !!requiredMap[fieldId];
  };
}
