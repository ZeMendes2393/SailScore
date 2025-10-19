'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import RequireAuth from '@/components/RequireAuth';
import { useAuth } from '@/context/AuthContext';
import { useEntry } from '@/lib/hooks/useEntry';
import { apiGet } from '@/lib/api';

export default function Page() {
  const params = useParams<{ entryId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { token } = useAuth();

  const entryId = Number(params.entryId);
  const regattaId = useMemo(() => {
    const fromQS = Number(searchParams.get('regattaId') || '');
    const fallback = Number(process.env.NEXT_PUBLIC_CURRENT_REGATTA_ID || '1');
    return Number.isFinite(fromQS) && fromQS > 0 ? fromQS : fallback;
  }, [searchParams]);

  // evita chamadas com id inválido
  const safeEntryId = Number.isFinite(entryId) && entryId > 0 ? entryId : 0;

  const { entry, loading, error, patch, setEntry, refresh } = useEntry({
    entryId: safeEntryId,
    token: token || undefined,
  });

  const [classes, setClasses] = useState<string[]>([]);
  useEffect(() => {
    (async () => {
      if (!regattaId) return;
      try {
        const arr = await apiGet<string[]>(`/regattas/${regattaId}/classes`, token || undefined);
        setClasses(Array.isArray(arr) ? arr : []);
      } catch {
        setClasses([]);
      }
    })();
  }, [regattaId, token]);

  // local form state
  const [form, setForm] = useState<any>({});
  useEffect(() => {
    if (entry) setForm(entry);
  }, [entry]);

  const onChange = (name: string, value: any) => {
    setForm((prev: any) => ({ ...prev, [name]: value }));
  };

  const onSave = async () => {
    if (!entry) return;
    const changed: Record<string, any> = {};
    for (const k of Object.keys(form)) {
      if ((form as any)[k] !== (entry as any)[k]) changed[k] = (form as any)[k];
    }
    if (Object.keys(changed).length === 0) return;

    const touchingKeys = 'class_name' in changed || 'sail_number' in changed;
    const propagate = touchingKeys
      ? window.confirm('Class or sail number changed. Propagate changes to Results and Rule42?')
      : false;

    try {
      const updated = await patch(changed, { propagate_keys: propagate });
      if (updated) setEntry(updated);
      alert('Saved.');
    } catch (e: any) {
      alert(e?.message ?? 'Failed to save.');
    }
  };

  // NOVO: botão rápido para confirmar / desconfirmar
  const onToggleConfirm = async () => {
    if (!entry) return;
    try {
      const next = !Boolean(form.confirmed);
      const updated = await patch({ confirmed: next });
      if (updated) {
        setEntry(updated);
        setForm(updated);
      } else {
        // fallback otimista
        setForm((prev: any) => ({ ...prev, confirmed: next }));
      }
    } catch (e: any) {
      alert(e?.message ?? 'Failed to update confirmation.');
    }
  };

  return (
    <RequireAuth roles={['admin']}>
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold">Edit entry #{entryId}</h1>
          <div className="flex gap-2">
            <button className="px-3 py-2 rounded border" onClick={() => router.back()}>
              Back
            </button>
            

            

            <button
              className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
              onClick={onSave}
              disabled={!entry || loading}
            >
              {loading ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {error && <div className="text-red-600 mb-3">{error}</div>}
        {loading && <div className="text-gray-600">Loading…</div>}
        {!loading && !entry && !error && (
          <div className="p-6 rounded border bg-white">Entry not found.</div>
        )}

        {entry && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Summary */}
            <section className="bg-white rounded border p-4">
              <h2 className="font-semibold mb-3">Summary</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <label className="text-gray-500">Regatta ID</label>
                <div>{entry.regatta_id}</div>

                <label className="text-gray-500">Paid</label>
                <input
                  type="checkbox"
                  checked={Boolean(form.paid)}
                  onChange={(e) => onChange('paid', e.target.checked)}
                />

                {/* NOVO: Confirmed */}
                <label className="text-gray-500">Confirmed</label>
                <input
                  type="checkbox"
                  checked={Boolean(form.confirmed)}
                  onChange={(e) => onChange('confirmed', e.target.checked)}
                />

                <label className="text-gray-500">Class</label>
                <select
                  className="border rounded px-2 py-1"
                  value={form.class_name ?? ''}
                  onChange={(e) => onChange('class_name', e.target.value)}
                >
                  <option value="">—</option>
                  {classes.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            {/* Boat */}
            <section className="bg-white rounded border p-4">
              <h2 className="font-semibold mb-3">Boat</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <label className="text-gray-500">Boat name</label>
                <input
                  className="border rounded px-2 py-1"
                  value={form.boat_name ?? ''}
                  onChange={(e) => onChange('boat_name', e.target.value)}
                />

                <label className="text-gray-500">Sail number</label>
                <input
                  className="border rounded px-2 py-1"
                  value={form.sail_number ?? ''}
                  onChange={(e) => onChange('sail_number', e.target.value)}
                />

                <label className="text-gray-500">Boat country</label>
                <input
                  className="border rounded px-2 py-1"
                  value={form.boat_country ?? ''}
                  onChange={(e) => onChange('boat_country', e.target.value)}
                />

                <label className="text-gray-500">Category</label>
                <input
                  className="border rounded px-2 py-1"
                  value={form.category ?? ''}
                  onChange={(e) => onChange('category', e.target.value)}
                />
              </div>
            </section>

            {/* Helm */}
            <section className="bg-white rounded border p-4">
              <h2 className="font-semibold mb-3">Helm</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <label className="text-gray-500">First name</label>
                <input
                  className="border rounded px-2 py-1"
                  value={form.first_name ?? ''}
                  onChange={(e) => onChange('first_name', e.target.value)}
                />

                <label className="text-gray-500">Last name</label>
                <input
                  className="border rounded px-2 py-1"
                  value={form.last_name ?? ''}
                  onChange={(e) => onChange('last_name', e.target.value)}
                />

                <label className="text-gray-500">Date of birth</label>
                <input
                  type="date"
                  className="border rounded px-2 py-1"
                  value={form.date_of_birth ?? ''}
                  onChange={(e) => onChange('date_of_birth', e.target.value)}
                />

                <label className="text-gray-500">Gender</label>
                <input
                  className="border rounded px-2 py-1"
                  value={form.gender ?? ''}
                  onChange={(e) => onChange('gender', e.target.value)}
                />

                <label className="text-gray-500">Club</label>
                <input
                  className="border rounded px-2 py-1"
                  value={form.club ?? ''}
                  onChange={(e) => onChange('club', e.target.value)}
                />

                <label className="text-gray-500">Country (primary)</label>
                <input
                  className="border rounded px-2 py-1"
                  value={form.helm_country ?? ''}
                  onChange={(e) => onChange('helm_country', e.target.value)}
                />

                <label className="text-gray-500">Country (secondary)</label>
                <input
                  className="border rounded px-2 py-1"
                  value={form.helm_country_secondary ?? ''}
                  onChange={(e) => onChange('helm_country_secondary', e.target.value)}
                />
              </div>
            </section>

            {/* Contacts & Address */}
            <section className="bg-white rounded border p-4">
              <h2 className="font-semibold mb-3">Contacts & Address</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <label className="text-gray-500">Email</label>
                <input
                  className="border rounded px-2 py-1"
                  value={form.email ?? ''}
                  onChange={(e) => onChange('email', e.target.value)}
                />

                <label className="text-gray-500">Phone 1</label>
                <input
                  className="border rounded px-2 py-1"
                  value={form.contact_phone_1 ?? ''}
                  onChange={(e) => onChange('contact_phone_1', e.target.value)}
                />

                <label className="text-gray-500">Phone 2</label>
                <input
                  className="border rounded px-2 py-1"
                  value={form.contact_phone_2 ?? ''}
                  onChange={(e) => onChange('contact_phone_2', e.target.value)}
                />

                <label className="text-gray-500">Territory</label>
                <input
                  className="border rounded px-2 py-1"
                  value={form.territory ?? ''}
                  onChange={(e) => onChange('territory', e.target.value)}
                />

                <label className="text-gray-500">Address</label>
                <input
                  className="border rounded px-2 py-1"
                  value={form.address ?? ''}
                  onChange={(e) => onChange('address', e.target.value)}
                />

                <label className="text-gray-500">ZIP</label>
                <input
                  className="border rounded px-2 py-1"
                  value={form.zip_code ?? ''}
                  onChange={(e) => onChange('zip_code', e.target.value)}
                />

                <label className="text-gray-500">City</label>
                <input
                  className="border rounded px-2 py-1"
                  value={form.town ?? ''}
                  onChange={(e) => onChange('town', e.target.value)}
                />
              </div>
            </section>
          </div>
        )}
      </div>
    </RequireAuth>
  );
}
