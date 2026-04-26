'use client';

import { useState, useRef } from 'react';
import { BASE_URL } from '@/lib/api';

type PreviewRow = Record<string, string | number | null | undefined>;

interface ImportRaceCsvModalProps {
  raceId: number;
  raceName?: string;
  token: string | undefined;
  onClose: () => void;
  onSuccess: () => void;
}

function authHeader(token?: string): Record<string, string> {
  if (!token?.trim()) return {};
  const bare = token.trim().replace(/^bearer\s+/i, '');
  return { Authorization: `Bearer ${bare}` };
}

export default function ImportRaceCsvModal({
  raceId,
  raceName,
  token,
  onClose,
  onSuccess,
}: ImportRaceCsvModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [clearExisting, setClearExisting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [previewColumns, setPreviewColumns] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [validationOk, setValidationOk] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const url = `${BASE_URL}/results/races/${raceId}/import/csv`;

  const validateFile = async (): Promise<boolean> => {
    if (!file) {
      setValidationOk(false);
      setErrors(['Choose a CSV file first.']);
      return false;
    }
    if (!token) {
      setValidationOk(false);
      setErrors(['Admin session missing. Please log in again.']);
      return false;
    }
    setLoading(true);
    setPreview([]);
    setPreviewColumns([]);
    setErrors([]);
    setUnmatched([]);
    setValidationOk(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('clear_existing', String(clearExisting));
      form.append('confirm', 'false');
      const res = await fetch(url, {
        method: 'POST',
        headers: authHeader(token),
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      setPreview(Array.isArray(data.preview) ? data.preview : []);
      setPreviewColumns(Array.isArray(data.columns) ? data.columns : []);
      setErrors(Array.isArray(data.errors) ? data.errors : []);
      setUnmatched(Array.isArray(data.unmatched) ? data.unmatched : []);
      const ok = data.ok === true && (data.errors?.length ?? 0) === 0;
      setValidationOk(ok);
      return ok;
    } catch (e: any) {
      setErrors([e?.message || 'Error validating file.']);
      setValidationOk(false);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!file || !token) return;
    let canProceed = validationOk === true;
    if (!canProceed) {
      canProceed = await validateFile();
    }
    if (!canProceed) return;
    setConfirming(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('clear_existing', String(clearExisting));
      form.append('confirm', 'true');
      const res = await fetch(url, {
        method: 'POST',
        headers: authHeader(token),
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail));
      }
      onSuccess();
      onClose();
    } catch (e: any) {
      setErrors((prev) => [...prev, e?.message || 'Import failed.']);
    } finally {
      setConfirming(false);
    }
  };

  const confirmDisabledReason = !file
    ? 'Select a CSV file first.'
    : validationOk === null
    ? 'Click Confirm import to auto-validate and import.'
    : validationOk === false
    ? 'Fix validation errors before importing.'
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="import-csv-title">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col">
        <h2 id="import-csv-title" className="text-lg font-semibold p-4 border-b">
          Import into this race (CSV)
          {raceName ? <span className="text-gray-500 font-normal"> — {raceName}</span> : null}
        </h2>
        <div className="p-4 space-y-4 overflow-auto">
          <p className="text-sm text-gray-600">
            CSV columns depend on race scoring mode. Export this race first to get the exact template.
          </p>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded file:border file:border-gray-300 file:bg-gray-50"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setFile(f || null);
                setPreview([]);
                setPreviewColumns([]);
                setErrors([]);
                setUnmatched([]);
                setValidationOk(null);
              }}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={clearExisting}
              onChange={(e) => setClearExisting(e.target.checked)}
            />
            Clear existing results before import
          </label>
          {file && (
            <button
              type="button"
              onClick={validateFile}
              disabled={loading}
              className="px-4 py-2 rounded-lg border border-gray-300 bg-gray-50 hover:bg-gray-100 disabled:opacity-50 text-sm"
            >
              {loading ? 'Validating...' : 'Validate and preview'}
            </button>
          )}
          {errors.length > 0 && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
              <ul className="list-disc list-inside">
                {errors.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            </div>
          )}
          {unmatched.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm">
              Sail/country pair(s) not found in the entry list: {unmatched.join(', ')}
            </div>
          )}
          {preview.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-1">Preview (first rows)</h3>
              <div className="border rounded overflow-auto max-h-40">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-100">
                    <tr>
                      {(previewColumns.length ? previewColumns : Object.keys(preview[0] || {})).map((col) => (
                        <th key={col} className="border px-2 py-1 text-left">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i}>
                        {(previewColumns.length ? previewColumns : Object.keys(preview[0] || {})).map((col) => (
                          <td key={col} className="border px-2 py-1">
                            {String(row[col] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!file || loading || confirming}
            title={confirmDisabledReason ?? undefined}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {confirming ? 'Importing...' : 'Confirm import'}
          </button>
        </div>
      </div>
    </div>
  );
}
