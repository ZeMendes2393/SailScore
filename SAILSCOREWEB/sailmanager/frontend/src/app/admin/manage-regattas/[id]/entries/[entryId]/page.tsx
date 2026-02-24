'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import RequireAuth from '@/components/RequireAuth';
import { useAuth } from '@/context/AuthContext';
import { useEntry } from '@/lib/hooks/useEntry';
import { apiGet, apiSend } from '@/lib/api';
import { SailNumberDisplay } from '@/components/ui/SailNumberDisplay';
import { COUNTRIES_UNIQUE } from '@/utils/countries';

// Tipos para a área de documentos
type EntryAttachment = {
  id: number;
  entry_id: number;
  filename: string;      // nome original
  stored_path: string;   // URL público (ex.: /uploads/entry_attachments/xxxx.pdf)
  title: string;         // título dado pelo admin
  size_bytes: number;
  uploaded_at: string;
};

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

  const { entry, loading, error, patch, setEntry } = useEntry({
    entryId: safeEntryId,
    token: token || undefined,
  });

  // ====== CLASSES (lista simples + quais são handicap) ======
  const [classes, setClasses] = useState<string[]>([]);
  const [handicapClassNames, setHandicapClassNames] = useState<Set<string>>(new Set());
  useEffect(() => {
    (async () => {
      if (!regattaId) return;
      try {
        const detailed = await apiGet<{ class_name: string; class_type?: string }[]>(
          `/regattas/${regattaId}/classes/detailed`,
          token || undefined
        );
        const list = Array.isArray(detailed) ? detailed : [];
        setClasses(list.map((c) => c.class_name));
        const handicap = new Set(
          list.filter((c) => (c.class_type || '').toLowerCase() === 'handicap').map((c) => c.class_name)
        );
        setHandicapClassNames(handicap);
      } catch {
        try {
          const arr = await apiGet<string[]>(`/regattas/${regattaId}/classes`, token || undefined);
          setClasses(Array.isArray(arr) ? arr : []);
        } catch {
          setClasses([]);
        }
      }
    })();
  }, [regattaId, token]);

  const isHandicapClass = (className: string) =>
    !!className && handicapClassNames.has(className.trim());

  // ====== FORM LOCAL ======
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
      window.dispatchEvent(new CustomEvent('entry-saved', { detail: { regattaId } }));
      alert('Saved.');
    } catch (e: any) {
      alert(e?.message ?? 'Failed to save.');
    }
  };

  // NOVO: botão rápido para confirmar / desconfirmar (mantive a lógica, caso uses noutro botão)
  const onToggleConfirm = async () => {
    if (!entry) return;
    try {
      const next = !Boolean(form.confirmed);
      const updated = await patch({ confirmed: next });
      if (updated) {
        setEntry(updated);
        setForm(updated);
      } else {
        setForm((prev: any) => ({ ...prev, confirmed: next }));
      }
    } catch (e: any) {
      alert(e?.message ?? 'Failed to update confirmation.');
    }
  };

  // ====== DOCUMENTS (attachments) ======
  const [atts, setAtts] = useState<EntryAttachment[]>([]);
  const [attsLoading, setAttsLoading] = useState(false);
  const [attsErr, setAttsErr] = useState<string | null>(null);

  async function loadAttachments() {
    if (!entry) return;
    setAttsLoading(true);
    setAttsErr(null);
    try {
      const data = await apiGet<EntryAttachment[]>(
        `/entries/${entry.id}/attachments`,
        token || undefined
      );
      setAtts(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setAtts([]);
      setAttsErr(e?.message || 'Failed to load documents.');
    } finally {
      setAttsLoading(false);
    }
  }

  useEffect(() => {
    if (entry) loadAttachments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.id, token]);

  async function uploadAttachment(file: File, title: string) {
    if (!entry || !token) return;

    const form = new FormData();
    form.append('title', title);
    form.append('file', file);
    // se o teu backend espera regatta_id:
    // form.append('regatta_id', String(entry.regatta_id));

    const API_BASE = (process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://127.0.0.1:8000');
    const res = await fetch(`${API_BASE}/entries/${entry.id}/attachments`, {
      method: 'POST',
      headers: { Authorization: token ? `Bearer ${token}` : '' }, // multipart => sem Content-Type manual
      body: form,
    });

    if (!res.ok) {
      const msg = await res.text().catch(() => '');
      throw new Error(msg || 'Upload failed');
    }
    await loadAttachments();
  }

  async function deleteAttachment(attId: number) {
    if (!entry || !token) return;
    if (!confirm('Delete this document?')) return;
    await apiSend(`/entries/${entry.id}/attachments/${attId}`, 'DELETE', {}, token);
    await loadAttachments();
  }

  async function renameAttachment(attId: number, newTitle: string) {
    if (!entry || !token) return;
    await apiSend<EntryAttachment>(
      `/entries/${entry.id}/attachments/${attId}`,
      'PATCH',
      { title: newTitle },
      token
    );
    await loadAttachments();
  }

  // ====== RENDER ======
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

                {/* Confirmed */}
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

                <label className="text-gray-500">Country code</label>
                <select
                  className="border rounded px-2 py-1"
                  value={form.boat_country_code ?? ''}
                  onChange={(e) => onChange('boat_country_code', e.target.value)}
                >
                  <option value="">—</option>
                  {COUNTRIES_UNIQUE.map((c) => (
                    <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                  ))}
                </select>
                <label className="text-gray-500">Sail number</label>
                <input
                  className="border rounded px-2 py-1"
                  value={form.sail_number ?? ''}
                  onChange={(e) => onChange('sail_number', e.target.value)}
                />
                <label className="text-gray-500">Bow</label>
                <input
                  className="border rounded px-2 py-1"
                  value={form.bow_number ?? ''}
                  onChange={(e) => onChange('bow_number', e.target.value)}
                  placeholder="Número de proa (admin)"
                />
                {(form.boat_country_code || form.sail_number) && (
                  <>
                    <label className="text-gray-500">Preview</label>
                    <div className="text-sm font-medium">
                      <SailNumberDisplay countryCode={form.boat_country_code} sailNumber={form.sail_number} />
                    </div>
                  </>
                )}
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

                {isHandicapClass(form.class_name ?? '') && (
                  <>
                    <label className="text-gray-500">Model (handicap)</label>
                    <input
                      className="border rounded px-2 py-1"
                      value={form.boat_model ?? ''}
                      onChange={(e) => onChange('boat_model', e.target.value)}
                      placeholder="ex: Beneteau First 36.7"
                    />
                    <label className="text-gray-500 col-span-2">Owner (handicap)</label>
                    <input
                      className="border rounded px-2 py-1"
                      value={form.owner_first_name ?? ''}
                      onChange={(e) => onChange('owner_first_name', e.target.value)}
                      placeholder="Owner first name"
                    />
                    <input
                      className="border rounded px-2 py-1"
                      value={form.owner_last_name ?? ''}
                      onChange={(e) => onChange('owner_last_name', e.target.value)}
                      placeholder="Owner last name"
                    />
                    <input
                      type="email"
                      className="border rounded px-2 py-1 col-span-2"
                      value={form.owner_email ?? ''}
                      onChange={(e) => onChange('owner_email', e.target.value)}
                      placeholder="Owner email"
                    />
                  </>
                )}
              </div>
            </section>

            {/* Rating card (handicap) */}
            {isHandicapClass(form.class_name ?? '') && (
              <section className="bg-white rounded border p-4">
                <h2 className="font-semibold mb-3">Rating</h2>
                <div className="space-y-3 text-sm">
                  <div>
                    <label className="block text-gray-500 mb-1">Rating type</label>
                    <select
                      className="border rounded px-2 py-1.5 w-full max-w-xs"
                      value={form.rating_type ?? (form.rating != null ? 'anc' : 'none')}
                      onChange={(e) => {
                        const v = e.target.value;
                        const next = v === 'none' ? null : v;
                        onChange('rating_type', next);
                        if (next !== 'anc') onChange('rating', undefined);
                        if (next !== 'orc') {
                          onChange('orc_low', undefined);
                          onChange('orc_medium', undefined);
                          onChange('orc_high', undefined);
                        }
                      }}
                    >
                      <option value="none">None</option>
                      <option value="anc">ANC</option>
                      <option value="orc">ORC</option>
                    </select>
                  </div>
                  {((form.rating_type ?? (form.rating != null ? 'anc' : null)) === 'anc' || form.rating_type === 'orc') && (
                    <div className="space-y-2">
                      {(form.rating_type ?? (form.rating != null ? 'anc' : null)) === 'anc' && (
                        <div>
                          <label className="block text-gray-500 mb-1">ANC rating</label>
                          <input
                            type="number"
                            step="0.0001"
                            className="border rounded px-2 py-1.5 w-full max-w-xs"
                            value={form.rating ?? ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              onChange('rating', v === '' ? undefined : Number(v));
                            }}
                            placeholder="ex: 1.025"
                          />
                        </div>
                      )}
                      {form.rating_type === 'orc' && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-gray-500 mb-1">ORC Low</label>
                            <input
                              type="number"
                              step="0.0001"
                              className="border rounded px-2 py-1.5 w-full"
                              value={form.orc_low ?? ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                onChange('orc_low', v === '' ? undefined : Number(v));
                              }}
                              placeholder="ex: 0.95"
                            />
                          </div>
                          <div>
                            <label className="block text-gray-500 mb-1">ORC Medium</label>
                            <input
                              type="number"
                              step="0.0001"
                              className="border rounded px-2 py-1.5 w-full"
                              value={form.orc_medium ?? ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                onChange('orc_medium', v === '' ? undefined : Number(v));
                              }}
                              placeholder="ex: 1.00"
                            />
                          </div>
                          <div>
                            <label className="block text-gray-500 mb-1">ORC High</label>
                            <input
                              type="number"
                              step="0.0001"
                              className="border rounded px-2 py-1.5 w-full"
                              value={form.orc_high ?? ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                onChange('orc_high', v === '' ? undefined : Number(v));
                              }}
                              placeholder="ex: 1.05"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Sailors (One Design: helm + crew with positions) */}
            <section className="bg-white rounded border p-4 md:col-span-2">
              <h2 className="font-semibold mb-3">Sailors</h2>
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap items-center gap-2 p-2 rounded bg-gray-50">
                  <span className="font-medium">Helm:</span>
                  <span>{(form.first_name ?? '') + ' ' + (form.last_name ?? '')}</span>
                  <span className="text-gray-500">
                    (Position:
                    <select
                      className="ml-1 border rounded px-2 py-0.5"
                      value={form.helm_position ?? 'Skipper'}
                      onChange={(e) => onChange('helm_position', e.target.value)}
                    >
                      <option value="Skipper">Skipper</option>
                      <option value="Crew">Crew</option>
                    </select>
                    )
                  </span>
                </div>
                {(form.crew_members && (form.crew_members as any[]).length > 0) && (
                  <div className="space-y-2">
                    <span className="font-medium block">Crew members:</span>
                    {(form.crew_members as any[]).map((c: any, i: number) => (
                      <div key={i} className="flex flex-wrap items-center gap-2 p-2 rounded border bg-white">
                        <select
                          className="border rounded px-2 py-1"
                          value={c.position ?? 'Crew'}
                          onChange={(e) => {
                            const next = [...(form.crew_members as any[])];
                            next[i] = { ...next[i], position: e.target.value };
                            onChange('crew_members', next);
                          }}
                        >
                          <option value="Skipper">Skipper</option>
                          <option value="Crew">Crew</option>
                        </select>
                        <input
                          className="border rounded px-2 py-1 w-28"
                          placeholder="First name"
                          value={c.first_name ?? ''}
                          onChange={(e) => {
                            const next = [...(form.crew_members as any[])];
                            next[i] = { ...next[i], first_name: e.target.value };
                            onChange('crew_members', next);
                          }}
                        />
                        <input
                          className="border rounded px-2 py-1 w-28"
                          placeholder="Last name"
                          value={c.last_name ?? ''}
                          onChange={(e) => {
                            const next = [...(form.crew_members as any[])];
                            next[i] = { ...next[i], last_name: e.target.value };
                            onChange('crew_members', next);
                          }}
                        />
                        <input
                          type="email"
                          className="border rounded px-2 py-1 flex-1 min-w-[140px]"
                          placeholder="Email"
                          value={c.email ?? ''}
                          onChange={(e) => {
                            const next = [...(form.crew_members as any[])];
                            next[i] = { ...next[i], email: e.target.value };
                            onChange('crew_members', next);
                          }}
                        />
                        <input
                          className="border rounded px-2 py-1 w-28"
                          placeholder="Federation license"
                          value={c.federation_license ?? ''}
                          onChange={(e) => {
                            const next = [...(form.crew_members as any[])];
                            next[i] = { ...next[i], federation_license: e.target.value };
                            onChange('crew_members', next);
                          }}
                        />
                        <button
                          type="button"
                          className="text-red-600 text-xs hover:underline"
                          onClick={() => {
                            const next = (form.crew_members as any[]).filter((_, j) => j !== i);
                            onChange('crew_members', next);
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  className="text-sm text-blue-600 hover:underline"
                  onClick={() => onChange('crew_members', [...(form.crew_members || []), { position: 'Crew', first_name: '', last_name: '', email: '', federation_license: '' }])}
                >
                  + Add crew member
                </button>
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

                <label className="text-gray-500">Federation license</label>
                <input
                  className="border rounded px-2 py-1"
                  value={form.federation_license ?? ''}
                  onChange={(e) => onChange('federation_license', e.target.value)}
                  placeholder="Federation license"
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

            {/* ===== Documents (per-entry attachments) ===== */}
            <section className="bg-white rounded border p-4 md:col-span-2">
              <h2 className="font-semibold mb-3">Documents</h2>

              {/* Upload bar */}
              <UploadBar
                onUpload={async (file, title) => {
                  try {
                    await uploadAttachment(file, title);
                  } catch (e: any) {
                    alert(e?.message || 'Upload failed');
                  }
                }}
              />

              {attsLoading && <div className="text-gray-500 mt-3">Loading…</div>}
              {attsErr && <div className="text-red-600 mt-3">{attsErr}</div>}

              {/* Table */}
              <div className="overflow-x-auto rounded border bg-white mt-3">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 text-left">Title</th>
                      <th className="p-2 text-left">Filename</th>
                      <th className="p-2 text-left">Size</th>
                      <th className="p-2 text-left">Uploaded</th>
                      <th className="p-2 text-left">Link</th>
                      <th className="p-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!attsLoading && atts.length === 0 && (
                      <tr>
                        <td className="p-4 text-gray-500" colSpan={6}>
                          No documents yet.
                        </td>
                      </tr>
                    )}
                    {atts.map((a) => (
                      <AttachmentRow
                        key={a.id}
                        a={a}
                        onDelete={() => deleteAttachment(a.id)}
                        onRename={(newTitle) => renameAttachment(a.id, newTitle)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </div>
    </RequireAuth>
  );
}

/* ======================= Sub-componentes ======================= */

function humanSize(bytes: number) {
  if (!Number.isFinite(bytes)) return '—';
  const units = ['B','KB','MB','GB','TB'];
  let i = 0, n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 ? 1 : 0)} ${units[i]}`;
}

function UploadBar({
  onUpload,
}: {
  onUpload: (file: File, title: string) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!file) { alert('Choose a file'); return; }
    if (!title.trim()) { alert('Enter a title'); return; }
    try {
      setBusy(true);
      await onUpload(file, title.trim());
      setFile(null); setTitle('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col md:flex-row items-start md:items-end gap-2">
      <div>
        <label className="block text-sm mb-1">Title</label>
        <input
          className="border rounded px-3 py-2 w-64"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Medical certificate"
        />
      </div>
      <div>
        <label className="block text-sm mb-1">File (PDF)</label>
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="border rounded px-3 py-2"
        />
      </div>
      <button
        className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
        onClick={submit}
        disabled={busy}
      >
        {busy ? 'Uploading…' : 'Upload'}
      </button>
    </div>
  );
}

function AttachmentRow({
  a,
  onDelete,
  onRename,
}: {
  a: EntryAttachment;
  onDelete: () => void;
  onRename: (newTitle: string) => void;
}) {
  const [ed, setEd] = useState(false);
  const [title, setTitle] = useState(a.title || '');

  return (
    <tr className="border-t align-top">
      <td className="p-2">
        {!ed ? (
          <div className="font-medium">{a.title || '—'}</div>
        ) : (
          <input
            className="border rounded px-2 py-1 w-72"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        )}
      </td>
      <td className="p-2">{a.filename}</td>
      <td className="p-2">{humanSize(a.size_bytes)}</td>
      <td className="p-2">{new Date(a.uploaded_at).toLocaleString()}</td>
      <td className="p-2">
        {a.stored_path ? (
          <a
            href={a.stored_path}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            View
          </a>
        ) : '—'}
      </td>
      <td className="p-2 text-right">
        {!ed ? (
          <div className="inline-flex gap-3">
            <button className="text-blue-600 hover:underline" onClick={() => setEd(true)}>Rename</button>
            <button className="text-red-600 hover:underline" onClick={onDelete}>Delete</button>
          </div>
        ) : (
          <div className="inline-flex gap-3">
            <button
              className="text-blue-600 hover:underline"
              onClick={() => { onRename(title.trim()); setEd(false); }}
            >
              Save
            </button>
            <button className="text-gray-600 hover:underline" onClick={() => { setTitle(a.title || ''); setEd(false); }}>
              Cancel
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
