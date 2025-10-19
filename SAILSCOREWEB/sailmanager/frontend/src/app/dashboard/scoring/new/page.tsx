'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiGet, apiPost } from '@/lib/api';
import type { ScoringCreate } from '@/lib/api';

type EntryOption = {
  id: number;
  regatta_id?: number | string | null;
  class_name: string;
  sail_number?: string | null;
  boat_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
};

function entryLabel(e: EntryOption) {
  const full = `${e.first_name || ''} ${e.last_name || ''}`.trim();
  const name = full || e.email || e.boat_name || '—';
  return `${e.class_name} — ${e.sail_number || '—'} — ${name}`;
}

export default function NewScoringPage() {
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
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // selection + derived read-only fields
  const [initiatorEntryId, setInitiatorEntryId] = useState<number | ''>('');
  const selectedEntry = useMemo(
    () => myEntries.find((e) => e.id === initiatorEntryId),
    [myEntries, initiatorEntryId]
  );

  // other fields
  const [raceNumber, setRaceNumber] = useState('');
  const [requestedChange, setRequestedChange] = useState('');
  const [requestedScore, setRequestedScore] = useState<string>(''); // keep as string in UI, convert to number
  const [boatAhead, setBoatAhead] = useState('');
  const [boatBehind, setBoatBehind] = useState('');

  useEffect(() => {
    if (!regattaId || !token) return;
    let cancelled = false;
    (async () => {
      setLoadingEntries(true); setErr(null);
      try {
        let mine: EntryOption[] =
          (await apiGet<EntryOption[]>(`/entries?mine=1&regatta_id=${regattaId}`, token)) || [];
        if (!mine.length) {
          const allMine = await apiGet<EntryOption[]>(`/entries?mine=1`, token).catch(() => []);
          mine = (allMine || []).filter((e) => {
            const rid = e.regatta_id == null ? undefined : Number(e.regatta_id);
            return rid === undefined || rid === regattaId;
          });
        }
        if (!cancelled) {
          setMyEntries(mine);
          if (mine.length === 1) setInitiatorEntryId(mine[0].id);
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || 'Failed to load your entries.');
      } finally {
        if (!cancelled) setLoadingEntries(false);
      }
    })();
    return () => { cancelled = true; };
  }, [regattaId, token]);

  async function handleSubmit() {
    setErr(null);
    if (!regattaId || !token) {
      setErr('Missing session or regatta.');
      return;
    }
    if (!initiatorEntryId) {
      setErr('Select your boat (entry).');
      return;
    }

    const numericScore =
      requestedScore.trim() === '' ? null : Number(requestedScore.replace(',', '.'));
    if (requestedScore.trim() !== '' && !Number.isFinite(numericScore as number)) {
      setErr('Requested score must be a number (e.g. 23).');
      return;
    }

    const payload: ScoringCreate = {
      initiator_entry_id: Number(initiatorEntryId),
      race_number: (raceNumber || '').trim() || null,
      class_name: selectedEntry?.class_name || null,    // read-only (filled from entry)
      sail_number: selectedEntry?.sail_number || null,  // read-only (filled from entry)
      requested_change: (requestedChange || '').trim() || null,
      requested_score: numericScore as number | null,
      boat_ahead: (boatAhead || '').trim() || null,
      boat_behind: (boatBehind || '').trim() || null,
    };

    try {
      setSubmitting(true);
      await apiPost(`/regattas/${regattaId}/scoring`, payload, token);
      router.replace(`/dashboard/scoring?regattaId=${regattaId}`);
    } catch (e: any) {
      setErr(e?.message || 'Failed to submit scoring enquiry.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!regattaId || !token) {
    return <div className="max-w-3xl mx-auto p-4">Initializing…</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">New Scoring Enquiry</h1>
        <button onClick={() => router.back()} className="px-3 py-2 rounded border">Back</button>
      </div>

      <section className="bg-white border rounded p-4 space-y-3">
        <div>
          <label className="block text-sm mb-1">Your boat (entry)</label>
          <select
            className="w-full border rounded px-3 py-2"
            value={initiatorEntryId}
            onChange={(e) => setInitiatorEntryId(e.target.value ? Number(e.target.value) : '')}
            disabled={loadingEntries || myEntries.length <= 1}
          >
            {/* If the user only has one entry, we show it and keep the select disabled */}
            <option value="">{myEntries.length > 1 ? '— Select —' : '—'}</option>
            {myEntries.map((e) => (
              <option key={e.id} value={e.id}>{entryLabel(e)}</option>
            ))}
          </select>
          {loadingEntries && <div className="text-gray-500 text-sm mt-1">Loading your entries…</div>}
        </div>

        {/* Read-only derived fields */}
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">Class</label>
            <div className="w-full border rounded px-3 py-2 bg-gray-50">
              {selectedEntry?.class_name || '—'}
            </div>
          </div>
          <div>
            <label className="block text-sm mb-1">Sail number</label>
            <div className="w-full border rounded px-3 py-2 bg-gray-50">
              {selectedEntry?.sail_number || '—'}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm mb-1">Race number (optional)</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={raceNumber}
            onChange={(e) => setRaceNumber(e.target.value)}
          />
        </div>

        {/* New fields */}
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm mb-1">Requested score</label>
            <input
              inputMode="decimal"
              className="w-full border rounded px-3 py-2"
              value={requestedScore}
              onChange={(e) => setRequestedScore(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Boat ahead</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={boatAhead}
              onChange={(e) => setBoatAhead(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Boat behind</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={boatBehind}
              onChange={(e) => setBoatBehind(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm mb-1">Requested change</label>
          <textarea
            rows={4}
            className="w-full border rounded px-3 py-2"
            value={requestedChange}
            onChange={(e) => setRequestedChange(e.target.value)}
            placeholder="Describe the scoring change you request…"
          />
        </div>

        {err && <div className="text-red-600">{err}</div>}

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleSubmit}
            disabled={submitting || !initiatorEntryId}
            className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
          <button onClick={() => router.back()} className="px-4 py-2 rounded border">Cancel</button>
        </div>
      </section>
    </div>
  );
}
