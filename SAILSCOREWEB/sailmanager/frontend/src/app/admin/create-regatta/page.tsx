'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import RequireAuth from '@/components/RequireAuth';
import { useAuth } from '@/context/AuthContext';
import { apiGet, apiSend } from '@/lib/api';

type CountryItem = { code: string; name: string };
type TimezonesResponse = { country: string; timezones: string[] };

export default function CreateRegattaPage() {
  const router = useRouter();
  const { token, user } = useAuth();

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [countries, setCountries] = useState<CountryItem[]>([]);
  const [countryCode, setCountryCode] = useState('');
  const [timezoneOptions, setTimezoneOptions] = useState<string[]>([]);
  const [timezone, setTimezone] = useState('');
  const [loadingTimezones, setLoadingTimezones] = useState(false);
  type OneDesignItem = { class_name: string; sailors_per_boat: number };
  const [selectedOneDesign, setSelectedOneDesign] = useState<OneDesignItem[]>([]);
  const [selectedHandicap, setSelectedHandicap] = useState<string[]>([]);
  const [newClassOD, setNewClassOD] = useState('');
  const [newSailorsOD, setNewSailorsOD] = useState(1);
  const [newClassH, setNewClassH] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const setSailorsOD = (className: string, sailors: number) => {
    setSelectedOneDesign((prev) =>
      prev.map((x) => (x.class_name === className ? { ...x, sailors_per_boat: sailors } : x))
    );
  };

  const removeOneDesign = (className: string) => {
    setSelectedOneDesign((prev) => prev.filter((c) => c.class_name !== className));
  };

  const addCustomOneDesign = () => {
    const c = newClassOD.trim();
    if (!c) return;
    const key = c.toLowerCase();
    if (selectedOneDesign.some((x) => x.class_name.toLowerCase() === key) || selectedHandicap.some((x) => x.toLowerCase() === key))
      return;
    setSelectedOneDesign((prev) => [...prev, { class_name: c, sailors_per_boat: newSailorsOD }].sort((a, b) => a.class_name.localeCompare(b.class_name)));
    setNewClassOD('');
  };

  const toggleHandicap = (className: string) => {
    setSelectedHandicap((prev) =>
      prev.includes(className) ? prev.filter((c) => c !== className) : [...prev, className]
    );
  };

  const addCustomHandicap = () => {
    const c = newClassH.trim();
    if (!c) return;
    const key = c.toLowerCase();
    if (selectedOneDesign.some((x) => x.class_name.toLowerCase() === key) || selectedHandicap.some((x) => x.toLowerCase() === key))
      return;
    setSelectedHandicap((prev) => [...prev, c].sort((a, b) => a.localeCompare(b)));
    setNewClassH('');
  };

  useEffect(() => {
    apiGet<CountryItem[]>('/metadata/countries')
      .then((data) => setCountries(Array.isArray(data) ? data : []))
      .catch(() => setCountries([]));
  }, []);

  useEffect(() => {
    if (!countryCode) {
      setTimezoneOptions([]);
      setTimezone('');
      return;
    }
    setLoadingTimezones(true);
    apiGet<TimezonesResponse>(`/metadata/timezones?country=${encodeURIComponent(countryCode)}`)
      .then((data) => {
        const tzList = data?.timezones ?? [];
        setTimezoneOptions(tzList);
        if (tzList.length === 1) {
          setTimezone(tzList[0]);
        } else if (!tzList.includes(timezone)) {
          setTimezone(tzList[0] ?? '');
        }
      })
      .catch(() => {
        setTimezoneOptions([]);
        setTimezone('');
      })
      .finally(() => setLoadingTimezones(false));
  }, [countryCode]);

  const handleCountryChange = (code: string) => {
    setCountryCode(code);
    if (!code) setTimezone('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      alert('No session. Please log in again.');
      router.push('/admin/login');
      return;
    }
    setSubmitting(true);
    try {
      // 1) Criar regata
      const regatta = await apiSend<{ id: number }>(
        '/regattas/',
        'POST',
        {
          name,
          location,
          start_date: startDate,
          end_date: endDate,
          country_code: countryCode || undefined,
          timezone: timezone || undefined,
        },
        token
      );

      // 2) Substituir classes (se houver)
      const classesPayload = [
        ...selectedOneDesign.map((c) => ({ class_name: c.class_name, class_type: 'one_design' as const, sailors_per_boat: c.sailors_per_boat })),
        ...selectedHandicap.map((c) => ({ class_name: c, class_type: 'handicap' as const })),
      ];
      if (classesPayload.length > 0) {
        await apiSend(
          `/regattas/${regatta.id}/classes`,
          'PUT',
          { classes: classesPayload },
          token
        );
      }

      // Ir para a página central (admin)
      router.push('/admin');
    } catch (err: any) {
      console.error('Create regatta error:', err);
      alert(err?.message || 'Error creating regatta.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RequireAuth roles={['admin']}>
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Create New Regatta</h1>

        <div className="mb-4 text-sm text-gray-600">
          Session: {user?.email ?? '—'} {token ? '✅' : '❌'}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 shadow rounded">
          <input
            type="text"
            placeholder="Regatta name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border p-2 rounded"
            required
          />
          <input
            type="text"
            placeholder="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full border p-2 rounded"
            required
          />
          <div>
            <label className="block text-sm font-medium mb-1">Country & timezone</label>
            <p className="text-xs text-gray-500 mb-2">
              Used for official event times, notices, and result publication timestamps. Select country first, then timezone.
            </p>
            <div className="flex gap-3 flex-wrap">
              <select
                value={countryCode}
                onChange={(e) => handleCountryChange(e.target.value)}
                className="border p-2 rounded min-w-[140px]"
              >
                <option value="">— Select country —</option>
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                disabled={!countryCode || loadingTimezones}
                className="border p-2 rounded flex-1 min-w-[180px] disabled:opacity-60 disabled:bg-gray-100"
              >
                <option value="">
                  {!countryCode ? 'Select country first' : loadingTimezones ? 'Loading…' : '— Select timezone —'}
                </option>
                {timezoneOptions.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-4">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border p-2 rounded"
              required
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border p-2 rounded"
              required
            />
          </div>

          <div>
            <p className="font-medium mb-2">Classes</p>
            <p className="text-xs text-gray-500 mb-3">Add One Design and Handicap classes separately.</p>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="border rounded p-3">
                <h4 className="text-sm font-semibold mb-2">One Design</h4>
                <p className="text-xs text-gray-500 mb-2">Enter the class name and choose the number of sailors per boat (crew size).</p>
                {selectedOneDesign.length > 0 && (
                  <div className="mb-3 space-y-1">
                    {selectedOneDesign.map((item) => (
                      <div key={item.class_name} className="flex items-center gap-2 text-sm flex-wrap">
                        <span className="font-medium">{item.class_name}</span>
                        <label className="text-xs text-gray-600">Sailors per boat:</label>
                        <select value={item.sailors_per_boat} onChange={(e) => setSailorsOD(item.class_name, Number(e.target.value))} className="border rounded px-1.5 py-0.5 text-sm w-14" title="Number of sailors in the crew">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => removeOneDesign(item.class_name)}
                          className="text-red-600 hover:underline"
                          aria-label="Remove"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 flex-wrap items-end">
                  <input
                    className="border rounded px-2 py-1.5 flex-1 min-w-[120px] text-sm"
                    placeholder="Class name (e.g. Optimist, 420)"
                    value={newClassOD}
                    onChange={(e) => setNewClassOD(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomOneDesign())}
                  />
                  <label className="text-xs text-gray-600 shrink-0">Sailors per boat:</label>
                  <select value={newSailorsOD} onChange={(e) => setNewSailorsOD(Number(e.target.value))} className="border rounded px-2 py-1.5 text-sm w-20" title="Number of sailors in the crew">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  <button type="button" className="border rounded px-2 py-1.5 bg-gray-100 hover:bg-gray-200" onClick={addCustomOneDesign}>
                    Add
                  </button>
                </div>
              </div>

              <div className="border rounded p-3">
                <h4 className="text-sm font-semibold mb-2">Handicap</h4>
                <p className="text-xs text-gray-500 mb-2">e.g. ANC A, ANC B, IRC, ORC…</p>
                <div className="flex flex-wrap gap-1 mb-2">
                  {selectedHandicap.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded text-sm"
                    >
                      {c}
                      <button
                        type="button"
                        onClick={() => toggleHandicap(c)}
                        className="text-red-600 hover:underline"
                        aria-label="Remove"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <input
                    className="border rounded px-2 py-1.5 flex-1 text-sm"
                    placeholder="e.g. ANC A"
                    value={newClassH}
                    onChange={(e) => setNewClassH(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomHandicap())}
                  />
                  <button type="button" className="border rounded px-2 py-1.5 bg-gray-100 hover:bg-gray-200" onClick={addCustomHandicap}>
                    Add
                  </button>
                </div>
              </div>
            </div>

            {(selectedOneDesign.length > 0 || selectedHandicap.length > 0) && (
              <p className="text-xs text-gray-600 mt-2">
                One Design: {selectedOneDesign.map((c) => `${c.class_name} (${c.sailors_per_boat} sailors/boat)`).join(', ') || '—'} | Handicap: {selectedHandicap.join(', ') || '—'}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Create Regatta'}
          </button>
        </form>
      </div>
    </RequireAuth>
  );
}
