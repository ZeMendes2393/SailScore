'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiGet, apiSend } from '@/lib/api';
import AdminNoticeBoard from './noticeboard/AdminNoticeBoard';
import AdminEntryList from './entries/AdminEntryList';

interface Regatta {
  id: number;
  name: string;
  location: string;
  start_date: string;
  end_date: string;
  status?: string;
  online_entry_open?: boolean; // <-- NEW
}

type Tab = 'entry' | 'notice' | 'form' | 'edit' | 'delete';

export default function AdminRegattaPage() {
  const { id } = useParams();
  const regattaId = parseInt(id as string);
  const router = useRouter();
  const { token, user } = useAuth();

  const [regatta, setRegatta] = useState<Regatta | null>(null);
  const [activeTab, setActiveTab] = useState<Tab | null>(null);

  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // edit form
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    const fetchRegatta = async () => {
      const r = await apiGet<Regatta>(`/regattas/${regattaId}`).catch(() => null);
      if (r) {
        // default true when backend doesn't yet send the field
        if (typeof r.online_entry_open === 'undefined') r.online_entry_open = true;
        setRegatta(r);
        setName(r.name);
        setLocation(r.location);
        setStartDate(r.start_date);
        setEndDate(r.end_date);
      }
    };

    const fetchClasses = async () => {
      const data = await apiGet<string[]>(`/regattas/${regattaId}/classes`).catch(() => []);
      setAvailableClasses(Array.isArray(data) ? data : []);
    };

    if (Number.isFinite(regattaId)) {
      fetchRegatta();
      fetchClasses();
    }
  }, [regattaId]);

  useEffect(() => {
    if (activeTab === 'entry' && !selectedClass && availableClasses.length > 0) {
      setSelectedClass(availableClasses[0] ?? null);
    }
  }, [activeTab, availableClasses, selectedClass]);

  if (!regatta) return <p className="p-8">Loading regatta…</p>;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      alert('Session missing. Please log in as admin.');
      router.push('/admin/login');
      return;
    }
    setSaving(true);
    try {
      const patched = await apiSend<Regatta>(
        `/regattas/${regattaId}`,
        'PATCH',
        { name, location, start_date: startDate, end_date: endDate },
        token
      );
      setRegatta(prev => ({ ...(patched || prev), online_entry_open: prev?.online_entry_open ?? true }));
      alert('Regatta updated.');
      setActiveTab(null);
    } catch (err: any) {
      alert(err?.message || 'Failed to update regatta.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!token) {
      alert('Session missing. Please log in as admin.');
      router.push('/admin/login');
      return;
    }
    if (!confirm('Are you sure you want to delete this regatta? This cannot be undone.')) return;

    setDeleting(true);
    try {
      await apiSend(`/regattas/${regattaId}`, 'DELETE', {}, token);
      alert('Regatta deleted.');
      router.replace('/admin');
    } catch (err: any) {
      alert(err?.message || 'Failed to delete regatta.');
    } finally {
      setDeleting(false);
    }
  };

  async function toggleOnlineEntry(next: boolean) {
    if (!token) {
      alert('Session missing. Please log in as admin.');
      router.push('/admin/login');
      return;
    }
    // optimistic
    setRegatta(r => (r ? { ...r, online_entry_open: next } : r));
    try {
      await apiSend(`/regattas/${regattaId}`, 'PATCH', { online_entry_open: next }, token);
    } catch (e: any) {
      // rollback
      setRegatta(r => (r ? { ...r, online_entry_open: !next } : r));
      alert(e?.message || 'Failed to update online entry state.');
    }
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow rounded p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">{regatta.name}</h1>
            <p className="text-gray-600">
              {regatta.location} | {regatta.start_date} – {regatta.end_date}
            </p>
            <span className="bg-blue-200 text-blue-800 px-2 py-1 rounded text-xs mt-2 inline-block">
              {regatta.status || 'Scheduled'}
            </span>
          </div>
          <div className="text-xs text-gray-500">{user?.email ? <>Admin: <b>{user.email}</b></> : null}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white shadow rounded mb-4 px-6 py-4 flex gap-6 text-blue-600 font-semibold flex-wrap">
        <button onClick={() => setActiveTab('entry')} className="hover:underline">
          Entry List
        </button>
        <button onClick={() => setActiveTab('notice')} className="hover:underline">
          Notice Board
        </button>
        <button onClick={() => setActiveTab('form')} className="hover:underline">
          Online Entry
        </button>

        {/* Results agora é navegação para Overall */}
        <button
          onClick={() => router.push(`/admin/manage-regattas/${regattaId}/overall`)}
          className="hover:underline"
        >
          Results
        </button>

        <span className="mx-2 text-gray-300">|</span>
        <button onClick={() => setActiveTab('edit')} className="hover:underline">
          Edit
        </button>
        <button onClick={() => setActiveTab('delete')} className="hover:underline text-red-600">
          Delete
        </button>
      </div>

      {/* Class selector (Entry List only) */}
      {activeTab === 'entry' && availableClasses.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {availableClasses.map((cls) => (
            <button
              key={cls}
              onClick={() => setSelectedClass(cls)}
              className={`px-3 py-1 rounded font-semibold border ${
                selectedClass === cls ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 border-blue-600'
              }`}
            >
              {cls}
            </button>
          ))}
        </div>
      )}

      {/* Narrow cards (Entry / Notice / Online Entry) */}
      {activeTab !== 'edit' && activeTab !== 'delete' && (
        <div className="p-6 bg-white rounded shadow">
          {activeTab === 'entry' && <AdminEntryList regattaId={regattaId} selectedClass={selectedClass} />}

          {activeTab === 'notice' && <AdminNoticeBoard regattaId={regattaId} />}

          {activeTab === 'form' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Online Entry</h2>
                  <p className="text-sm text-gray-500">Control whether sailors can submit new online entries.</p>
                </div>
                <label className="inline-flex items-center gap-3 cursor-pointer">
                  <span className="text-sm">Allow online entries</span>
                  <button
                    type="button"
                    onClick={() => toggleOnlineEntry(!regatta.online_entry_open)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                      regatta.online_entry_open ? 'bg-emerald-500' : 'bg-gray-300'
                    }`}
                    aria-pressed={regatta.online_entry_open ? 'true' : 'false'}
                    aria-label="Toggle online entries"
                    title={regatta.online_entry_open ? 'Online entry is enabled' : 'Online entry is disabled'}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                        regatta.online_entry_open ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </label>
              </div>

              <div className="rounded border p-3 text-sm">
                <p className="text-gray-700">
                  Current state:{' '}
                  {regatta.online_entry_open ? (
                    <span className="text-emerald-700 font-medium">OPEN</span>
                  ) : (
                    <span className="text-red-700 font-medium">CLOSED</span>
                  )}
                </p>
                <p className="text-gray-500 mt-2">
                  Admins cannot submit entries here — this area only exposes the toggle for consistency.
                </p>
              </div>
            </div>
          )}

          {!activeTab && <p className="text-gray-600">Choose a section above to see this regatta’s details.</p>}
        </div>
      )}

      {/* EDIT */}
      {activeTab === 'edit' && (
        <div className="p-6 bg-white rounded shadow max-w-2xl">
          <h2 className="text-xl font-semibold mb-4">Edit regatta</h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Name</label>
              <input
                className="w-full border rounded px-3 py-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Location</label>
              <input
                className="w-full border rounded px-3 py-2"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
              />
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1">Start date</label>
                <input
                  type="date"
                  className="w-full border rounded px-3 py-2"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm mb-1">End date</label>
                <input
                  type="date"
                  className="w-full border rounded px-3 py-2"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              <button type="button" onClick={() => setActiveTab(null)} className="px-4 py-2 rounded border">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DELETE */}
      {activeTab === 'delete' && (
        <div className="p-6 bg-white rounded shadow max-w-2xl">
          <h2 className="text-xl font-semibold mb-2 text-red-700">Delete regatta</h2>
          <p className="text-sm text-gray-700">
            This action is <b>irreversible</b>. It will delete <b>{regatta.name}</b> and all related data (entries,
            races, results, protests, etc.).
          </p>
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 rounded bg-red-600 text-white disabled:opacity-60"
            >
              {deleting ? 'Deleting…' : 'Delete permanently'}
            </button>
            <button onClick={() => setActiveTab(null)} className="px-4 py-2 rounded border">
              Cancel
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
