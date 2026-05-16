'use client';

import { useState } from 'react';
import { apiSend } from '@/lib/api';
import notify from '@/lib/notify';

export type EntryImportRow = {
  row_number: number;
  boat_country_code: string;
  sail_number: string;
  club?: string | null;
  helm_first_name: string;
  helm_last_name: string;
  helm_license?: string | null;
  crew_first_name?: string | null;
  crew_last_name?: string | null;
  crew_license?: string | null;
  registration_number?: string | null;
};

type PreviewResponse = {
  rows: EntryImportRow[];
  warnings: string[];
  page_title?: string | null;
  duplicate_sails: string[];
};

type ConfirmResponse = {
  created: number;
  skipped_duplicates: number;
  failed: number;
  errors: string[];
  created_entry_ids: number[];
};

interface ImportEntriesModalProps {
  regattaId: number;
  className: string;
  token: string;
  onClose: () => void;
  onImported: () => void;
}

export default function ImportEntriesModal({
  regattaId,
  className,
  token,
  onClose,
  onImported,
}: ImportEntriesModalProps) {
  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [markPaid, setMarkPaid] = useState(false);
  const [markConfirmed, setMarkConfirmed] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  const loadPreview = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      notify.warning('Paste the entry list URL.');
      return;
    }
    setLoadingPreview(true);
    setPreview(null);
    try {
      const data = await apiSend<PreviewResponse>(
        '/entries/import/preview',
        'POST',
        { url: trimmed, regatta_id: regattaId, class_name: className },
        token
      );
      setPreview(data);
      if (!data.rows?.length) {
        notify.warning('No entries found on that page.');
      }
    } catch (e: any) {
      notify.error(e?.message || 'Could not load preview from URL.');
    } finally {
      setLoadingPreview(false);
    }
  };

  const confirmImport = async () => {
    if (!preview?.rows?.length) return;
    setImporting(true);
    try {
      const result = await apiSend<ConfirmResponse>(
        '/entries/import/confirm',
        'POST',
        {
          regatta_id: regattaId,
          class_name: className,
          rows: preview.rows,
          mark_paid: markPaid,
          mark_confirmed: markConfirmed,
          skip_duplicates: skipDuplicates,
        },
        token
      );
      if (result.created > 0) {
        notify.success(`Imported ${result.created} entries.`);
        onImported();
      }
      if (result.skipped_duplicates > 0) {
        notify.info(`Skipped ${result.skipped_duplicates} duplicate(s) already in this class.`);
      }
      if (result.failed > 0) {
        notify.error({
          title: `${result.failed} row(s) failed`,
          description: result.errors.slice(0, 3).join(' · ') || 'See server response.',
        });
      }
      if (result.created > 0 && result.failed === 0) {
        onClose();
      }
    } catch (e: any) {
      notify.error(e?.message || 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-entries-title"
    >
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="p-5 border-b flex items-start justify-between gap-4">
          <div>
            <h2 id="import-entries-title" className="text-lg font-semibold text-gray-900">
              Import entries from URL
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Class: <strong>{className}</strong> — HTML entry lists or published Google Sheets links (pubhtml).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 text-xl leading-none px-2"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-auto flex-1">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Entry list URL</label>
            <div className="flex gap-2 flex-wrap">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
                className="flex-1 min-w-[200px] border rounded-lg px-3 py-2 text-sm"
                disabled={loadingPreview || importing}
              />
              <button
                type="button"
                onClick={loadPreview}
                disabled={loadingPreview || importing}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
              >
                {loadingPreview ? 'Loading…' : 'Preview'}
              </button>
            </div>
          </div>

          {preview && (
            <>
              {preview.page_title && (
                <p className="text-xs text-gray-500">Source: {preview.page_title}</p>
              )}
              {preview.warnings.length > 0 && (
                <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  {preview.warnings.map((w, i) => (
                    <div key={i}>{w}</div>
                  ))}
                </div>
              )}
              {preview.duplicate_sails.length > 0 && (
                <p className="text-sm text-amber-700">
                  Already in regatta ({preview.duplicate_sails.length}):{' '}
                  {preview.duplicate_sails.slice(0, 8).join(', ')}
                  {preview.duplicate_sails.length > 8 ? '…' : ''}
                </p>
              )}

              <div className="flex flex-wrap gap-4 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={skipDuplicates}
                    onChange={(e) => setSkipDuplicates(e.target.checked)}
                    disabled={importing}
                  />
                  Skip duplicates
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={markPaid}
                    onChange={(e) => setMarkPaid(e.target.checked)}
                    disabled={importing}
                  />
                  Mark as paid
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={markConfirmed}
                    onChange={(e) => setMarkConfirmed(e.target.checked)}
                    disabled={importing}
                  />
                  Mark as confirmed
                </label>
              </div>

              <p className="text-sm text-gray-700">
                <strong>{preview.rows.length}</strong> entries ready to import
              </p>

              <div className="border rounded-lg overflow-auto max-h-64">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left p-2">Sail</th>
                      <th className="text-left p-2">Helm</th>
                      <th className="text-left p-2">Crew</th>
                      <th className="text-left p-2">Club</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r) => (
                      <tr key={r.row_number} className="border-t">
                        <td className="p-2 whitespace-nowrap">
                          {r.boat_country_code} {r.sail_number}
                        </td>
                        <td className="p-2">
                          {r.helm_first_name} {r.helm_last_name}
                        </td>
                        <td className="p-2">
                          {[r.crew_first_name, r.crew_last_name].filter(Boolean).join(' ') || '—'}
                        </td>
                        <td className="p-2">{r.club || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="p-5 border-t flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={importing}
            className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirmImport}
            disabled={!preview?.rows?.length || importing}
            className="px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-60"
          >
            {importing ? 'Importing…' : `Import ${preview?.rows?.length ?? 0} entries`}
          </button>
        </div>
      </div>
    </div>
  );
}
