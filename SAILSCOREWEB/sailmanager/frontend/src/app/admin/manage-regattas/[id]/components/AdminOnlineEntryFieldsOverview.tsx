'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiSend } from '@/lib/api';
import notify from '@/lib/notify';
import {
  CONFIGURABLE_ONLINE_ENTRY_FIELDS,
  ONLINE_ENTRY_FIELDS,
  ONLINE_ENTRY_NOT_IN_PUBLIC_FORM,
  ONLINE_ENTRY_SECTIONS,
  computeOverridesFromEffective,
  defaultRequiredForField,
  fieldAppliesToContext,
  isFieldConfigurable,
  mergeEffectiveRequired,
  type OnlineEntryAppliesTo,
  type OnlineEntryFieldDef,
} from '@/lib/onlineEntryFields';

type FilterApplies = 'all' | OnlineEntryAppliesTo;

type Props = {
  regattaId: number;
  overrides?: Record<string, boolean> | null;
  onSaved?: (overrides: Record<string, boolean>) => void;
};

function AppliesBadge({ applies }: { applies: OnlineEntryAppliesTo[] }) {
  const labels: Record<OnlineEntryAppliesTo, string> = {
    all: 'All classes',
    one_design: 'One Design',
    handicap: 'Handicap',
    multi_crew: 'Multi-crew (2+ sailors)',
  };
  return (
    <span className="flex flex-wrap gap-1">
      {applies.map((a) => (
        <span
          key={a}
          className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-700 border border-gray-200"
        >
          {labels[a]}
        </span>
      ))}
    </span>
  );
}

function RequiredToggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}
      title={disabled ? 'Core field — always required' : checked ? 'Required' : 'Optional'}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
          checked ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function FieldRow({
  field,
  required,
  configurable,
  onToggle,
}: {
  field: OnlineEntryFieldDef;
  required: boolean;
  configurable: boolean;
  onToggle?: (fieldId: string, next: boolean) => void;
}) {
  const locked = field.lockedCore || field.requiredBackend;

  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50/80">
      <td className="py-2 pr-3 align-top">
        <div className="font-medium text-gray-900">{field.label}</div>
        {locked && (
          <span className="mt-0.5 inline-block text-[10px] text-gray-500">Core — always required</span>
        )}
      </td>
      <td className="py-2 pr-3 align-top font-mono text-xs text-gray-600">{field.apiKey}</td>
      <td className="py-2 pr-3 align-top">
        <AppliesBadge applies={field.appliesTo} />
      </td>
      <td className="py-2 pr-3 align-top">
        <div className="flex items-center gap-2">
          <RequiredToggle
            checked={required}
            disabled={!configurable}
            onChange={(next) => onToggle?.(field.id, next)}
          />
          <span className="text-xs text-gray-600">{required ? 'Required' : 'Optional'}</span>
        </div>
      </td>
      <td className="py-2 align-top text-xs text-gray-500">{field.notes || '—'}</td>
    </tr>
  );
}

