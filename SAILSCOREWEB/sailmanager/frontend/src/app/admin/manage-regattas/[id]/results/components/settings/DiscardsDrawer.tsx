'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import notify from '@/lib/notify';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '');

type Props = {
  regattaId: number;
  class_name: string;
  onClose: () => void;
  races?: Array<{ id: number; name?: string; class_name?: string; order_index?: number }>;
  lockClassSelect?: boolean;
};

type DiscardPlanOut = {
  regatta_id: number;
  class_name: string;
  is_active: boolean;
  label?: string | null;
  schedule: number[];
};
const DEFAULT_DISCARD_SCHEDULE = '0,0,0,1,1,1,1,1,1,1,1,1,1';

function parseSchedule(input: string) {
  const tokens = input
    .split(/[\s,;]+/g)
    .map((t) => t.trim())
    .filter(Boolean);

  const schedule: number[] = [];
  const invalid: string[] = [];

  for (const t of tokens) {
    if (!/^-?\d+$/.test(t)) {
      invalid.push(t);
      continue;
    }
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0) {
      invalid.push(t);
      continue;
    }
    schedule.push(Math.floor(n));
  }

  return { schedule, invalid };
}

function discardCountFromSchedule(schedule: number[], nRaces: number) {
  if (!schedule.length || nRaces <= 0) return 0;
  if (nRaces <= schedule.length) return schedule[nRaces - 1] ?? 0;
  return schedule[schedule.length - 1] ?? 0;
}

export default function DiscardsDrawer({
  regattaId,
  class_name,
  onClose,
  races,
  lockClassSelect = false,
}: Props) {
  const { token } = useAuth() as any;

  const [classes, setClasses] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>(class_name);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [scheduleText, setScheduleText] = useState<string>(DEFAULT_DISCARD_SCHEDULE);

  useEffect(() => {
    setSelectedClass(class_name);
  }, [class_name]);

  // load classes
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/regattas/${regattaId}/classes`, {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const data: string[] = await res.json();
        setClasses(data || []);
      } catch (error) {
        console.error('Error fetching classes:', error);
      }
    })();
  }, [regattaId, token]);

  // load plan (schedule)
  useEffect(() => {
    if (!selectedClass) return;
    setLoading(true);

    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/regattas/${regattaId}/classes/${encodeURIComponent(selectedClass)}/discard-schedule`,
          {
            credentials: 'include',
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          }
        );
        const data: DiscardPlanOut = await res.json();
        const next = (data.schedule ?? []).join(',').trim();
        setScheduleText(next || DEFAULT_DISCARD_SCHEDULE);
      } catch (error) {
        console.error('Error fetching discard plan:', error);
        setScheduleText(DEFAULT_DISCARD_SCHEDULE);
      } finally {
        setLoading(false);
      }
    })();
  }, [regattaId, selectedClass, token]);

  const racesForClass = useMemo(() => {
    const list = (races ?? []).filter((r) => r.class_name === selectedClass);
    return list.slice().sort((a, b) => (a.order_index ?? a.id) - (b.order_index ?? b.id));
  }, [races, selectedClass]);

  const parsed = useMemo(() => parseSchedule(scheduleText), [scheduleText]);

  const nRaces = racesForClass.length;
  const currentD = useMemo(() => discardCountFromSchedule(parsed.schedule, nRaces), [parsed.schedule, nRaces]);

  const save = async () => {
    if (!selectedClass) return;

    if (parsed.schedule.length === 0) {
      notify.warning('Schedule is empty. Use something like: 0,0,0,1,1,1');
      return;
    }
    if (parsed.invalid.length) {
      notify.warning(`Invalid values in schedule: ${parsed.invalid.join(', ')}`);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(
        `${API_BASE}/regattas/${regattaId}/classes/${encodeURIComponent(selectedClass)}/discard-schedule`,
        {
          method: 'PUT',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            is_active: true,
            label: null,
            schedule: parsed.schedule,
          }),
        }
      );
      if (!res.ok) throw new Error(await res.text().catch(() => ''));
      notify.success('Discard schedule saved.');
    } catch (e: any) {
      console.error('Error saving discard plan:', e);
      notify.error(e?.message || 'Failed to save discard schedule.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      <div className="absolute right-0 top-0 h-full w-full max-w-[560px] bg-white shadow-xl p-5 overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Discards (Standard)</h3>
          <button onClick={onClose} className="px-3 py-1 rounded border hover:bg-gray-50">
          Close
          </button>
        </div>

        {/* Class */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Class</label>

          {lockClassSelect ? (
            <div className="border rounded px-3 py-2 bg-gray-50 text-sm">{selectedClass}</div>
          ) : (
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="border rounded px-3 py-2 w-full"
            >
              {(classes ?? []).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-gray-600">Loading…</p>
        ) : (
          <>
            {/* Schedule */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-1">Schedule</label>
              <input
                value={scheduleText}
                onChange={(e) => setScheduleText(e.target.value)}
                className="border rounded px-3 py-2 w-full"
                placeholder="e.g. 0,0,0,1,1,1,2,2,2"
              />

              <div className="mt-2 text-sm text-gray-600 border rounded p-2 bg-gray-50">
                <div>
                  <span className="font-medium">Preview:</span>{' '}
                  {parsed.schedule.length ? parsed.schedule.join(',') : '—'}
                </div>
                <div className="mt-1">
                  <span className="font-medium">Races in class:</span> {nRaces} →{' '}
                  <span className="font-medium">Discards now:</span> {currentD}
                </div>
                {!!parsed.invalid.length && (
                  <div className="mt-1 text-red-600">
                    Invalid: {parsed.invalid.join(', ')}
                  </div>
                )}
              </div>

              <p className="text-sm text-gray-500 mt-2">
                Rule: schedule defines discards for N races. If N is greater than the list length,
                the last value is reused.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={save}
                disabled={!selectedClass || saving}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
