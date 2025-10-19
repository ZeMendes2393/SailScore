'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';
import MultiStepEntryForm from '@/components/onlineentry/MultiStepEntryForm';

type RegattaLite = {
  id: number;
  name: string;
  online_entry_open?: boolean; // default true for backward compatibility
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
        if (!cancel) setReg({ ...r, online_entry_open: r.online_entry_open ?? true });
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

  return <MultiStepEntryForm regattaId={regattaId} />;
}
