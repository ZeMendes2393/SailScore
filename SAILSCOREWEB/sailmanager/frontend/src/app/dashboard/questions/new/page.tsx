'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiGet, apiPost } from '@/lib/api';

type EntryOption = {
  id: number;
  class_name?: string | null;
  sail_number?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  regatta_id?: number;
};

export default function NewQuestionPage() {
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
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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
    if (!regattaId || !token || !entryId || !subject.trim() || !body.trim() || submitting) return;
    setSubmitting(true);
    try {
      const chosen = myEntries.find(e => e.id === Number(entryId));
      const class_name = chosen?.class_name || '';
      const sail_number = chosen?.sail_number || '';
      const sailor_name =
        `${chosen?.first_name || ''} ${chosen?.last_name || ''}`.trim() || (chosen?.email || '');

      await apiPost(
        `/regattas/${regattaId}/questions`,
        {
          class_name,
          sail_number,
          sailor_name,
          subject: subject.trim(),
          body: body.trim(),
          visibility: 'public', // <- sempre público
        },
        token
      );

      router.replace(`/dashboard/questions?regattaId=${regattaId}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (!regattaId || !token) return <div className="p-4">Initializing…</div>;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-semibold">New Question</h1>

      <div className="bg-white rounded border p-4 space-y-3">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Your Entry</label>
          <select
            disabled={loading || submitting}
            className="w-full border rounded px-3 py-2"
            value={entryId}
            onChange={(e) => setEntryId(Number(e.target.value) || '')}
          >
            <option value="">— choose your entry —</option>
            {myEntries.map(en => (
              <option key={en.id} value={en.id}>
                {`${en.class_name || '—'} • ${en.sail_number || '—'} • ${(en.first_name || '') + ' ' + (en.last_name || '')}`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Subject</label>
          <input
            className="w-full border rounded px-3 py-2"
            placeholder="Short subject…"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={submitting}
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Question</label>
          <textarea
            rows={6}
            className="w-full border rounded px-3 py-2 resize-none break-words whitespace-pre-wrap"
            placeholder="Write your question…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={submitting}
          />
        </div>

        <div className="flex gap-2">
          <button
            disabled={!entryId || !subject.trim() || !body.trim() || submitting}
            className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
            onClick={submit}
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
          <button className="px-4 py-2 rounded border" onClick={() => router.back()} disabled={submitting}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