export default function AdminOnlineEntryFieldsOverview({
  regattaId,
  overrides,
  onSaved,
}: Props) {
  const { token } = useAuth();
  const [filter, setFilter] = useState<FilterApplies>('all');
  const [draft, setDraft] = useState<Record<string, boolean>>(() =>
    mergeEffectiveRequired(overrides)
  );
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDraft(mergeEffectiveRequired(overrides));
    setDirty(false);
  }, [overrides]);

  const savedEffective = useMemo(() => mergeEffectiveRequired(overrides), [overrides]);

  const visibleFields = useMemo(() => {
    const base =
      filter === 'all'
        ? ONLINE_ENTRY_FIELDS.filter((f) => f.section !== 'payload_only')
        : filter === 'multi_crew'
          ? ONLINE_ENTRY_FIELDS.filter((f) => f.appliesTo.includes('multi_crew'))
          : ONLINE_ENTRY_FIELDS.filter(
              (f) =>
                f.section !== 'payload_only' &&
                (f.appliesTo.includes(filter) || f.appliesTo.includes('all'))
            );
    return base;
  }, [filter]);

  const sectionsWithFields = useMemo(() => {
    return ONLINE_ENTRY_SECTIONS.filter((s) => s.id !== 'payload_only')
      .map((sec) => ({
        ...sec,
        fields: visibleFields.filter((f) => f.section === sec.id),
      }))
      .filter((s) => s.fields.length > 0);
  }, [visibleFields]);

  const handleToggle = useCallback((fieldId: string, next: boolean) => {
    setDraft((prev) => {
      const updated = { ...prev, [fieldId]: next };
      const newOverrides = computeOverridesFromEffective(updated);
      const oldOverrides = computeOverridesFromEffective(savedEffective);
      setDirty(JSON.stringify(newOverrides) !== JSON.stringify(oldOverrides));
      return updated;
    });
  }, [savedEffective]);

  const handleSave = async () => {
    if (!token) return;
    const payload = computeOverridesFromEffective(draft);
    setSaving(true);
    try {
      await apiSend(
        `/regattas/${regattaId}`,
        'PATCH',
        { online_entry_field_required: payload },
        token
      );
      notify.success('Online entry field settings saved.');
      onSaved?.(payload);
      setDirty(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save field settings.';
      notify.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    const defaults: Record<string, boolean> = {};
    for (const f of CONFIGURABLE_ONLINE_ENTRY_FIELDS) {
      defaults[f.id] = defaultRequiredForField(f);
    }
    setDraft(defaults);
    const newOverrides = computeOverridesFromEffective(defaults);
    const oldOverrides = computeOverridesFromEffective(savedEffective);
    setDirty(JSON.stringify(newOverrides) !== JSON.stringify(oldOverrides));
  };

  const stats = useMemo(
    () => ({
      configurable: CONFIGURABLE_ONLINE_ENTRY_FIELDS.length,
      requiredNow: CONFIGURABLE_ONLINE_ENTRY_FIELDS.filter((f) => draft[f.id]).length,
      core: ONLINE_ENTRY_FIELDS.filter((f) => f.lockedCore).length,
    }),
    [draft]
  );

  return (
    <div className="space-y-4 border-t border-gray-200 pt-6 mt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Form fields</h3>
          <p className="text-sm text-gray-600 mt-1">
            Toggle which fields are <strong>required</strong> or <strong>optional</strong> on the
            public online entry form. Core fields (class, name, email, sail number…) cannot be
            changed. Settings apply to new submissions immediately.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={saving}
            className="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
          >
            Reset to defaults
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving}
            className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save field settings'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700">
          {stats.configurable} configurable
        </span>
        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-900 border border-blue-100">
          {stats.requiredNow} required (configurable)
        </span>
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-900 border border-amber-100">
          {stats.core} core (locked)
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-600">Filter:</span>
        {(
          [
            { value: 'all' as const, label: 'All fields' },
            { value: 'one_design' as const, label: 'One Design' },
            { value: 'handicap' as const, label: 'Handicap' },
            { value: 'multi_crew' as const, label: 'Multi-crew' },
          ] as const
        ).map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`px-3 py-1 text-xs rounded-full border transition ${
              filter === value
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {sectionsWithFields.map((section) => (
        <div key={section.id} className="rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
            <h4 className="text-sm font-semibold text-gray-800">{section.title}</h4>
            <p className="text-xs text-gray-500">{section.description}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left min-w-[640px]">
              <thead className="text-xs text-gray-500 uppercase bg-white">
                <tr>
                  <th className="px-4 py-2 font-medium">Label</th>
                  <th className="px-4 py-2 font-medium">API key</th>
                  <th className="px-4 py-2 font-medium">Applies to</th>
                  <th className="px-4 py-2 font-medium">Required</th>
                  <th className="px-4 py-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="px-4">
                {section.fields.map((field) => {
                  const configurable = isFieldConfigurable(field);
                  const required = field.lockedCore
                    ? true
                    : configurable
                      ? !!draft[field.id]
                      : field.requiredUi || field.requiredBackend;
                  return (
                    <FieldRow
                      key={field.id}
                      field={field}
                      required={required}
                      configurable={configurable}
                      onToggle={handleToggle}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="rounded-lg border border-dashed border-gray-300 p-4">
        <h4 className="text-sm font-semibold text-gray-800 mb-2">
          In API schema but not in the public online form
        </h4>
        <ul className="text-sm text-gray-600 space-y-1">
          {ONLINE_ENTRY_NOT_IN_PUBLIC_FORM.map((item) => (
            <li key={item.apiKey}>
              <span className="font-mono text-xs text-gray-700">{item.apiKey}</span>
              <span className="text-gray-500"> — {item.label}. </span>
              <span className="text-gray-400 text-xs">{item.notes}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
