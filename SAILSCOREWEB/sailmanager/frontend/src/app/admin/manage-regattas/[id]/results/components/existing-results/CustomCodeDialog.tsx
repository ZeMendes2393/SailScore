'use client';

import { useEffect, useState } from 'react';
import notify from '@/lib/notify';
import type { CustomCodeFormValues } from './scoringCodeMap';

type Props = {
  open: boolean;
  onClose: () => void;
  saving?: boolean;
  initial?: Partial<CustomCodeFormValues>;
  onSave: (values: CustomCodeFormValues) => Promise<string | null>;
  onSaveAndApply: (values: CustomCodeFormValues) => Promise<void>;
};

const defaultForm = (): CustomCodeFormValues => ({
  codeName: '',
  points: '',
  discardable: true,
  shiftPositions: false,
});

export default function CustomCodeDialog({
  open,
  onClose,
  saving = false,
  initial,
  onSave,
  onSaveAndApply,
}: Props) {
  const [form, setForm] = useState<CustomCodeFormValues>(defaultForm);

  useEffect(() => {
    if (!open) return;
    setForm({
      codeName: initial?.codeName ?? '',
      points: initial?.points ?? '',
      discardable: initial?.discardable !== false,
      shiftPositions: initial?.shiftPositions === true,
    });
  }, [open, initial]);

  if (!open) return null;

  const set = <K extends keyof CustomCodeFormValues>(key: K, value: CustomCodeFormValues[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const validate = (): CustomCodeFormValues | null => {
    const codeName = form.codeName.trim();
    const pts = Number(form.points);
    if (!codeName) return null;
    if (!Number.isFinite(pts) || pts < 0) return null;
    return { ...form, codeName, points: String(pts) };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-labelledby="custom-code-title"
        className="relative w-full max-w-md rounded-xl bg-white shadow-xl border border-slate-200 p-5"
      >
        <h3 id="custom-code-title" className="text-lg font-semibold text-slate-900 mb-1">
          Custom scoring code
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Saved for this class. You can reuse it on any race in the dropdown.
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Code name</label>
            <input
              type="text"
              className="w-full border rounded-lg px-3 py-2 uppercase"
              placeholder="e.g. RPR, PROTEST"
              value={form.codeName}
              onChange={(e) => set('codeName', e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Points</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="e.g. 15"
              value={form.points}
              onChange={(e) => set('points', e.target.value)}
            />
          </div>
          <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={form.discardable}
              onChange={(e) => set('discardable', e.target.checked)}
            />
            <span>
              <span className="font-medium">Discardable</span>
              <span className="block text-xs text-slate-500">
                Can be dropped from the net score in the overall standings.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={form.shiftPositions}
              onChange={(e) => set('shiftPositions', e.target.checked)}
            />
            <span>
              <span className="font-medium">Shift places behind</span>
              <span className="block text-xs text-slate-500">
                Boats that finished behind this one move up one place (like DNF/DSQ). If off, only
                points change and finish order stays as entered.
              </span>
            </span>
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 justify-end">
          <button
            type="button"
            className="px-3 py-2 rounded-lg border text-sm hover:bg-slate-50"
            disabled={saving}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-3 py-2 rounded-lg border text-sm hover:bg-slate-50 disabled:opacity-50"
            disabled={saving || !validate()}
            onClick={async () => {
              const v = validate();
              if (!v) {
                notify.warning('Enter a code name and valid points.');
                return;
              }
              await onSave(v);
            }}
          >
            Save to class
          </button>
          <button
            type="button"
            className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
            disabled={saving || !validate()}
            onClick={async () => {
              const v = validate();
              if (!v) {
                notify.warning('Enter a code name and valid points.');
                return;
              }
              await onSaveAndApply(v);
            }}
          >
            {saving ? 'Saving…' : 'Save & apply'}
          </button>
        </div>
      </div>
    </div>
  );
}
