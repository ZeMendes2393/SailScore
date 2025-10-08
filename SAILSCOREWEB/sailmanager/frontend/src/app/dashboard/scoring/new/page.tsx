'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiGet, apiPost } from '@/lib/api';
import type { ScoringCreate } from '@/lib/api';

// Reaproveita o tipo que já usas para entries noutras páginas:
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

  // form
  const [initiatorEntryId, setInitiatorEntryId] = useState<number | ''>('');
  const [raceNumber, setRaceNumber] = useState('');
  const [className, setClassName] = useState('');
  const [sailNumber, setSailNumber] = useState('');
  const [reason, setReason] = useState('');
  const [requestedChange, setRequestedChange] = useState('');

  // Carrega as "minhas" entries (mesma abordagem dos protests)
  useEffect(() => {
    if (!regattaId || !token) return;
    let cancelled = false;

    (async () => {
      setLoadingEntries(true); setErr(null);
      try {
        // tenta já filtrado por regata
        let mine: EntryOption[] =
          (await apiGet<EntryOption[]>(`/entries?mine=1&regatta_id=${regattaId}`, token)) || [];

        // fallback: todas -> filtra
        if (!mine.length) {
          const allMine = await apiGet<EntryOption[]>(`/entries?mine=1`, token).catch(() => []);
          mine = (allMine || []).filter((e) => {
            const rid = e.regatta_id == null ? undefined : Number(e.regatta_id);
            return rid === undefined || rid === regattaId;
          });
        }

        if (!cancelled) {
          setMyEntries(mine);
          // se houver 1 única entry, pré-preenche e puxa class/sail dessa entry
          if (mine.length === 1) {
            setInitiatorEntryId(mine[0].id);
            setClassName(mine[0].class_name || '');
            setSailNumber(mine[0].sail_number || '');
          }
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || 'Failed to load your entries.');
      } finally {
        if (!cancelled) setLoadingEntries(false);
      }
    })();

    return () => { cancelled = true; };
  }, [regattaId, token]);

  // quando muda o initiator, sincroniza classe/sail para facilitar submissão
  useEffect(() => {
    const e = myEntries.find((x) => x.id === initiatorEntryId);
    if (e) {
      setClassName(e.class_name || '');
      setSailNumber(e.sail_number || '');
    }
  }, [initiatorEntryId, myEntries]);

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

    const payload: ScoringCreate = {
      initiator_entry_id: Number(initiatorEntryId),
      race_number: (raceNumber || '').trim() || null,
      class_name: (className || '').trim() || null,
      sail_number: (sailNumber || '').trim() || null,
      reason: (reason || '').trim() || null,
      requested_change: (requestedChange || '').trim() || null,
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
            disabled={loadingEntries}
          >
            <option value="">— Select —</option>
            {myEntries.map((e) => (
              <option key={e.id} value={e.id}>{entryLabel(e)}</option>
            ))}
          </select>
          {loadingEntries && <div className="text-gray-500 text-sm mt-1">Loading your entries…</div>}
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">Class</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="ILCA 6 / 49er …"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Sail number</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={sailNumber}
              onChange={(e) => setSailNumber(e.target.value)}
              placeholder="POR 123"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm mb-1">Race number (optional)</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={raceNumber}
            onChange={(e) => setRaceNumber(e.target.value)}
            placeholder="Ex: 3"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Reason</label>
          <textarea
            rows={4}
            className="w-full border rounded px-3 py-2"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain what seems wrong with your scoring…"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Requested change</label>
          <textarea
            rows={4}
            className="w-full border rounded px-3 py-2"
            value={requestedChange}
            onChange={(e) => setRequestedChange(e.target.value)}
            placeholder="What change do you request? (e.g., adjust points to 12, change code to RDG, etc.)"
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
