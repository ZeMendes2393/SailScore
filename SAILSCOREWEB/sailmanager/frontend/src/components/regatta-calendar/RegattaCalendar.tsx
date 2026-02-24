'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'] as const;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export interface RegattaItem {
  id: number;
  name: string;
  location: string;
  start_date: string;
  end_date: string;
  /** Compatível com o toggle "Online Entry" no admin; default true = inscrições abertas */
  online_entry_open?: boolean;
  /** Nomes das classes (ex.: ["ILCA 7", "ILCA 6"]) */
  class_names?: string[];
}

interface RegattaCalendarProps {
  regattas: RegattaItem[];
  /** Base path for regatta links. Public: /regattas, Admin: /admin/manage-regattas */
  regattaLinkPrefix: string;
  /** Optional: show Add Regatta button (admin only) */
  addRegattaHref?: string;
  /** English/Portuguese labels */
  labels?: {
    regattas?: string;
    noRegattas?: string;
    addRegatta?: string;
    moreInfo?: string;
    viewInfo?: string;
    viewButton?: string;
    statusOpen?: string;
    statusClosed?: string;
  };
}

/** Formata intervalo de datas para exibição no card: "12–14 Abr" */
function formatDateRangeShort(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${start.getDate()}–${end.getDate()} ${MONTHS_PT[start.getMonth()]}`;
  }
  return `${start.getDate()} ${MONTHS_PT[start.getMonth()]} – ${end.getDate()} ${MONTHS_PT[end.getMonth()]}`;
}

/** Returns true if the date string (YYYY-MM-DD) falls within any regatta's date range */
function dateHasRegatta(dateStr: string, regattas: RegattaItem[]): boolean {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const t = d.getTime();

  for (const r of regattas) {
    const start = new Date(r.start_date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(r.end_date);
    end.setHours(23, 59, 59, 999);
    if (t >= start.getTime() && t <= end.getTime()) return true;
  }
  return false;
}

/** Get days to show in calendar (including padding for month start) */
function getCalendarDays(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDow = first.getDay(); // 0 = Sun
  const daysInMonth = last.getDate();

  const result: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) result.push(null);
  for (let d = 1; d <= daysInMonth; d++) result.push(d);
  return result;
}

export function RegattaCalendar({
  regattas,
  regattaLinkPrefix,
  addRegattaHref,
  labels = {},
}: RegattaCalendarProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const calendarDays = useMemo(() => getCalendarDays(year, month), [year, month]);

  const regattasInMonth = useMemo(() => {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    return regattas.filter((r) => {
      const s = new Date(r.start_date);
      const e = new Date(r.end_date);
      return s <= end && e >= start;
    });
  }, [regattas, year, month]);

  const t = {
    regattas: labels.regattas ?? 'Regattas',
    noRegattas: labels.noRegattas ?? 'No regattas in this month.',
    addRegatta: labels.addRegatta ?? 'Add Regatta',
    moreInfo: labels.moreInfo ?? 'More Info',
    viewInfo: labels.viewInfo ?? 'View Info',
    viewButton: labels.viewButton ?? 'View',
    statusOpen: labels.statusOpen ?? 'Registrations open',
    statusClosed: labels.statusClosed ?? 'Registrations closed',
  };

  const years = useMemo(() => {
    const y = today.getFullYear();
    return Array.from({ length: 6 }, (_, i) => y - 1 + i);
  }, []);

  return (
    <div className="bg-white shadow rounded-lg p-6">
      {/* Year selector */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm font-medium text-gray-600">{t.regattas}</span>
        <select
          className="border rounded px-2 py-1 text-sm"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        {addRegattaHref && (
          <Link
            href={addRegattaHref}
            className="ml-auto text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
          >
            {t.addRegatta}
          </Link>
        )}
      </div>

      {/* Month selector */}
      <div className="flex flex-wrap gap-1 mb-4">
        {MONTHS.map((m, i) => (
          <button
            key={m}
            onClick={() => setMonth(i)}
            className={`px-2 py-1 rounded text-sm font-medium transition ${
              month === i
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5 mb-6 justify-items-center max-w-xs">
        {WEEKDAYS.map((wd) => (
          <div key={wd} className="text-center text-[10px] text-gray-500 font-medium w-6">
            {wd.charAt(0)}
          </div>
        ))}
        {calendarDays.map((d, idx) => {
          if (d === null) {
            return <div key={`empty-${idx}`} className="w-6 h-6" />;
          }
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const hasRegatta = dateHasRegatta(dateStr, regattas);
          const isToday =
            today.getFullYear() === year &&
            today.getMonth() === month &&
            today.getDate() === d;

          // Days with regattas: blue bg, white dot on top. Days without: light border, no dot.
          return (
            <div
              key={dateStr}
              className={`w-6 h-6 flex items-center justify-center rounded-full border text-[10px] relative ${
                isToday
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : hasRegatta
                  ? 'border-blue-400 bg-blue-500 text-white'
                  : 'border-gray-200 text-gray-600 bg-white'
              }`}
            >
              {hasRegatta && (
                <span
                  className="absolute top-0 w-1 h-1 rounded-full bg-white"
                  title="Regatta on this day"
                  aria-hidden
                />
              )}
              <span>{d}</span>
            </div>
          );
        })}
      </div>

      {/* List of regattas in selected month */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          {MONTHS[month]} {year}
        </h3>
        {regattasInMonth.length === 0 ? (
          <p className="text-gray-500 text-sm">{t.noRegattas}</p>
        ) : (
          <ul className="space-y-4">
            {regattasInMonth.map((r) => {
              const isOpen = r.online_entry_open !== false;
              const classesText = (r.class_names && r.class_names.length > 0)
                ? r.class_names.join(' • ')
                : null;
              return (
                <li key={r.id} className="border border-gray-200 rounded-lg p-4 shadow-sm bg-white hover:shadow-md transition-shadow">
                  <div className="flex flex-col gap-1.5">
                    <h4 className="font-semibold text-gray-900">{r.name}</h4>
                    <p className="text-sm text-gray-600">{formatDateRangeShort(r.start_date, r.end_date)}</p>
                    <p className="text-sm text-gray-600 flex items-center gap-1">
                      <span aria-hidden>📍</span> {r.location}
                    </p>
                    {classesText && (
                      <p className="text-sm text-gray-600">
                        Classes: {classesText}
                      </p>
                    )}
                    <p className="text-sm font-medium text-gray-700">
                      Status: {isOpen ? t.statusOpen : t.statusClosed}
                    </p>
                    <Link
                      href={`${regattaLinkPrefix}/${r.id}`}
                      className="self-start mt-1 text-sm bg-gray-800 text-white px-3 py-1.5 rounded hover:bg-gray-700"
                    >
                      {t.viewButton}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
