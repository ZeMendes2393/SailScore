'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { apiGet, apiSend } from '@/lib/api';
import RequireAuth from '@/components/RequireAuth';
import AdminNoticeBoard from './noticeboard/AdminNoticeBoard';
import AdminEntryList from './entries/AdminEntryList';

interface Regatta {
  id: number;
  name: string;
  location: string;
  start_date: string;
  end_date: string;
  online_entry_open?: boolean;
  entry_list_columns?: string[] | Record<string, string[]> | null;
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
  type OneDesignItem = { class_name: string; sailors_per_boat: number };
  const [editClassesOneDesign, setEditClassesOneDesign] = useState<OneDesignItem[]>([]);
  const [editClassesHandicap, setEditClassesHandicap] = useState<string[]>([]);
  const [newClassNameOD, setNewClassNameOD] = useState('');
  const [newSailorsOD, setNewSailorsOD] = useState(1);
  const [newClassNameH, setNewClassNameH] = useState('');

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
      try {
        const data = await apiGet<{ class_name: string; class_type?: string; sailors_per_boat?: number }[]>(
          `/regattas/${regattaId}/classes/detailed`
        );
        const list = Array.isArray(data) ? data : [];
        setAvailableClasses(list.map((c) => c.class_name));
      } catch {
        const simple = await apiGet<string[]>(`/regattas/${regattaId}/classes`).catch(() => []);
        setAvailableClasses(Array.isArray(simple) ? simple : []);
      }
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

      const classesPayload = [
        ...editClassesOneDesign.map((c) => ({
          class_name: c.class_name,
          class_type: 'one_design' as const,
          sailors_per_boat: c.sailors_per_boat,
        })),
        ...editClassesHandicap.map((c) => ({ class_name: c, class_type: 'handicap' as const })),
      ];
      await apiSend<unknown>(
        `/regattas/${regattaId}/classes`,
        'PUT',
        { classes: classesPayload },
        token
      );
      setAvailableClasses([...editClassesOneDesign.map((c) => c.class_name), ...editClassesHandicap]);

