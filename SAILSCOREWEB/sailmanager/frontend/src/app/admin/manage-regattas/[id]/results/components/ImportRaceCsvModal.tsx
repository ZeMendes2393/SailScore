'use client';

import { useState, useRef } from 'react';
import { BASE_URL } from '@/lib/api';

type PreviewRow = { sail_number: string; points: string; code: string | null };

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
  const [errors, setErrors] = useState<string[]>([]);
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [validationOk, setValidationOk] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const url = `${BASE_URL}/results/races/${raceId}/import/csv`;

  const validateFile = async () => {
    if (!file || !token) return;
    setLoading(true);
    setPreview([]);
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
      setErrors(Array.isArray(data.errors) ? data.errors : []);
      setUnmatched(Array.isArray(data.unmatched) ? data.unmatched : []);
      setValidationOk(data.ok === true && (data.errors?.length ?? 0) === 0);
    } catch (e: any) {
      setErrors([e?.message || 'Erro ao validar ficheiro.']);
      setValidationOk(false);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!file || !token || !validationOk) return;
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
      setErrors((prev) => [...prev, e?.message || 'Erro ao importar.']);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="import-csv-title">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col">
        <h2 id="import-csv-title" className="text-lg font-semibold p-4 border-b">
          Import into this race (CSV)
          {raceName ? <span className="text-gray-500 font-normal"> — {raceName}</span> : null}
        </h2>
        <div className="p-4 space-y-4 overflow-auto">
          <p className="text-sm text-gray-600">
            Header: <code className="bg-gray-100 px-1 rounded">sail_number,points,code</code>. One design only.
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
              {loading ? 'A validar…' : 'Validar e pré-visualizar'}
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
              sail_number(s) não encontrados na lista de inscrições: {unmatched.join(', ')}
            </div>
          )}
          {preview.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-1">Pré-visualização (primeiras linhas)</h3>
              <div className="border rounded overflow-auto max-h-40">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border px-2 py-1 text-left">sail_number</th>
                      <th className="border px-2 py-1 text-left">points</th>
                      <th className="border px-2 py-1 text-left">code</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i}>
                        <td className="border px-2 py-1">{row.sail_number}</td>
                        <td className="border px-2 py-1">{row.points}</td>
                        <td className="border px-2 py-1">{row.code ?? ''}</td>
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
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!validationOk || confirming}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {confirming ? 'A importar…' : 'Confirmar import'}
          </button>
        </div>
      </div>
    </div>
  );
}
