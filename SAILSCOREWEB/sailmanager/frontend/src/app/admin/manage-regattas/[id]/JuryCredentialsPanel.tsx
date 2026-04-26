'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiDelete, apiGet, apiPost, apiSend } from '@/lib/api';

export type JuryProfile = {
  id: number;
  regatta_id: number;
  display_name: string;
  note: string | null;
  has_credentials: boolean;
  username?: string | null;
  credentials_role?: 'jury' | 'scorer' | null;
};

type JuryCredentialsOut = {
  username: string;
  password: string;
  role: 'jury' | 'scorer';
  message?: string;
};

type JuryProfileCreateResult = {
  profile: JuryProfile;
  credentials: JuryCredentialsOut | null;
};

export default function JuryCredentialsPanel({ regattaId }: { regattaId: number }) {
  const { token } = useAuth();
  const [rows, setRows] = useState<JuryProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [credentialsRole, setCredentialsRole] = useState<'jury' | 'scorer'>('jury');

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editNote, setEditNote] = useState('');

  const [credModal, setCredModal] = useState<JuryCredentialsOut | null>(null);
  const [detailsProfile, setDetailsProfile] = useState<JuryProfile | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      const data = await apiGet<JuryProfile[]>(`/regattas/${regattaId}/jury-profiles`, token);
      setRows(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load jury profiles.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [regattaId, token]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const name = displayName.trim();
    if (!name || !token) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiPost<JuryProfileCreateResult>(
        `/regattas/${regattaId}/jury-profiles`,
        {
          display_name: name,
          note: note.trim() || null,
          credentials_role: credentialsRole,
        },
        token
      );
      setDisplayName('');
      setNote('');
      if (res.credentials) {
        setCredModal(res.credentials);
      }
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not create profile.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!token || !confirm('Delete this jury profile and its login user (if any)?')) return;
    setError(null);
    try {
      await apiDelete(`/regattas/${regattaId}/jury-profiles/${id}`, token);
      if (detailsProfile?.id === id) setDetailsProfile(null);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not delete.');
    }
  }

  async function handleRegeneratePassword(id: number) {
    if (!token) return;
    setError(null);
    try {
      const out = await apiSend<JuryCredentialsOut>(
        `/regattas/${regattaId}/jury-profiles/${id}/credentials`,
        'POST',
        { credentials_role: credentialsRole },
        token
      );
      setDetailsProfile(null);
      setCredModal(out);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not regenerate password.');
    }
  }

  async function saveEdit(id: number) {
    if (!token) return;
    const name = editName.trim();
    if (!name) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await apiSend<JuryProfile>(
        `/regattas/${regattaId}/jury-profiles/${id}`,
        'PATCH',
        { display_name: name, note: editNote.trim() || null },
        token
      );
      setEditingId(null);
      await load();
      if (detailsProfile?.id === id) {
        setDetailsProfile((prev) =>
          prev && updated ? { ...prev, display_name: updated.display_name, note: updated.note } : prev
        );
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(r: JuryProfile) {
    setEditingId(r.id);
    setEditName(r.display_name);
    setEditNote(r.note ?? '');
  }

  return (
    <div className="p-6 bg-white rounded shadow max-w-4xl space-y-8" data-regatta-id={regattaId}>
      <div>
        <h2 className="text-xl font-semibold mb-2">Jury / Scorer credentials</h2>
        <p className="text-sm text-gray-600">
          Adding a profile <strong>automatically creates login credentials</strong> (username and password). Use{' '}
          <strong>See account details</strong> to view the username anytime; the password is only shown when created
          or after you regenerate it.
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Example sign-in URL for this regatta:{' '}
          <code className="bg-gray-100 px-1 rounded break-all">/login?regattaId={regattaId}</code>
        </p>
      </div>

      <form onSubmit={handleAdd} className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-800">Add staff profile</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm">
            <span className="text-gray-700">Name *</span>
            <input
              className="mt-1 w-full border rounded px-3 py-2 text-sm"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Jane Doe (chair)"
              maxLength={200}
              required
            />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="text-gray-700">Short note (optional)</span>
            <input
              className="mt-1 w-full border rounded px-3 py-2 text-sm"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. International jury"
              maxLength={500}
            />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="text-gray-700">Credentials role</span>
            <select
              className="mt-1 w-full border rounded px-3 py-2 text-sm bg-white"
              value={credentialsRole}
              onChange={(e) => setCredentialsRole(e.target.value as 'jury' | 'scorer')}
            >
              <option value="jury">Jury</option>
              <option value="scorer">Scorer</option>
            </select>
          </label>
        </div>
        <button
          type="submit"
          disabled={saving || !displayName.trim()}
          className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium disabled:opacity-50"
        >
          {saving ? 'Saving…' : `Add profile (${credentialsRole})`}
        </button>
      </form>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-2">Profiles</h3>
        {loading && <p className="text-sm text-gray-500">Loading…</p>}
        {!loading && rows.length === 0 && (
          <p className="text-sm text-gray-500">No jury profiles yet. Add one above.</p>
        )}
        {!loading && rows.length > 0 && (
          <div className="overflow-x-auto rounded border">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="p-3 font-medium">Name</th>
                  <th className="p-3 font-medium">Note</th>
                  <th className="p-3 font-medium">Username</th>
                  <th className="p-3 font-medium">Role</th>
                  <th className="p-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t align-top">
                    <td className="p-3">
                      {editingId === r.id ? (
                        <input
                          className="w-full border rounded px-2 py-1 text-sm"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          maxLength={200}
                        />
                      ) : (
                        <span className="font-medium">{r.display_name}</span>
                      )}
                    </td>
                    <td className="p-3 text-gray-700 max-w-xs">
                      {editingId === r.id ? (
                        <input
                          className="w-full border rounded px-2 py-1 text-sm"
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          maxLength={500}
                        />
                      ) : (
                        r.note || '—'
                      )}
                    </td>
                    <td className="p-3 font-mono text-xs text-gray-800">
                      {r.username ? (
                        <span className="break-all">{r.username}</span>
                      ) : (
                        <span className="text-amber-700">Pending</span>
                      )}
                    </td>
                    <td className="p-3 text-xs">
                      {r.credentials_role ? (
                        <span className="inline-flex rounded bg-gray-100 px-2 py-1 font-medium uppercase">
                          {r.credentials_role}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      {editingId === r.id ? (
                        <div className="inline-flex gap-2">
                          <button
                            type="button"
                            className="text-blue-600 hover:underline text-sm"
                            onClick={() => saveEdit(r.id)}
                            disabled={saving}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="text-gray-600 hover:underline text-sm"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex flex-wrap gap-2 justify-end">
                          <button
                            type="button"
                            className="text-blue-600 hover:underline text-sm"
                            onClick={() => startEdit(r)}
                          >
                            Edit
                          </button>
                          {r.has_credentials && (
                            <button
                              type="button"
                              className="text-gray-800 hover:underline text-sm font-medium"
                              onClick={() => setDetailsProfile(r)}
                            >
                              See account details
                            </button>
                          )}
                          {r.has_credentials ? (
                            <button
                              type="button"
                              className="text-emerald-700 hover:underline text-sm"
                              onClick={() => handleRegeneratePassword(r.id)}
                            >
                              Regenerate password
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="text-emerald-700 hover:underline text-sm font-medium"
                              onClick={() => handleRegeneratePassword(r.id)}
                            >
                              Issue credentials
                            </button>
                          )}
                          <button
                            type="button"
                            className="text-red-600 hover:underline text-sm"
                            onClick={() => handleDelete(r.id)}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {credModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <h4 className="text-lg font-semibold">
              {credModal.role === 'scorer' ? 'Scorer login credentials' : 'Jury login credentials'}
            </h4>
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
              {credModal.message || 'Copy and share now. The password cannot be retrieved later.'}
            </p>
            <dl className="text-sm space-y-2">
              <div>
                <dt className="text-gray-500">Username</dt>
                <dd className="font-mono break-all select-all">{credModal.username}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Password</dt>
                <dd className="font-mono break-all select-all">{credModal.password}</dd>
              </div>
            </dl>
            <button
              type="button"
              className="w-full py-2 rounded bg-gray-900 text-white text-sm"
              onClick={() => setCredModal(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {detailsProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <h4 className="text-lg font-semibold">Account details</h4>
            <p className="text-sm text-gray-600">Profile: {detailsProfile.display_name}</p>
            <dl className="text-sm space-y-2">
              <div>
                <dt className="text-gray-500">Username (for sign-in)</dt>
                <dd className="font-mono break-all select-all">{detailsProfile.username ?? '—'}</dd>
              </div>
            </dl>
            <p className="text-xs text-gray-500">
              The password is stored securely and cannot be shown here. Use{' '}
              <strong>Regenerate password</strong> on the row to create a new password and share it with the staff
              member.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 py-2 rounded border text-sm"
                onClick={() => setDetailsProfile(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="flex-1 py-2 rounded bg-emerald-600 text-white text-sm"
                onClick={() => {
                  const id = detailsProfile.id;
                  setDetailsProfile(null);
                  void handleRegeneratePassword(id);
                }}
              >
                Regenerate password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
