'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';
import MultiStepEntryForm from '@/components/onlineentry/MultiStepEntryForm';

type RegattaLite = {
  id: number;
  name: string;
  online_entry_open?: boolean;
  online_entry_mode?: 'internal' | 'external_link';
  online_entry_url?: string | null;
  online_entry_field_required?: Record<string, boolean> | null;
  online_entry_field_visibility?: Record<string, boolean> | null;
};

export default function OnlineEntryPublic({ regattaId }: { regattaId: number }) {
  const [reg, setReg] = useState<RegattaLite | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true); setErr(null);
      try {
        const r = await apiGet<RegattaLite>(`/regattas/${regattaId}`);
        if (!cancel) {
          setReg({
            ...r,
            online_entry_open: r.online_entry_open ?? true,
            online_entry_mode: r.online_entry_mode ?? 'internal',
          });
        }
      } catch (e: any) {
        if (!cancel) setErr(e?.message || 'Failed to load regatta.');
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [regattaId]);

  if (loading) return <div className="p-6 text-gray-500">Loading…</div>;
  if (err) return <div className="p-6 text-red-600">{err}</div>;

  if (!reg?.online_entry_open) {
    return (
      <div className="max-w-3xl mx-auto p-6 bg-white rounded border">
        <h2 className="text-xl font-semibold mb-2">Entries are closed</h2>
        <p className="text-gray-600">
          Online entries are currently disabled for this regatta.
        </p>
      </div>
    );
  }

  if ((reg.online_entry_mode ?? 'internal') === 'external_link') {
    const externalUrl = (reg.online_entry_url ?? '').trim();
    if (!externalUrl) {
      return (
        <div className="max-w-3xl mx-auto p-6 bg-white rounded border">
          <h2 className="text-xl font-semibold mb-2">Entry link unavailable</h2>
          <p className="text-gray-600">
            This event is configured to use an external form, but no link is currently available.
          </p>
        </div>
      );
    }
    return (
      <div className="max-w-3xl mx-auto p-6 bg-white rounded border">
        <h2 className="text-xl font-semibold mb-2">External online entry</h2>
        <p className="text-gray-600 mb-4">
          This event uses an external form for registration.
        </p>
        <a
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Open entry form
        </a>
      </div>
    );
  }

  return (
    <MultiStepEntryForm
      regattaId={regattaId}
      fieldRequiredOverrides={reg?.online_entry_field_required}
      fieldVisibilityOverrides={reg?.online_entry_field_visibility}
    />
  );
}