      alert('Regatta and classes updated.');
      setActiveTab(null);
    } catch (err: any) {
      alert(err?.message || 'Failed to update regatta.');
    } finally {
      setSaving(false);
    }
  };

  const openEditTab = async () => {
    try {
      const data = await apiGet<{ class_name: string; class_type?: string; sailors_per_boat?: number }[]>(
        `/regattas/${regattaId}/classes/detailed`
      );
      const list = Array.isArray(data) ? data : [];
      setEditClassesOneDesign(
        list
          .filter((c) => (c.class_type || 'one_design') !== 'handicap')
          .map((c) => ({ class_name: c.class_name, sailors_per_boat: c.sailors_per_boat ?? 1 }))
      );
      setEditClassesHandicap(list.filter((c) => (c.class_type || '') === 'handicap').map((c) => c.class_name));
    } catch {
      setEditClassesOneDesign([]);
      setEditClassesHandicap([]);
    }
    setActiveTab('edit');
  };

  const addEditClassOD = () => {
    const c = newClassNameOD.trim();
    if (!c) return;
    const key = c.toLowerCase();
    if (editClassesOneDesign.some((x) => x.class_name.toLowerCase() === key) || editClassesHandicap.some((x) => x.toLowerCase() === key)) {
      alert('Essa classe já está na lista.');
      return;
    }
    setEditClassesOneDesign((prev) => [...prev, { class_name: c, sailors_per_boat: newSailorsOD }].sort((a, b) => a.class_name.localeCompare(b.class_name)));
    setNewClassNameOD('');
  };

  const setSailorsForOD = (className: string, sailors: number) => {
    setEditClassesOneDesign((prev) =>
      prev.map((x) => (x.class_name === className ? { ...x, sailors_per_boat: sailors } : x))
    );
  };

  const addEditClassH = () => {
    const c = newClassNameH.trim();
    if (!c) return;
    const key = c.toLowerCase();
    if (editClassesOneDesign.some((x) => x.class_name.toLowerCase() === key) || editClassesHandicap.some((x) => x.toLowerCase() === key)) {
      alert('Essa classe já está na lista.');
      return;
    }
    setEditClassesHandicap((prev) => [...prev, c].sort((a, b) => a.localeCompare(b)));
    setNewClassNameH('');
  };

  const removeEditClassOD = (className: string) => {
    setEditClassesOneDesign((prev) => prev.filter((c) => c.class_name !== className));
  };

  const removeEditClassH = (className: string) => {
    setEditClassesHandicap((prev) => prev.filter((c) => c !== className));
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
    <RequireAuth roles={['admin']}>
      {!regatta ? (
        <p className="p-8">Loading regatta…</p>
      ) : (
    <main className="min-h-screen p-8 bg-gray-50">
      {/* Voltar ao dashboard / lista de campeonatos */}
      <div className="mb-4">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
        >
          ← Voltar à lista de campeonatos
        </Link>
      </div>

      {/* Header */}
      <div className="bg-white shadow rounded p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">{regatta.name}</h1>
            <p className="text-gray-600">
              {regatta.location} | {regatta.start_date} – {regatta.end_date}
            </p>
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
        <button onClick={openEditTab} className="hover:underline">
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
          {activeTab === 'entry' && (
            <AdminEntryList
              regattaId={regattaId}
              selectedClass={selectedClass}
              regatta={regatta}
              onRegattaUpdate={(r) => setRegatta((prev) => (prev ? { ...prev, ...r } : null))}
            />
          )}

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

            {/* Classes da regata: One Design e Handicap */}
            <div>
              <label className="block text-sm font-medium mb-2">Classes</label>
              <p className="text-xs text-gray-500 mb-2">
                Classes incluídas neste campeonato, separadas por tipo.
              </p>

              <div className="grid md:grid-cols-2 gap-4 mb-3">
                <div className="border rounded p-3">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">One Design</h4>
                  <p className="text-xs text-gray-500 mb-2">Nº de velejadores por embarcação (para inscrição).</p>
                  <ul className="divide-y mb-2">
                    {editClassesOneDesign.length === 0 ? (
                      <li className="px-2 py-1 text-gray-500 text-sm">Nenhuma</li>
                    ) : (
                      editClassesOneDesign.map((item) => (
                        <li key={item.class_name} className="px-2 py-1.5 flex justify-between items-center gap-2">
                          <span className="font-medium">{item.class_name}</span>
                          <span className="flex items-center gap-1">
                            <label className="text-xs text-gray-600">Velejadores:</label>
                            <select
                              value={item.sailors_per_boat}
                              onChange={(e) => setSailorsForOD(item.class_name, Number(e.target.value))}
                              className="border rounded px-1.5 py-0.5 text-sm w-14"
                            >
                              {[1, 2, 3, 4, 5].map((n) => (
                                <option key={n} value={n}>{n}</option>
                              ))}
                            </select>
                            <button type="button" onClick={() => removeEditClassOD(item.class_name)} className="text-red-600 hover:underline text-xs">Remover</button>
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                  <div className="flex gap-2 flex-wrap items-end">
                    <input
                      type="text"
                      className="flex-1 min-w-[100px] border rounded px-2 py-1.5 text-sm"
                      placeholder="ex: ILCA 7"
                      value={newClassNameOD}
                      onChange={(e) => setNewClassNameOD(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEditClassOD())}
                    />
                    <span className="flex items-center gap-1">
                      <label className="text-xs text-gray-600">Velejadores:</label>
                      <select value={newSailorsOD} onChange={(e) => setNewSailorsOD(Number(e.target.value))} className="border rounded px-2 py-1.5 text-sm w-14">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </span>
                    <button type="button" onClick={addEditClassOD} className="px-2 py-1.5 rounded border bg-gray-50 text-sm">+</button>
                  </div>
                </div>

                <div className="border rounded p-3">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Handicap</h4>
                  <ul className="divide-y mb-2">
                    {editClassesHandicap.length === 0 ? (
                      <li className="px-2 py-1 text-gray-500 text-sm">Nenhuma</li>
                    ) : (
                      editClassesHandicap.map((cls) => (
                        <li key={cls} className="px-2 py-1 flex justify-between items-center">
                          <span>{cls}</span>
                          <button type="button" onClick={() => removeEditClassH(cls)} className="text-red-600 hover:underline text-xs">Remover</button>
                        </li>
                      ))
                    )}
                  </ul>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 border rounded px-2 py-1.5 text-sm"
                      placeholder="ex: ANC A, ANC B"
                      value={newClassNameH}
                      onChange={(e) => setNewClassNameH(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEditClassH())}
                    />
                    <button type="button" onClick={addEditClassH} className="px-2 py-1.5 rounded border bg-gray-50 text-sm">+</button>
                  </div>
                </div>
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
      )}
    </RequireAuth>
  );
}
