'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiGet, apiPost } from '@/lib/api';
import { formatSailNumber } from '@/utils/countries';

// Podemos reutilizar a tua hook useMyEntry ou chamar /entries?mine=1
type EntryOption = { id: number; class_name?: string | null; sail_number?: string | null; boat_country_code?: string | null; first_name?: string | null; last_name?: string | null; email?: string | null; regatta_id?: number };

export default function NewRequestPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const regattaId = useMemo(() => {
    if (user?.role === 'regatista' && user?.current_regatta_id) return user.current_regatta_id;
    const fromQS = Number(searchParams.get('regattaId') || '');
    const fromEnv = Number(process.env.NEXT_PUBLIC_CURRENT_REGATTA_ID || '1');
    return Number.isFinite(fromQS) && fromQS > 0 ? fromQS : fromEnv;
  }, [user?.role, user?.current_regatta_id, searchParams]);

  const [myEntries, setMyEntries] = useState<EntryOption[]>([]);
  const [entryId, setEntryId] = useState<number | ''>('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!regattaId || !token) return;
      setLoading(true);
      try {
        const mine = await apiGet<EntryOption[]>(`/entries?mine=1&regatta_id=${regattaId}`, token);
        const list = Array.isArray(mine) ? mine : [];
        setMyEntries(list);
        if (list.length === 1) setEntryId(list[0].id);
      } finally {
        setLoading(false);
      }
    })();
  }, [regattaId, token]);

  async function submit() {
    if (!regattaId || !token || !entryId || !text.trim()) return;
    await apiPost(`/regattas/${regattaId}/requests`, { initiator_entry_id: Number(entryId), request_text: text.trim() }, token);
    router.replace(`/dashboard/requests?regattaId=${regattaId}`);
  }

  if (!regattaId || !token) return <div className="p-4">Initializing…</div>;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-semibold">New Request</h1>

      <div className="bg-white rounded border p-4 space-y-3">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Your Entry</label>
          <select
            disabled={loading}
            className="w-full border rounded px-3 py-2"
            value={entryId}
            onChange={(e) => setEntryId(Number(e.target.value) || '')}
          >
            <option value="">— choose your entry —</option>
            {myEntries.map(en => (
              <option key={en.id} value={en.id}>
                {`${en.class_name || '—'} • ${formatSailNumber(en.boat_country_code, en.sail_number)} • ${(en.first_name || '') + ' ' + (en.last_name || '')}`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Request</label>
          <textarea
            rows={6}
            className="w-full border rounded px-3 py-2 resize-none break-words whitespace-pre-wrap"
            placeholder="Write your request..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <button
            disabled={!entryId || !text.trim()}
            className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
            onClick={submit}
          >
            Submit
          </button>
          <button className="px-4 py-2 rounded border" onClick={() => router.back()}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
